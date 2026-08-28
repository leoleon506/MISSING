import type {DocEvidence} from "./experiment3wCore.js";
import type {RecoveryLedger} from "./experiment3yrCore.js";
import {FOUR_A_CASES} from "./experiment4aCore.js";
import {
  FOUR_AP1_MAX_PROBES_PER_PROVIDER,
  fourAp1Sha,
  type P1RequestHypothesis,
  type P1RequestSlot,
} from "./experiment4ap1Model.js";
import {compileRequestHypothesisP1,lexicalTokensP1} from "./experiment4ap1Request.js";
import {expandReferenceEvidence4E} from "./experiment4eRequest.js";
import {compileEvidenceNativeSemantics4G,type Operation4G} from "./experiment4gSemantics.js";
import type {IrParameter} from "./experiment4fIr.js";
import {alignTaskOperation4H} from "./experiment4hAlignment.js";

const AUTH_NAME=/^(?:api[_-]?key|apikey|key|token|access[_-]?token|secret|authorization|auth|client[_-]?id|client[_-]?secret)$/i;
const REQUIRED_AUTH_LOCAL=/(?:api[_ -]?key|token|authorization|bearer|oauth|basic auth).{0,100}(?:required|must|need|mandatory)|(?:required|must|need|mandatory).{0,100}(?:api[_ -]?key|token|authorization|bearer|oauth|basic auth)/i;
const GENERIC=new Set(["id","name","code","value","key","identifier"]);
const ACTION=new Set(["get","lookup","search","find","retrieve","fetch","decode","estimate","resolve","convert","list"]);
const ENTITY_NOISE=new Set(["given","public","machine","readable","api","operation","return","returns","canonical","current","human","identify","identifier","metadata","string","numeric","number","matching","queried","query","estimated"]);

type Metrics=Record<string,any>;
type StructuralRole={
  binding:string;
  param:IrParameter;
  score:number;
  path?:string;
  kind:"placeholder"|"path"|"query";
};

function paramsFor(s:any,op:Operation4G){
  return op.parameter_ids
    .map((id:string)=>s.parameters.find((p:IrParameter)=>p.id===id))
    .filter(Boolean) as IrParameter[];
}
function toks(v:string){return lexicalTokensP1(v)}
function stem(v:string){
  let s=v
    .replace(/([a-z0-9])([A-Z])/g,"$1_$2")
    .replace(/[^a-z0-9]+/gi,"_")
    .toLowerCase()
    .replace(/^_+|_+$/g,"");
  for(const suffix of ["_identifier","_name","_code","_id"]){
    if(s.endsWith(suffix)&&s.length>suffix.length){s=s.slice(0,-suffix.length);break}
  }
  return s;
}
function hasOverlap(a:Iterable<string>,b:Iterable<string>){
  const right=new Set(b);
  for(const x of a)if(right.has(x))return true;
  return false;
}
function semanticSignals(caseId:string,op:Operation4G,s:any){
  const c=FOUR_A_CASES.find(x=>x.case_id===caseId);
  if(!c)return {entity:false,action:false,output:false,count:0};
  const section=s.ir.sections.find((x:any)=>x.id===op.section_id);
  const opTokens=new Set(toks(`${op.title} ${section?.title||""} ${op.path} ${op.context}`));
  const intent=new Set(toks(c.intent||""));
  const outputs=new Set(c.required.flatMap(x=>toks(x)));
  const inputs=new Set(c.input_names.flatMap(x=>toks(x)));
  const taskActions=new Set([...intent].filter(x=>ACTION.has(x)));
  const opActions=new Set([...opTokens].filter(x=>ACTION.has(x)));
  const entityTokens=new Set([...intent].filter(x=>!ACTION.has(x)&&!outputs.has(x)&&!inputs.has(x)&&!ENTITY_NOISE.has(x)));
  const entity=hasOverlap(entityTokens,opTokens);
  const action=hasOverlap(taskActions,opActions);
  const output=hasOverlap(outputs,opTokens);
  return {entity,action,output,count:Number(entity)+Number(action)+Number(output)};
}
function sourceSectionText(evidence:DocEvidence[],s:any,op:Operation4G){
  const ev=evidence.find(e=>e.evidence_id===op.source.evidence_id);
  if(!ev)return "";
  const sec=s.ir.sections.find((x:any)=>x.id===op.section_id);
  const raw=String(ev.text||"");
  const start=Math.max(0,sec?.start??op.source.start??0);
  const end=Math.min(raw.length,sec?.end??op.source.end??raw.length);
  return raw.slice(start,end);
}
function decodeQueryName(raw:string){
  try{return decodeURIComponent(raw.replace(/\+/g," "))}catch{return raw}
}
function queryName(part:string){
  const eq=part.indexOf("=");
  return decodeQueryName(eq<0?part:part.slice(0,eq));
}
function placeholderNames(v:string){return [...v.matchAll(/\{([^}]+)\}/g)].map(m=>m[1])}
function pruneAuthQueryPreserving(path:string,metrics:Metrics){
  const q=path.indexOf("?");
  if(q<0){
    if(path.includes("{")){
      metrics.placeholderPreservationChecks++;
      if(placeholderNames(path).join("\u0000")!==placeholderNames(path).join("\u0000"))metrics.placeholderPreservationFailures++;
    }
    return path;
  }
  const head=path.slice(0,q);
  const parts=path.slice(q+1).split("&");
  const kept=parts.filter(part=>!AUTH_NAME.test(queryName(part)));
  const pruned=parts.length-kept.length;
  metrics.authPairsPrunedSurgically+=pruned;
  metrics.optionalAuthSlotsPruned+=pruned;
  const out=kept.length?`${head}?${kept.join("&")}`:head;
  const expectedNonAuth=kept.length?`${head}?${kept.join("&")}`:head;
  if(out!==expectedNonAuth)metrics.nonAuthRequestTextMutations++;
  if(path.includes("{")){
    metrics.placeholderPreservationChecks++;
    const expected=placeholderNames(expectedNonAuth);
    if(placeholderNames(out).join("\u0000")!==expected.join("\u0000"))metrics.placeholderPreservationFailures++;
  }
  return out;
}
function existingParam(params:IrParameter[],name:string,where:"path"|"query"){
  return params.find(p=>!p.auth_like&&p.in===where&&p.name===name)||null;
}
function exactOccurrences(haystack:string,needle:string){
  if(!needle)return [] as number[];
  const out:number[]=[];
  let at=0;
  while(true){
    const i=haystack.indexOf(needle,at);
    if(i<0)break;
    out.push(i);
    at=i+Math.max(1,needle.length);
  }
  return out;
}
function queryPairContaining(path:string,index:number){
  const q=path.indexOf("?");
  if(q<0||index<=q)return null;
  let start=q+1;
  for(const part of path.slice(q+1).split("&")){
    const end=start+part.length;
    if(index>=start&&index<end){
      const eq=part.indexOf("=");
      if(eq<0)return null;
      return {keyRaw:part.slice(0,eq),valueRaw:part.slice(eq+1)};
    }
    start=end+1;
  }
  return null;
}
function pathSegmentIsExact(path:string,index:number,value:string){
  const q=path.indexOf("?");
  const pathEnd=q<0?path.length:q;
  if(index>=pathEnd)return false;
  const left=index===0?"/":path[index-1];
  const right=index+value.length>=pathEnd?"/":path[index+value.length];
  return left==="/"&&right==="/";
}
function structuralRole(caseId:string,s:any,op:Operation4G,params:IrParameter[],metrics:Metrics):StructuralRole|null{
  const c=FOUR_A_CASES.find(x=>x.case_id===caseId);
  if(!c||c.input_names.length!==1)return null;
  const input=c.input_names[0];
  const value=String(c.build[input]??"");
  const signals=semanticSignals(caseId,op,s);
  metrics.identifierRoleCandidates++;

  const q=op.path.indexOf("?");
  for(const match of op.path.matchAll(/\{([^}]+)\}/g)){
    const idx=match.index??-1;
    if(q>=0&&idx>q)continue;
    const label=match[1];
    const morph=stem(label)===stem(input);
    const generic=GENERIC.has(stem(label));
    if(!morph&&!generic)continue;
    if(generic&&!morph&&signals.count<2){metrics.identifierRoleRejectedGeneric++;continue}
    if(morph&&signals.count<1){metrics.identifierRoleRejectedNoSemanticSupport++;continue}
    const p=existingParam(params,label,"path")||{
      id:`4i_path_${fourAp1Sha({op:op.id,label}).slice(0,12)}`,
      name:label,
      in:"path" as const,
      required:true,
      auth_like:false,
      example:null,
      description:"documented structural placeholder",
      section_id:op.section_id,
      source:op.source,
    };
    metrics.identifierRoleAcceptedPlaceholder++;
    metrics.identifierRoleAcceptedPathSegment++;
    return {binding:p.id,param:p,score:morph?20:16,kind:"placeholder"};
  }

  const occurrences=exactOccurrences(op.path,value);
  if(occurrences.length>1){metrics.identifierRoleRejectedAmbiguousOccurrence++;return null}
  if(occurrences.length===0){metrics.identifierRoleRejectedNoSemanticSupport++;return null}
  if(signals.count<1){metrics.identifierRoleRejectedNoSemanticSupport++;return null}
  const first=occurrences[0];

  if(q>=0&&first>q){
    const pair=queryPairContaining(op.path,first);
    if(!pair||pair.valueRaw!==value){metrics.identifierRoleRejectedNoSemanticSupport++;return null}
    const key=decodeQueryName(pair.keyRaw);
    if(AUTH_NAME.test(key)){metrics.identifierRoleRejectedAuthLike++;return null}
    const p=existingParam(params,key,"query")||{
      id:`4i_query_${fourAp1Sha({op:op.id,input,key,first}).slice(0,12)}`,
      name:key,
      in:"query" as const,
      required:true,
      auth_like:false,
      example:value,
      description:"unique documented build value query role",
      section_id:op.section_id,
      source:op.source,
    };
    metrics.identifierRoleAcceptedUniqueBuildValue++;
    metrics.identifierRoleAcceptedQueryKey++;
    return {binding:p.id,param:p,score:18,kind:"query"};
  }

  if(!pathSegmentIsExact(op.path,first,value)){
    metrics.identifierRoleRejectedNoSemanticSupport++;
    return null;
  }
  const path=`${op.path.slice(0,first)}{${input}}${op.path.slice(first+value.length)}`;
  const p:IrParameter={
    id:`4i_struct_${fourAp1Sha({op:op.id,input,first}).slice(0,12)}`,
    name:input,
    in:"path",
    required:true,
    auth_like:false,
    example:value,
    description:"unique documented build value path role",
    section_id:op.section_id,
    source:op.source,
  };
  metrics.identifierRoleAcceptedUniqueBuildValue++;
  metrics.identifierRoleAcceptedPathSegment++;
  return {binding:p.id,param:p,score:18,path,kind:"path"};
}
function makeHypothesis(caseId:string,s:any,op:Operation4G,metrics:Metrics,evidence:DocEvidence[]){
  metrics.alignmentCandidates++;
  const base=s.ir.api_bases.find((b:any)=>b.id===op.api_base_id);
  if(!base)return null;
  let params=paramsFor(s,op);
  let path=op.path;
  const originalSection=sourceSectionText(evidence,s,op);
  const localRequired=REQUIRED_AUTH_LOCAL.test(`${op.title} ${op.context}`)||REQUIRED_AUTH_LOCAL.test(originalSection);
  if(op.auth_class==="REQUIRED"||localRequired){
    metrics.requiredAuthSlotsBlocked+=params.filter(p=>p.auth_like).length||1;
    return null;
  }

  let alignment:any=alignTaskOperation4H(caseId,s,op,params,metrics);
  let structural:StructuralRole|null=null;
  if(!alignment.accepted&&alignment.reason==="no_identifier"){
    structural=structuralRole(caseId,s,op,params,metrics);
    if(!structural)return null;
    if(!params.some(p=>p.id===structural!.param.id))params=[...params,structural.param];
    path=structural.path||path;
    const c=FOUR_A_CASES.find(x=>x.case_id===caseId);
    if(!c)return null;
    alignment={
      accepted:true,
      bindings:{[c.input_names[0]]:structural.binding},
      score:10+structural.score,
      reason:"structural",
      signals:{identifier:1,entity:1,action:0,output:0,generic:false,concrete:structural.kind!=="placeholder",morphology:false},
    };
    metrics.alignmentAccepted++;
  }
  if(!alignment.accepted)return null;

  const bound=new Set(Object.values(alignment.bindings));
  const safeParams:IrParameter[]=[];
  for(const p of params){
    if(!p.auth_like){safeParams.push(p);continue}
    if(bound.has(p.id)){metrics.identifierRoleRejectedAuthLike++;return null}
    if(["OPTIONAL","RATE_LIMIT_UPGRADE","UNRELATED","UNKNOWN"].includes(op.auth_class))continue;
    metrics.requiredAuthSlotsBlocked++;
    return null;
  }

  if(path.includes("{"))metrics.placeholderBearingOperations++;
  const pruned=pruneAuthQueryPreserving(path,metrics);
  const slots:P1RequestSlot[]=safeParams.map(p=>({
    id:p.id,
    name:p.name,
    in:p.in==="path"?"path":"query",
    required:p.required===true,
    auth_like:false,
    literals:p.example!==null?[{id:`lit4i_${fourAp1Sha({p:p.id,v:p.example}).slice(0,16)}`,value:p.example}]:[],
  }));
  const literal_bindings:Record<string,string>={};
  for(const slot of slots){
    if(bound.has(slot.id))continue;
    if(slot.required&&slot.in==="path")return null;
    if(slot.required&&slot.in==="query"&&slot.literals.length!==1)return null;
    if(slot.required&&slot.in==="query"&&slot.literals.length===1){literal_bindings[slot.id]=slot.literals[0].id;continue}
    if(slot.literals.length===1&&/json/i.test(slot.literals[0].value)&&/(?:format|response|output|type)/i.test(slot.name))literal_bindings[slot.id]=slot.literals[0].id;
  }

  return {
    id:`req4i_${fourAp1Sha({op:op.id,base:base.id,path:pruned,input:alignment.bindings,literal_bindings}).slice(0,16)}`,
    source_operation_id:op.id,
    origin:base.origin,
    full_path:pruned,
    proof_type:`4i_structural_identifier_role_${op.form}_${op.api_base_relation||"absolute"}`,
    evidence_ids:[op.source.evidence_id,base.source.evidence_id],
    source_urls:[op.source.source_url,base.source.source_url],
    slots,
    input_bindings:alignment.bindings,
    literal_bindings,
    score:1000+alignment.score+(structural?40:0)+(op.source.expanded?30:0),
    concrete_relation:structural!==null||op.absolute_url===null,
  } as P1RequestHypothesis;
}
function renderedAuthLike(h:P1RequestHypothesis,caseId:string){
  const c=FOUR_A_CASES.find(x=>x.case_id===caseId);
  if(!c)return true;
  let url="";
  try{url=compileRequestHypothesisP1(h,c.build)}catch{return true}
  let parsed:URL;
  try{parsed=new URL(url)}catch{return true}
  for(const [name] of parsed.searchParams)if(AUTH_NAME.test(name))return true;
  return h.slots.some(slot=>slot.auth_like);
}
function initialMetrics(semantics:any):Metrics{
  return {
    ...semantics.metrics,
    alignmentCandidates:0,
    alignmentAccepted:0,
    alignmentRejectedNoIdentifier:0,
    alignmentRejectedInsufficientSupport:0,
    alignmentRejectedGenericIdentifier:0,
    alignmentAcceptedByConcreteExample:0,
    alignmentAcceptedByMorphology:0,
    alignmentScoreHistogram:{},
    operationFrameCandidates:0,
    operationFrameWithIdentifierSignal:0,
    operationFrameWithEntitySignal:0,
    operationFrameWithActionSignal:0,
    operationFrameWithOutputSignal:0,
    optionalAuthSlotsPruned:0,
    requiredAuthSlotsBlocked:0,
    authLikeHypothesesRejectedBeforeRender:0,
    placeholderBearingOperations:0,
    placeholderPreservationChecks:0,
    placeholderPreservationFailures:0,
    authPairsPrunedSurgically:0,
    nonAuthRequestTextMutations:0,
    identifierRoleCandidates:0,
    identifierRoleAcceptedNamedParameter:0,
    identifierRoleAcceptedPlaceholder:0,
    identifierRoleAcceptedUniqueBuildValue:0,
    identifierRoleAcceptedQueryKey:0,
    identifierRoleAcceptedPathSegment:0,
    identifierRoleRejectedAmbiguousOccurrence:0,
    identifierRoleRejectedNoSemanticSupport:0,
    identifierRoleRejectedGeneric:0,
    identifierRoleRejectedAuthLike:0,
  };
}
function buildGraph(evidence:DocEvidence[],caseId:string){
  const semantics=compileEvidenceNativeSemantics4G(evidence);
  const metrics=initialMetrics(semantics);
  const built=semantics.operations
    .map(op=>makeHypothesis(caseId,semantics,op,metrics,evidence))
    .filter(Boolean) as P1RequestHypothesis[];
  const dedup=new Map<string,P1RequestHypothesis>();
  for(const h of built){
    const key=fourAp1Sha({origin:h.origin,path:h.full_path,inputs:h.input_bindings,literals:h.literal_bindings});
    const prior=dedup.get(key);
    if(!prior||h.score>prior.score)dedup.set(key,h);
  }
  const hypotheses=[...dedup.values()].sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id));
  return {
    semantics,
    hypotheses,
    metrics,
    graph_fingerprint:fourAp1Sha({s:semantics.fingerprint,h:hypotheses.map(h=>h.id)}),
  };
}
export async function prepareRequestGraph4I(evidence:DocEvidence[],caseId:string,ledger:RecoveryLedger){
  const expansion=await expandReferenceEvidence4E(evidence,ledger,3);
  const graph=buildGraph(evidence,caseId);
  const packet:P1RequestHypothesis[]=[];
  const seen=new Set<string>();
  let authLikeRenderedRequests=0,duplicateRenderedProbeUrlsRejected=0;
  const c=FOUR_A_CASES.find(x=>x.case_id===caseId);
  for(const h of graph.hypotheses){
    if(!c)break;
    if(renderedAuthLike(h,caseId)){authLikeRenderedRequests++;continue}
    let url:string;
    try{url=compileRequestHypothesisP1(h,c.build)}catch{continue}
    if(seen.has(url)){duplicateRenderedProbeUrlsRejected++;continue}
    seen.add(url);
    packet.push(h);
    if(packet.length>=FOUR_AP1_MAX_PROBES_PER_PROVIDER)break;
  }
  return {
    ...graph,
    probe_packet:packet,
    metrics:{
      ...graph.metrics,
      ...expansion,
      authLikeRenderedRequests,
      knownAuthProbeAttempts:0,
      wrongTaskProbeAttempts:0,
      requestHypotheses:graph.hypotheses.length,
      uniqueRenderedProbeUrls:seen.size,
      duplicateRenderedProbeUrlsRejected,
      documentationOriginFallbacks:0,
      standaloneUrlPromotions:0,
      noIrOperation:graph.semantics.operations.length===0,
      irOperationUnusable:graph.semantics.operations.length>0&&graph.hypotheses.length===0,
      expandedEvidenceHypotheses:graph.hypotheses.filter(h=>graph.semantics.operations.find(o=>o.id===h.source_operation_id)?.source.expanded).length,
    },
  };
}
export function rebuildRequestGraph4I(evidence:DocEvidence[],caseId:string){
  const graph=buildGraph(evidence,caseId);
  const hypotheses=graph.hypotheses.filter(h=>!renderedAuthLike(h,caseId));
  return {
    ...graph,
    hypotheses,
    graph_fingerprint:fourAp1Sha({s:graph.semantics.fingerprint,h:hypotheses.map(h=>h.id)}),
  };
}
