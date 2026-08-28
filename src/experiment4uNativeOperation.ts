import type {RecoveryLedger} from "./experiment3yrCore.js";
import {fetchTextSafeR2} from "./experiment3yr2Core.js";
import type {DocEvidence} from "./experiment3wCore.js";
import {FOUR_A_BUDGET,FOUR_A_CASES} from "./experiment4aCore.js";
import type {Provider4A} from "./experiment4aContract.js";
import {fourAp1Sha,type P1RequestHypothesis,type P1RequestSlot} from "./experiment4ap1Model.js";
import {lexicalTokensP1} from "./experiment4ap1Request.js";
import {extractLinkedContractCandidates4S} from "./experiment4sLinked.js";
import {qualifyMachineSpec4U,resolveLocalRef4U,resolveServerOrigin4U,responseHasDeferredRefs4U,responseSchemaFingerprint4U,securityRequired4U,sha4u,type RefMetrics4U} from "./experiment4uOpenApi.js";

const AUTH=/^(?:api[_-]?key|apikey|key|token|access[_-]?token|secret|authorization|auth|app[_-]?id|appid|client[_-]?id|client[_-]?secret)$/i;
const GENERIC=/^(?:id|name|q|s|query|search|term|value|input)$/i;
const overlap=(a:string,b:string)=>{const x=new Set(lexicalTokensP1(a)),y=new Set(lexicalTokensP1(b));let n=0;for(const t of x)if(y.has(t))n++;return n};
function literalValues(p:any){const schema=p?.schema||{};if(schema.const!==undefined)return [String(schema.const)];if(p?.const!==undefined)return [String(p.const)];if(schema.default!==undefined)return [String(schema.default)];if(p?.default!==undefined)return [String(p.default)];const e=Array.isArray(schema.enum)?schema.enum:Array.isArray(p?.enum)?p.enum:[];return e.length===1?[String(e[0])]:[]}
function slot(opId:string,p:any):P1RequestSlot|null{if(!p||typeof p.name!=="string"||(p.in!=="path"&&p.in!=="query"))return null;const id=`par_${fourAp1Sha({opId,name:p.name,in:p.in}).slice(0,14)}`;return {id,name:p.name,in:p.in,required:p.in==="path"||p.required===true,auth_like:AUTH.test(p.name),literals:literalValues(p).map(value=>({id:`lit_${fourAp1Sha({id,value}).slice(0,14)}`,value}))}}
function bindInputs(caseId:string,slots:P1RequestSlot[],context:string){const c=FOUR_A_CASES.find(x=>x.case_id===caseId);if(!c)return null;const available=slots.filter(s=>!s.auth_like),used=new Set<string>(),bindings:Record<string,string>={};for(const input of c.input_names){const scored=available.filter(s=>!used.has(s.id)).map(s=>({s,score:overlap(input,s.name)*180+overlap(input,`${s.name} ${context}`)*100})).sort((a,b)=>b.score-a.score||a.s.name.localeCompare(b.s.name));let best=scored[0];if((!best||best.score===0)&&c.input_names.length===1){const req=available.filter(s=>s.required&&!used.has(s.id));if(req.length===1&&GENERIC.test(req[0].name))best={s:req[0],score:25}}if(!best||best.score<=0)return null;bindings[input]=best.s.id;used.add(best.s.id)}return bindings}
function refMetrics():RefMetrics4U{return {operationLocalRefsResolved4u:0,operationLocalRefsRejected4u:0,operationExternalRefsRejected4u:0,operationExternalRefFetches4u:0,operationRefCyclesRejected4u:0,unrelatedRefFailuresIsolated4u:0}}
export function freezeRequestProof4U(h:P1RequestHypothesis){const snapshot={id:h.id,source_operation_id:h.source_operation_id,origin:h.origin,full_path:h.full_path,proof_type:h.proof_type,evidence_ids:[...h.evidence_ids],source_urls:[...h.source_urls],slots:h.slots.map(s=>({...s,literals:s.literals.map(l=>({...l}))})),input_bindings:{...h.input_bindings},literal_bindings:{...h.literal_bindings},concrete_relation:h.concrete_relation};return {snapshot,fingerprint:sha4u(snapshot)}}
export function verifyFrozenRequestProof4U(h:P1RequestHypothesis,proof:any){const expected=freezeRequestProof4U(h);return !!proof&&proof.fingerprint===expected.fingerprint&&JSON.stringify(proof.snapshot)===JSON.stringify(expected.snapshot)}

export async function buildNativeHypotheses4U(evidence:DocEvidence[],provider:Provider4A,ledger:RecoveryLedger){
  const metrics:any={machineDocumentFetches4u:0,machineJsonParseSuccesses4u:0,machineYamlParseSuccesses4u:0,machineNonSpecJsonRejected4u:0,machineNonSpecYamlRejected4u:0,qualifiedOpenApi3Documents4u:0,qualifiedSwagger2Documents4u:0,...refMetrics(),nativeOperationsDiscovered4u:0,nativeOperationsEligible4u:0,nativeOperationsRejectedAuth4u:0,nativeOperationsRejectedUnsupportedRequest4u:0,nativeOperationsRejectedSemanticMismatch4u:0,nativeOperationHypotheses4u:0,nativeOperationUniqueInputBindings4u:0,nativeOperationAmbiguousBindings4u:0};
  const hypotheses:P1RequestHypothesis[]=[],proofs:any[]=[];let seq=0;
  for(const candidate of extractLinkedContractCandidates4S(evidence,provider.start_url).slice(0,6)){
    metrics.machineDocumentFetches4u++;
    try{
      const got=await fetchTextSafeR2(provider.start_url,candidate.target_url,FOUR_A_BUDGET.max_bytes,ledger),q=qualifyMachineSpec4U(got.text);
      if(q.jsonOk)metrics.machineJsonParseSuccesses4u++;if(q.yamlOk)metrics.machineYamlParseSuccesses4u++;if(q.nonSpecJson)metrics.machineNonSpecJsonRejected4u++;if(q.nonSpecYaml)metrics.machineNonSpecYamlRejected4u++;if(!q.spec)continue;
      if(q.spec.kind==="openapi3")metrics.qualifiedOpenApi3Documents4u++;else metrics.qualifiedSwagger2Documents4u++;
      const root=q.spec.spec,origin=resolveServerOrigin4U(q.spec,got.final_url);if(!origin)continue;
      for(const [path,rawItem] of Object.entries(root.paths||{}) as any[]){let item:any=rawItem;try{item=resolveLocalRef4U(root,item,metrics)}catch{continue}const op=item?.get;if(!op)continue;metrics.nativeOperationsDiscovered4u++;if(securityRequired4U(root,op)){metrics.nativeOperationsRejectedAuth4u++;continue}
        const rawParams=[...(Array.isArray(item.parameters)?item.parameters:[]),...(Array.isArray(op.parameters)?op.parameters:[])],params:any[]=[];let requestRefFailed=false;for(const raw of rawParams){try{params.push(resolveLocalRef4U(root,raw,metrics))}catch{requestRefFailed=true;break}}if(requestRefFailed)continue;
        if(op.requestBody||params.some((p:any)=>p&&!(p.in==="path"||p.in==="query")&&p.required===true)){metrics.nativeOperationsRejectedUnsupportedRequest4u++;continue}
        const slots=params.map((p:any)=>slot(String(op.operationId||path),p)).filter(Boolean) as P1RequestSlot[];if(slots.some(s=>s.required&&s.auth_like)){metrics.nativeOperationsRejectedAuth4u++;continue}
        const context=[op.operationId,op.summary,op.description,path,...params.map((p:any)=>`${p.name||""} ${p.description||""}`)].filter(Boolean).join(" "),bindings=bindInputs(provider.case_id,slots,context);if(!bindings){metrics.nativeOperationsRejectedSemanticMismatch4u++;continue}
        const used=new Set(Object.values(bindings)),literal_bindings:Record<string,string>={};let valid=true;for(const s of slots){if(used.has(s.id)||s.auth_like)continue;if(s.required){if(s.literals.length===1)literal_bindings[s.id]=s.literals[0].id;else{valid=false;break}}}if(!valid){metrics.nativeOperationsRejectedUnsupportedRequest4u++;continue}
        if(responseHasDeferredRefs4U(op))metrics.unrelatedRefFailuresIsolated4u++;
        metrics.nativeOperationsEligible4u++;const evidenceId=`${provider.candidate_id}-4u${String(++seq).padStart(2,"0")}`,specFingerprint=sha4u(got.text),pointer=`#/paths/${path.replace(/~/g,"~0").replace(/\//g,"~1")}/get`,identity={origin,path,bindings,literal_bindings,specFingerprint,pointer};
        const h:P1RequestHypothesis={id:`req4u_${fourAp1Sha(identity).slice(0,16)}`,source_operation_id:`op4u_${fourAp1Sha({specFingerprint,pointer}).slice(0,16)}`,origin,full_path:path,proof_type:"4u_linked_native_openapi_operation",evidence_ids:[candidate.source_evidence_id,evidenceId],source_urls:[candidate.source_url,got.final_url],slots,input_bindings:bindings,literal_bindings,score:1200+overlap(context,FOUR_A_CASES.find(c=>c.case_id===provider.case_id)?.intent||"")*10,concrete_relation:false};
        hypotheses.push(h);proofs.push({hypothesis_id:h.id,evidence_id:evidenceId,spec_fingerprint:specFingerprint,contract_url:got.final_url,operation_pointer:pointer,method:"GET",origin,path,operation_id:op.operationId||null,summary:op.summary||null,description:op.description||null,security_requirement:op.security??root.security??null,parameters:params.map((p:any)=>({name:p.name,in:p.in,required:p.required===true||p.in==="path"})),documented_response_content_types:Object.values(op.responses||{}).flatMap((r:any)=>Object.keys(r?.content||{})),response_schema_fingerprint_or_null:responseSchemaFingerprint4U(op)});
      }
    }catch{}
  }
  const dedup=new Map<string,P1RequestHypothesis>();for(const h of hypotheses){const k=sha4u({origin:h.origin,path:h.full_path,input:h.input_bindings,literal:h.literal_bindings});if(!dedup.has(k))dedup.set(k,h)}const out=[...dedup.values()].sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id));metrics.nativeOperationHypotheses4u=out.length;metrics.nativeOperationUniqueInputBindings4u=new Set(out.map(h=>sha4u(h.input_bindings))).size;return {hypotheses:out,proofs,metrics};
}
