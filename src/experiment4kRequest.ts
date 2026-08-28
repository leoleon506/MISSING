import type {DocEvidence} from "./experiment3wCore.js";
import type {RecoveryLedger} from "./experiment3yrCore.js";
import {FOUR_A_CASES} from "./experiment4aCore.js";
import {FOUR_AP1_MAX_PROBES_PER_PROVIDER,fourAp1Sha,type P1RequestHypothesis,type P1RequestSlot} from "./experiment4ap1Model.js";
import {compileRequestHypothesisP1,lexicalTokensP1} from "./experiment4ap1Request.js";
import {prepareRequestGraph4J,rebuildRequestGraph4J} from "./experiment4jRequest.js";
import type {Operation4G,SemanticIr4G} from "./experiment4gSemantics.js";

const AUTH_NAME=/^(?:api[_-]?key|apikey|key|token|access[_-]?token|secret|authorization|auth|client[_-]?id|client[_-]?secret)$/i;
const ACTION=new Set(["get","lookup","search","find","retrieve","fetch","decode","estimate","resolve","convert","list","identify"]);
const ENTITY_NOISE=new Set([
  "given","public","machine","readable","api","operation","return","returns","canonical","current","human",
  "identify","identifier","identification","metadata","string","numeric","number","matching","queried","query","estimated",
  "information","data","value","values","result","results","using","use","provide","provides",
]);

type Metrics=Record<string,any>;
type ParsedOp={
  op:Operation4G;
  origin:string;
  baseSourceId:string;
  baseSourceUrl:string;
  pathHead:string;
  segmentsRaw:string[];
  segmentsNorm:string[];
  queryRaw:{keyRaw:string;key:string;valueRaw:string;valueNorm:string;auth:boolean}[];
};
type VariablePos={kind:"path";index:number}|{kind:"query";key:string};
type FamilyMember={parsed:ParsedOp;valueRaw:string;valueNorm:string};
type Family={signature:string;position:VariablePos;members:Map<string,FamilyMember>};
type Signals={entity:boolean;action:boolean;output:boolean;count:number};
type RenderCheck={kind:"ok"|"compile_reject"|"url_reject"|"auth_like";url?:string};

function toks(v:string){return lexicalTokensP1(v)}
function norm(v:string){let x=v;try{x=decodeURIComponent(v.replace(/\+/g," "))}catch{}return x.trim().toLowerCase()}
function queryName(v:string){return norm(v.replace(/^amp;/i,""))}
function splitPath(path:string){const q=path.indexOf("?");return {head:q<0?path:path.slice(0,q),query:q<0?"":path.slice(q+1)}}
function parseQuery(raw:string){
  if(!raw)return [] as ParsedOp["queryRaw"];
  return raw.split("&").filter(Boolean).map(part=>{
    const eq=part.indexOf("="),keyRaw=eq<0?part:part.slice(0,eq),valueRaw=eq<0?"":part.slice(eq+1),key=queryName(keyRaw);
    return {keyRaw,key,valueRaw,valueNorm:norm(valueRaw),auth:AUTH_NAME.test(key)};
  });
}
function safeParsed(semantics:SemanticIr4G,op:Operation4G):ParsedOp|null{
  if(op.method!=="GET"||op.auth_class==="REQUIRED"||!op.api_base_id||/[{}]/.test(op.path))return null;
  const base=semantics.ir.api_bases.find((b:any)=>b.id===op.api_base_id);if(!base)return null;
  const {head,query}=splitPath(op.path),segmentsRaw=head.split("/"),segmentsNorm=segmentsRaw.map(norm),queryRaw=parseQuery(query);
  if(queryRaw.some(q=>q.auth&&q.valueRaw.includes("{")))return null;
  return {op,origin:base.origin,baseSourceId:base.source.evidence_id,baseSourceUrl:base.source.source_url,pathHead:head,segmentsRaw,segmentsNorm,queryRaw};
}
function coarseKey(p:ParsedOp){return `${p.op.method}|${p.origin}|${p.segmentsNorm.length}|${p.queryRaw.filter(q=>!q.auth).map(q=>q.key).sort().join(",")}`}
function noOriginKey(p:ParsedOp){return `${p.op.method}|${p.segmentsNorm.length}|${p.queryRaw.filter(q=>!q.auth).map(q=>q.key).sort().join(",")}`}
function noQueryShapeKey(p:ParsedOp){return `${p.op.method}|${p.origin}|${p.segmentsNorm.length}`}
function valueForQuery(p:ParsedOp,key:string){return p.queryRaw.find(q=>!q.auth&&q.key===key)?.valueNorm??null}
function pairDiff(a:ParsedOp,b:ParsedOp){
  const diffs:{position:VariablePos;a:string;b:string}[]=[];
  for(let i=0;i<a.segmentsNorm.length;i++)if(a.segmentsNorm[i]!==b.segmentsNorm[i])diffs.push({position:{kind:"path",index:i},a:a.segmentsNorm[i],b:b.segmentsNorm[i]});
  const keys=a.queryRaw.filter(q=>!q.auth).map(q=>q.key).sort();
  for(const key of keys){const av=valueForQuery(a,key),bv=valueForQuery(b,key);if(av!==bv)diffs.push({position:{kind:"query",key},a:av??"",b:bv??""})}
  return diffs;
}
function familySignature(p:ParsedOp,pos:VariablePos){
  const segs=[...p.segmentsNorm];if(pos.kind==="path")segs[pos.index]="*";
  const qs=p.queryRaw.filter(q=>!q.auth).map(q=>[q.key,pos.kind==="query"&&q.key===pos.key?"*":q.valueNorm] as const).sort((a,b)=>a[0].localeCompare(b[0]));
  return fourAp1Sha({m:p.op.method,o:p.origin,s:segs,q:qs,pos});
}
function memberValue(p:ParsedOp,pos:VariablePos){
  if(pos.kind==="path")return {raw:p.segmentsRaw[pos.index]??"",normalized:p.segmentsNorm[pos.index]??""};
  const q=p.queryRaw.find(x=>!x.auth&&x.key===pos.key);return {raw:q?.valueRaw??"",normalized:q?.valueNorm??""};
}
function hasOverlap(a:Iterable<string>,b:Iterable<string>){const right=new Set(b);for(const x of a)if(right.has(x))return true;return false}
function familySignals(caseId:string,semantics:SemanticIr4G,members:FamilyMember[]):Signals{
  const c=FOUR_A_CASES.find(x=>x.case_id===caseId);if(!c)return {entity:false,action:false,output:false,count:0};
  const operationText=members.map(({parsed})=>{
    const sec=semantics.ir.sections.find((s:any)=>s.id===parsed.op.section_id);
    return `${parsed.op.title} ${sec?.title||""} ${parsed.op.path} ${parsed.op.context}`;
  }).join(" ");
  const opTokens=new Set(toks(operationText)),intent=new Set(toks(c.intent||"")),outputs=new Set(c.required.flatMap(x=>toks(x))),inputs=new Set(c.input_names.flatMap(x=>toks(x)));
  const taskActions=new Set([...intent].filter(x=>ACTION.has(x))),opActions=new Set([...opTokens].filter(x=>ACTION.has(x)));
  const entityTokens=new Set([...intent].filter(x=>!ACTION.has(x)&&!outputs.has(x)&&!inputs.has(x)&&!ENTITY_NOISE.has(x)&&x.length>2));
  const entity=hasOverlap(entityTokens,opTokens),action=taskActions.size>0&&opActions.size>0,output=hasOverlap(outputs,opTokens);
  return {entity,action,output,count:Number(entity)+Number(action)+Number(output)};
}
function shape(v:string){const x=norm(v);if(/^\d+$/.test(x))return `numeric:${x.length}`;if(/^[a-z]+$/i.test(x))return `alpha:${x.length}`;if(/^[a-z0-9]+$/i.test(x))return `alnum:${x.length}`;if(/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(x))return "uuid";return `other:${x.length}`}
function removeAuthPairs(path:string){
  const q=path.indexOf("?");if(q<0)return path;
  const head=path.slice(0,q),kept=path.slice(q+1).split("&").filter(part=>!AUTH_NAME.test(queryName(part.split("=",1)[0]||"")));
  return kept.length?`${head}?${kept.join("&")}`:head;
}
function templateFor(rep:ParsedOp,pos:VariablePos,input:string){
  let path=removeAuthPairs(rep.op.path);
  if(pos.kind==="path"){
    const {head,query}=splitPath(path),segments=head.split("/");segments[pos.index]=`{${input}}`;path=segments.join("/")+(query?`?${query}`:"");
  }
  return path;
}
function renderCheck(h:P1RequestHypothesis,caseId:string):RenderCheck{
  const c=FOUR_A_CASES.find(x=>x.case_id===caseId);if(!c)return {kind:"compile_reject"};
  let url:string;try{url=compileRequestHypothesisP1(h,c.build)}catch{return {kind:"compile_reject"}}
  let parsed:URL;try{parsed=new URL(url)}catch{return {kind:"url_reject"}}
  for(const [name] of parsed.searchParams)if(AUTH_NAME.test(queryName(name)))return {kind:"auth_like",url};
  if(h.slots.some(slot=>slot.auth_like||AUTH_NAME.test(queryName(slot.name))))return {kind:"auth_like",url};
  return {kind:"ok",url};
}
function initMetrics():Metrics{return {
  routeFamilyCandidates:0,routeFamiliesAccepted:0,routeFamiliesRejectedInsufficientMembers:0,routeFamiliesRejectedMultipleVariablePositions:0,
  routeFamiliesRejectedOriginMismatch:0,routeFamiliesRejectedQueryShapeMismatch:0,routeFamiliesRejectedAuthLike:0,routeFamilyMembers:0,
  routeFamilyInducedPathSlots:0,routeFamilyInducedQuerySlots:0,routeFamilyDistinctObservedValues:0,routeFamilyShapeSupportedBindings:0,
  routeFamilyEntityRejectedBindings:0,routeFamilySecondarySupportRejectedBindings:0,routeFamilyHypotheses:0,
}}

export function induceRouteFamilyHypotheses4K(semantics:SemanticIr4G,caseId:string){
  const metrics=initMetrics(),parsed=semantics.operations.map(op=>safeParsed(semantics,op)).filter(Boolean) as ParsedOp[];
  const noOrigin=new Map<string,Set<string>>(),noQuery=new Map<string,Set<string>>();
  for(const p of parsed){
    (noOrigin.get(noOriginKey(p))??noOrigin.set(noOriginKey(p),new Set()).get(noOriginKey(p))!).add(p.origin);
    (noQuery.get(noQueryShapeKey(p))??noQuery.set(noQueryShapeKey(p),new Set()).get(noQueryShapeKey(p))!).add(p.queryRaw.filter(q=>!q.auth).map(q=>q.key).sort().join(","));
  }
  metrics.routeFamiliesRejectedOriginMismatch=[...noOrigin.values()].filter(s=>s.size>1).length;
  metrics.routeFamiliesRejectedQueryShapeMismatch=[...noQuery.values()].filter(s=>s.size>1).length;
  const buckets=new Map<string,ParsedOp[]>();for(const p of parsed){const k=coarseKey(p);const arr=buckets.get(k)||[];arr.push(p);buckets.set(k,arr)}
  const families=new Map<string,Family>();
  for(const rows of buckets.values())for(let i=0;i<rows.length;i++)for(let j=i+1;j<rows.length;j++){
    metrics.routeFamilyCandidates++;
    const diffs=pairDiff(rows[i],rows[j]);
    if(diffs.length===0){metrics.routeFamiliesRejectedInsufficientMembers++;continue}
    if(diffs.length!==1){metrics.routeFamiliesRejectedMultipleVariablePositions++;continue}
    const d=diffs[0];if(!d.a||!d.b||d.a===d.b){metrics.routeFamiliesRejectedInsufficientMembers++;continue}
    const sig=familySignature(rows[i],d.position),family=families.get(sig)||{signature:sig,position:d.position,members:new Map<string,FamilyMember>()};
    for(const p of [rows[i],rows[j]]){const v=memberValue(p,d.position);family.members.set(p.op.id,{parsed:p,valueRaw:v.raw,valueNorm:v.normalized})}
    families.set(sig,family);
  }
  const c=FOUR_A_CASES.find(x=>x.case_id===caseId),hypotheses:P1RequestHypothesis[]=[];if(!c||c.input_names.length!==1)return {hypotheses,metrics};
  const input=c.input_names[0];
  for(const family of families.values()){
    const members=[...family.members.values()],values=[...new Set(members.map(m=>m.valueNorm).filter(Boolean))];
    if(members.length<2||values.length<2){metrics.routeFamiliesRejectedInsufficientMembers++;continue}
    const signals=familySignals(caseId,semantics,members);
    if(!signals.entity){metrics.routeFamilyEntityRejectedBindings++;continue}
    if(!(signals.action||signals.output)){metrics.routeFamilySecondarySupportRejectedBindings++;continue}
    const rep=[...members].sort((a,b)=>a.parsed.op.id.localeCompare(b.parsed.op.id))[0],path=templateFor(rep.parsed,family.position,input);
    if(rep.parsed.queryRaw.some(q=>q.auth&&path.includes(q.keyRaw))){metrics.routeFamiliesRejectedAuthLike++;continue}
    const slotName=family.position.kind==="path"?input:family.position.key;
    if(AUTH_NAME.test(slotName)){metrics.routeFamiliesRejectedAuthLike++;continue}
    const slot:P1RequestSlot={id:`4k_family_${fourAp1Sha({f:family.signature,input}).slice(0,14)}`,name:slotName,in:family.position.kind,required:true,auth_like:false,literals:[]};
    const evidenceIds=[...new Set(members.flatMap(m=>[m.parsed.op.source.evidence_id,m.parsed.baseSourceId]))],sourceUrls=[...new Set(members.flatMap(m=>[m.parsed.op.source.source_url,m.parsed.baseSourceUrl]))];
    const observedShapes=new Set(values.map(shape));if(observedShapes.has(shape(String(c.build[input]??""))))metrics.routeFamilyShapeSupportedBindings++;
    hypotheses.push({
      id:`req4k_${fourAp1Sha({f:family.signature,caseId,input,path,slot:slot.name}).slice(0,16)}`,
      source_operation_id:rep.parsed.op.id,origin:rep.parsed.origin,full_path:path,
      proof_type:`4k_route_family_${family.position.kind}_${rep.parsed.op.form}_${rep.parsed.op.api_base_relation||"absolute"}`,
      evidence_ids:evidenceIds,source_urls:sourceUrls,slots:[slot],input_bindings:{[input]:slot.id},literal_bindings:{},
      score:940+signals.count*12+Math.min(24,members.length*2)+(members.some(m=>m.parsed.op.source.expanded)?10:0),concrete_relation:true,
    });
    metrics.routeFamiliesAccepted++;metrics.routeFamilyMembers+=members.length;metrics.routeFamilyDistinctObservedValues+=values.length;
    if(family.position.kind==="path")metrics.routeFamilyInducedPathSlots++;else metrics.routeFamilyInducedQuerySlots++;
  }
  metrics.routeFamilyHypotheses=hypotheses.length;
  return {hypotheses:hypotheses.sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id)),metrics};
}

function augmentGraph(base:any,caseId:string){
  const induced=induceRouteFamilyHypotheses4K(base.semantics,caseId),dedup=new Map<string,P1RequestHypothesis>();
  for(const h of [...base.hypotheses,...induced.hypotheses] as P1RequestHypothesis[]){
    const key=fourAp1Sha({origin:h.origin,path:h.full_path,inputs:h.input_bindings,literals:h.literal_bindings});const prior=dedup.get(key);if(!prior||h.score>prior.score)dedup.set(key,h);
  }
  let renderCompileRejected4k=0,renderUrlParseRejected4k=0,authLikeRenderedRequests4k=0;
  const hypotheses=[...dedup.values()].sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id)).filter(h=>{
    const check=renderCheck(h,caseId);if(check.kind==="compile_reject"){renderCompileRejected4k++;return false}if(check.kind==="url_reject"){renderUrlParseRejected4k++;return false}if(check.kind==="auth_like"){authLikeRenderedRequests4k++;return false}return true;
  });
  return {...base,hypotheses,metrics:{...base.metrics,...induced.metrics,renderCompileRejected4k,renderUrlParseRejected4k,authLikeRenderedRequests4k},graph_fingerprint:fourAp1Sha({base:base.graph_fingerprint,h:hypotheses.map((h:P1RequestHypothesis)=>h.id),rf:induced.metrics})};
}

export async function prepareRequestGraph4K(evidence:DocEvidence[],caseId:string,ledger:RecoveryLedger){
  const base=await prepareRequestGraph4J(evidence,caseId,ledger),graph=augmentGraph(base,caseId),graphHypotheses=graph.hypotheses as P1RequestHypothesis[],packet:P1RequestHypothesis[]=[],seen=new Set<string>();let duplicateRenderedProbeUrlsRejected4k=0;
  for(const h of graphHypotheses){const check=renderCheck(h,caseId);if(check.kind!=="ok"||!check.url)continue;if(seen.has(check.url)){duplicateRenderedProbeUrlsRejected4k++;continue}seen.add(check.url);packet.push(h);if(packet.length>=FOUR_AP1_MAX_PROBES_PER_PROVIDER)break}
  return {...graph,probe_packet:packet,metrics:{...graph.metrics,requestHypotheses:graphHypotheses.length,uniqueRenderedProbeUrls:seen.size,duplicateRenderedProbeUrlsRejected4k,routeFamilyPacketHypotheses:packet.filter((h:P1RequestHypothesis)=>h.proof_type.startsWith("4k_route_family_")).length,expandedEvidenceHypotheses:graphHypotheses.filter((h:P1RequestHypothesis)=>h.evidence_ids.some((id:string)=>/^4[e-g]_ref_/.test(id))).length,noIrOperation:graph.semantics.operations.length===0,irOperationUnusable:graph.semantics.operations.length>0&&graphHypotheses.length===0}};
}
export function rebuildRequestGraph4K(evidence:DocEvidence[],caseId:string){return augmentGraph(rebuildRequestGraph4J(evidence,caseId),caseId)}
