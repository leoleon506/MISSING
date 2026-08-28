import {createHash} from "node:crypto";
import type {RecoveryLedger} from "./experiment3yrCore.js";
import {fetchTextSafeR2} from "./experiment3yr2Core.js";
import {docScopeAllowed,type DocEvidence} from "./experiment3wCore.js";
import {FOUR_A_BUDGET,FOUR_A_CASES} from "./experiment4aCore.js";
import type {Provider4A} from "./experiment4aContract.js";
import {fourAp1Sha,type P1RequestHypothesis,type P1RequestSlot} from "./experiment4ap1Model.js";
import {lexicalTokensP1} from "./experiment4ap1Request.js";
import {extractLinkedContractCandidates4S} from "./experiment4sLinked.js";

const AUTH=/^(?:api[_-]?key|apikey|key|token|access[_-]?token|secret|authorization|auth|app[_-]?id|appid|client[_-]?id|client[_-]?secret)$/i;
const GENERIC=/^(?:id|name|q|s|query|search|term|value|input)$/i;
const sha=(v:any)=>createHash("sha256").update(typeof v==="string"?v:JSON.stringify(v)).digest("hex");
const tokens=(v:string)=>new Set(lexicalTokensP1(v));
function overlap(a:string,b:string){const x=tokens(a),y=tokens(b);let n=0;for(const t of x)if(y.has(t))n++;return n}
function scalar(v:string){const s=v.trim();if(!s)return "";if(s==="true")return true;if(s==="false")return false;if(s==="null")return null;if(/^-?\d+(?:\.\d+)?$/.test(s))return Number(s);if((s.startsWith('"')&&s.endsWith('"'))||(s.startsWith("'")&&s.endsWith("'")))return s.slice(1,-1);if(s.startsWith("[")&&s.endsWith("]"))return s.slice(1,-1).split(",").map(x=>scalar(x));return s}

// Bounded structural YAML parser for the OpenAPI subset we execute. It preserves
// mappings/sequences instead of flattening them into prose. JSON remains exact.
export function parseMachineContract4T(text:string){
  try{return {format:"json" as const,spec:JSON.parse(text)}}catch{}
  const raw=text.replace(/^\uFEFF/,"").split(/\r?\n/),root:any={};
  type Frame={indent:number;value:any;parent:any;key:string|number|null};
  const stack:Frame[]=[{indent:-1,value:root,parent:null,key:null}];
  const clean=(line:string)=>{let q:string|null=null,out="";for(let i=0;i<line.length;i++){const c=line[i];if((c==='"'||c==="'")&&line[i-1]!=="\\")q=q===c?null:q??c;if(c==="#"&&!q)break;out+=c}return out.replace(/\s+$/,"")};
  for(let idx=0;idx<raw.length;idx++){
    const line=clean(raw[idx]);if(!line.trim()||/^\s*---\s*$/.test(line))continue;
    const indent=line.match(/^\s*/)?.[0].length||0,body=line.trim();while(stack.length>1&&indent<=stack[stack.length-1].indent)stack.pop();let frame=stack[stack.length-1];
    if(body.startsWith("- ")){
      if(!Array.isArray(frame.value)){
        if(frame.parent&&frame.key!==null){const arr:any[]=[];frame.parent[frame.key as any]=arr;frame={...frame,value:arr};stack[stack.length-1]=frame}else return null;
      }
      const rest=body.slice(2).trim();if(!rest){const obj:any={};frame.value.push(obj);stack.push({indent,value:obj,parent:frame.value,key:frame.value.length-1});continue}
      const m=rest.match(/^([^:]+):(?:\s*(.*))?$/);if(m){const obj:any={},key=m[1].trim(),val=m[2]??"";obj[key]=val?scalar(val):{};frame.value.push(obj);if(!val)stack.push({indent,value:obj[key],parent:obj,key});else stack.push({indent,value:obj,parent:frame.value,key:frame.value.length-1});continue}
      frame.value.push(scalar(rest));continue;
    }
    const m=body.match(/^([^:]+):(?:\s*(.*))?$/);if(!m)continue;const key=m[1].trim(),val=m[2]??"";
    if(val){frame.value[key]=scalar(val);continue}
    let next="";for(let j=idx+1;j<raw.length;j++){next=clean(raw[j]);if(next.trim())break}
    const nextIndent=next.match(/^\s*/)?.[0].length||0,isArray=nextIndent>indent&&next.trim().startsWith("- "),child:any=isArray?[]:{};frame.value[key]=child;stack.push({indent,value:child,parent:frame.value,key});
  }
  if(!root.openapi&&!root.swagger&&!root.paths)return null;return {format:"yaml" as const,spec:root};
}

function localRef(root:any,ref:string,seen:Set<string>,depth:number):any{
  if(!ref.startsWith("#/"))throw new Error("4t_external_ref");if(depth>10||seen.has(ref))throw new Error("4t_ref_cycle");seen.add(ref);
  let cur=root;for(const part of ref.slice(2).split("/").map(s=>s.replace(/~1/g,"/").replace(/~0/g,"~"))){cur=cur?.[part];if(cur===undefined)throw new Error("4t_ref_missing")}
  return resolveNode(root,cur,seen,depth+1);
}
function resolveNode(root:any,node:any,seen=new Set<string>(),depth=0):any{if(depth>12)return node;if(Array.isArray(node))return node.map(x=>resolveNode(root,x,new Set(seen),depth+1));if(!node||typeof node!=="object")return node;if(typeof node.$ref==="string"){const base=localRef(root,node.$ref,new Set(seen),depth+1);return {...base,...Object.fromEntries(Object.entries(node).filter(([k])=>k!=="$ref"))}}const out:any={};for(const [k,v] of Object.entries(node))out[k]=resolveNode(root,v,new Set(seen),depth+1);return out}
function serverOrigin(spec:any,contractUrl:string){
  const candidates:string[]=[];for(const s of Array.isArray(spec.servers)?spec.servers:[]){if(typeof s?.url==="string")candidates.push(s.url)}
  if(spec.swagger&&spec.host){for(const scheme of Array.isArray(spec.schemes)&&spec.schemes.length?spec.schemes:[new URL(contractUrl).protocol.replace(":","")])candidates.push(`${scheme}://${spec.host}${String(spec.basePath||"")}`)}
  if(!candidates.length)candidates.push(new URL(contractUrl).origin);
  for(const raw of candidates){try{const u=new URL(raw,contractUrl);if(docScopeAllowed(contractUrl,u.toString()))return u.toString().replace(/\/$/,"")}catch{}}
  return null;
}
function operationAuth(spec:any,op:any){const sec=op.security===undefined?spec.security:op.security;return Array.isArray(sec)&&sec.length>0}
function literalValues(p:any){const out:string[]=[];const schema=p?.schema||{};if(schema.const!==undefined)out.push(String(schema.const));else if(p.const!==undefined)out.push(String(p.const));else if(schema.default!==undefined)out.push(String(schema.default));else if(p.default!==undefined)out.push(String(p.default));else{const e=Array.isArray(schema.enum)?schema.enum:Array.isArray(p.enum)?p.enum:[];if(e.length===1)out.push(String(e[0]))}return out}
function slot(opId:string,p:any):P1RequestSlot|null{if(!p||typeof p.name!=="string"||(p.in!=="path"&&p.in!=="query"))return null;const id=`par_${fourAp1Sha({opId,name:p.name,in:p.in}).slice(0,14)}`;return {id,name:p.name,in:p.in,required:p.in==="path"||p.required===true,auth_like:AUTH.test(p.name),literals:literalValues(p).map(value=>({id:`lit_${fourAp1Sha({id,value}).slice(0,14)}`,value}))}}
function assignInputs(caseId:string,slots:P1RequestSlot[],context:string){const c=FOUR_A_CASES.find(x=>x.case_id===caseId);if(!c)return null;const nonAuth=slots.filter(s=>!s.auth_like),bindings:Record<string,string>={},used=new Set<string>();for(const input of c.input_names){const scored=nonAuth.filter(s=>!used.has(s.id)).map(s=>({s,score:overlap(input,`${s.name} ${context}`)*100+(overlap(input,s.name)>0?80:0)})).sort((a,b)=>b.score-a.score);let best=scored[0];if((!best||best.score===0)&&c.input_names.length===1&&nonAuth.filter(s=>s.required).length===1){const only=nonAuth.find(s=>s.required)!;if(GENERIC.test(only.name))best={s:only,score:25}}if(!best||best.score<=0)return null;bindings[input]=best.s.id;used.add(best.s.id)}return bindings}

export async function buildNativeHypotheses4T(evidence:DocEvidence[],provider:Provider4A,ledger:RecoveryLedger){
  const metrics:any={nativeContractsParsed4t:0,nativeContractsJsonParsed4t:0,nativeContractsYamlParsed4t:0,nativeLocalRefsResolved4t:0,nativeLocalRefsRejected4t:0,nativeExternalRefsRejected4t:0,nativeOperationsDiscovered4t:0,nativeOperationsEligible4t:0,nativeOperationsRejectedAuth4t:0,nativeOperationsRejectedUnsupportedRequest4t:0,nativeOperationsRejectedSemanticMismatch4t:0,nativeOperationHypotheses4t:0,nativeOperationUniqueInputBindings4t:0,nativeOperationAmbiguousBindings4t:0};
  const hypotheses:P1RequestHypothesis[]=[],proofs:any[]=[];let seq=0;
  for(const candidate of extractLinkedContractCandidates4S(evidence,provider.start_url).slice(0,6)){
    try{
      const got=await fetchTextSafeR2(provider.start_url,candidate.target_url,FOUR_A_BUDGET.max_bytes,ledger),parsed=parseMachineContract4T(got.text);if(!parsed)continue;metrics.nativeContractsParsed4t++;metrics[parsed.format==="json"?"nativeContractsJsonParsed4t":"nativeContractsYamlParsed4t"]++;
      let spec:any;try{spec=resolveNode(parsed.spec,parsed.spec);metrics.nativeLocalRefsResolved4t++}catch(e){const s=String(e);if(s.includes("external_ref"))metrics.nativeExternalRefsRejected4t++;else metrics.nativeLocalRefsRejected4t++;continue}
      const origin=serverOrigin(spec,got.final_url);if(!origin)continue;
      for(const [path,item0] of Object.entries(spec.paths||{}) as any[]){const item=item0||{},op=item.get;if(!op)continue;metrics.nativeOperationsDiscovered4t++;if(operationAuth(spec,op)){metrics.nativeOperationsRejectedAuth4t++;continue}
        const params=[...(Array.isArray(item.parameters)?item.parameters:[]),...(Array.isArray(op.parameters)?op.parameters:[])],slots=params.map((p:any)=>slot(String(op.operationId||path),p)).filter(Boolean) as P1RequestSlot[];
        if(slots.some(s=>s.required&&s.auth_like)){metrics.nativeOperationsRejectedAuth4t++;continue}if(params.some((p:any)=>!p||!(p.in==="path"||p.in==="query"))){metrics.nativeOperationsRejectedUnsupportedRequest4t++;continue}
        const context=[op.operationId,op.summary,op.description,path,...params.map((p:any)=>`${p.name||""} ${p.description||""}`)].filter(Boolean).join(" "),bindings=assignInputs(provider.case_id,slots,context);if(!bindings){metrics.nativeOperationsRejectedSemanticMismatch4t++;continue}
        const used=new Set(Object.values(bindings)),literal_bindings:Record<string,string>={};let valid=true;for(const s of slots){if(used.has(s.id)||s.auth_like)continue;if(s.required){if(s.literals.length===1)literal_bindings[s.id]=s.literals[0].id;else{valid=false;break}}}if(!valid){metrics.nativeOperationsRejectedUnsupportedRequest4t++;continue}
        metrics.nativeOperationsEligible4t++;const evidenceId=`${provider.candidate_id}-4t${String(++seq).padStart(2,"0")}`,specFingerprint=sha(got.text),pointer=`#/paths/${path.replace(/~/g,"~0").replace(/\//g,"~1")}/get`,identity={origin,path,bindings,literal_bindings,specFingerprint,pointer};
        const h:P1RequestHypothesis={id:`req4t_${fourAp1Sha(identity).slice(0,16)}`,source_operation_id:`op4t_${fourAp1Sha({specFingerprint,pointer}).slice(0,16)}`,origin,full_path:path,proof_type:"4t_linked_native_openapi_operation",evidence_ids:[candidate.source_evidence_id,evidenceId],source_urls:[candidate.source_url,got.final_url],slots,input_bindings:bindings,literal_bindings,score:1000+overlap(context,FOUR_A_CASES.find(c=>c.case_id===provider.case_id)?.intent||"")*10,concrete_relation:false};
        hypotheses.push(h);proofs.push({hypothesis_id:h.id,evidence_id:evidenceId,contract_url:got.final_url,spec_fingerprint:specFingerprint,operation_pointer:pointer,origin,path,parameter_names:slots.map(s=>s.name),response_schema_fingerprint:sha(op.responses||{})});
      }
    }catch(e){if(String(e).includes("external_ref"))metrics.nativeExternalRefsRejected4t++}
  }
  const dedup=new Map<string,P1RequestHypothesis>();for(const h of hypotheses){const k=sha({origin:h.origin,path:h.full_path,input:h.input_bindings,literal:h.literal_bindings});if(!dedup.has(k))dedup.set(k,h)}const out=[...dedup.values()].sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id));metrics.nativeOperationHypotheses4t=out.length;metrics.nativeOperationUniqueInputBindings4t=new Set(out.map(h=>sha(h.input_bindings))).size;return {hypotheses:out,proofs,metrics};
}

export function freezeRequestProof4T(h:P1RequestHypothesis){const snapshot={id:h.id,source_operation_id:h.source_operation_id,origin:h.origin,full_path:h.full_path,proof_type:h.proof_type,evidence_ids:[...h.evidence_ids],source_urls:[...h.source_urls],slots:h.slots.map(s=>({...s,literals:s.literals.map(l=>({...l}))})),input_bindings:{...h.input_bindings},literal_bindings:{...h.literal_bindings},concrete_relation:h.concrete_relation};return {snapshot,fingerprint:sha(snapshot)}}
export function verifyFrozenRequestProof4T(h:P1RequestHypothesis,proof:any){const now=freezeRequestProof4T(h);return !!proof&&proof.fingerprint===now.fingerprint&&JSON.stringify(proof.snapshot)===JSON.stringify(now.snapshot)}
