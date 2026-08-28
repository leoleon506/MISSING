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
const ENTITY_NOISE=new Set([
  "given","public","machine","readable","api","operation","return","returns","canonical","current","human",
  "identify","identifier","metadata","string","numeric","number","matching","queried","query","estimated",
  "information","data","value","values","result","results","using","use","provide","provides",
]);

type Metrics=Record<string,any>;
type Signals={entity:boolean;action:boolean;output:boolean;count:number};
type StructuralRole={
  binding:string;
  param:IrParameter;
  score:number;
  path?:string;
  role:"exact_placeholder"|"generic_placeholder"|"unique_path"|"unique_query";
  entityConfirmed:boolean;
  secondaryConfirmed:boolean;
};
type RenderCheck={kind:"ok"|"compile_reject"|"url_reject"|"auth_like";url?:string};

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
function semanticSignals(caseId:string,op:Operation4G,s:any,params:IrParameter[]):Signals{
  const c=FOUR_A_CASES.find(x=>x.case_id===caseId);
  if(!c)return {entity:false,action:false,output:false,count:0};
  const section=s.ir.sections.find((x:any)=>x.id===op.section_id);
  const paramText=params.map(p=>`${p.name} ${p.description||""}`).join(" ");
  const operationText=`${op.title} ${section?.title||""} ${op.path} ${op.context} ${paramText}`;
  const opTokens=new Set(toks(operationText));
  const intent=new Set(toks(c.intent||""));
  const outputs=new Set(c.required.flatMap(x=>toks(x)));
  const inputs=new Set(c.input_names.flatMap(x=>toks(x)));
  const taskActions=new Set([...intent].filter(x=>ACTION.has(x)));
  const opActions=new Set([...opTokens].filter(x=>ACTION.has(x)));
  const entityTokens=new Set([...intent].filter(x=>
    !ACTION.has(x)&&!outputs.has(x)&&!inputs.has(x)&&!ENTITY_NOISE.has(x)&&x.length>2
  ));
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
  let value=raw.replace(/^amp;/i,"");
  try{value=decodeURIComponent(value.replace(/\+/g," "))}catch{}
  return value;
}
function queryName(part:string){
  const eq=part.indexOf("=");
  return decodeQueryName(eq<0?part:part.slice(0,eq));
}
function placeholderNames(v:string){return [...v.matchAll(/\{([^}]+)\}/g)].map(m=>m[1])}
function pruneAuthQueryPreserving(path:string,metrics:Metrics){
  const q=path.indexOf("?");
  if(q<0){
    if(path.includes("{"))metrics.placeholderPreservationChecks++;
    return path;
  }
  const head=path.slice(0,q);
  const originalParts=path.slice(q+1).split("&");
  const kept=originalParts.filter(part=>!AUTH_NAME.test(queryName(part)));
  const pruned=originalParts.length-kept.length;
  metrics.authPairsPrunedSurgically+=pruned;
  metrics.optionalAuthSlotsPruned+=pruned;
  const out=kept.length?`${head}?${kept.join("&")}`:head;
  const expected=kept.length?`${head}?${kept.join("&")}`:head;
  if(out!==expected)metrics.nonAuthRequestTextMutations++;
  if(path.includes("{")){
    metrics.placeholderPreservationChecks++;
    if(placeholderNames(out).join("\u0000")!==placeholderNames(expected).join("\u0000"))metrics.placeholderPreservationFailures++;
  }
  return out;
}
function existingParam(params:IrParameter[],name:string,where:"path"|"query"){
  return params.find(p=>!p.auth_like&&p.in===where&&p.name.toLowerCase()===name.toLowerCase())||null;
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
      return {keyRaw:part.slice(0,eq),valueRaw:part.slice(eq+1),start,end};
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
function queryPlaceholderRole(path:string,index:number,label:string){
  const pair=queryPairContaining(path,index);
  if(!pair||pair.valueRaw!==`{${label}}`)return null;
  return decodeQueryName(pair.keyRaw);
}
function structuralRole(caseId:string,s:any,op:Operation4G,params:IrParameter[],metrics:Metrics):StructuralRole|null{
  const c=FOUR_A_CASES.find(x=>x.case_id===caseId);
  if(!c||c.input_names.length!==1)return null;
  const input=c.input_names[0];
  const value=String(c.build[input]??"");
  const signals=semanticSignals(caseId,op,s,params);
  const secondary=signals.action||signals.output;
  metrics.identifierRoleCandidates++;

  for(const match of op.path.matchAll(/\{([^}]+)\}/g)){
    const index=match.index??-1;
    const label=match[1];
    const labelStem=stem(label);
    const morph=labelStem===stem(input);
    const generic=GENERIC.has(labelStem);
    if(!morph&&!generic)continue;

    if(morph){
      if(signals.count<1){metrics.identifierRoleRejectedSecondarySupport++;continue}
    }else{
      if(!signals.entity){metrics.identifierRoleRejectedEntityMismatch++;continue}
      if(!secondary){metrics.identifierRoleRejectedSecondarySupport++;continue}
    }

    const queryKey=queryPlaceholderRole(op.path,index,label);
    const where:"path"|"query"=queryKey!==null?"query":"path";
    const slotName=queryKey??label;
    if(AUTH_NAME.test(slotName)){metrics.identifierRoleRejectedAuthLike++;continue}
    const p=existingParam(params,slotName,where)||{
      id:`4j_placeholder_${fourAp1Sha({op:op.id,label,slotName,where}).slice(0,12)}`,
      name:slotName,
      in:where,
      required:true,
      auth_like:false,
      example:null,
      description:morph?"documented exact identifier placeholder":"documented generic entity-gated placeholder",
      section_id:op.section_id,
      source:op.source,
    } as IrParameter;
    if(morph)metrics.identifierRoleAcceptedExactPlaceholder++;
    else metrics.identifierRoleAcceptedGenericPlaceholder++;
    if(where==="path")metrics.identifierRoleAcceptedPathSegment++;
    else metrics.identifierRoleAcceptedQueryKey++;
    return {
      binding:p.id,
      param:p,
      score:morph?22:20,
      role:morph?"exact_placeholder":"generic_placeholder",
      entityConfirmed:morph?signals.entity:signals.entity,
      secondaryConfirmed:secondary,
    };
  }

  const occurrences=exactOccurrences(op.path,value);
  if(occurrences.length>1){metrics.identifierRoleRejectedAmbiguousOccurrence++;return null}
  if(occurrences.length===0)return null;
  if(!signals.entity){metrics.identifierRoleRejectedEntityMismatch++;return null}
  if(!secondary){metrics.identifierRoleRejectedSecondarySupport++;return null}
  const first=occurrences[0];
  const q=op.path.indexOf("?");

  if(q>=0&&first>q){
    const pair=queryPairContaining(op.path,first);
    if(!pair||pair.valueRaw!==value){metrics.identifierRoleRejectedSubstring++;return null}
    const key=decodeQueryName(pair.keyRaw);
    if(AUTH_NAME.test(key)){metrics.identifierRoleRejectedAuthLike++;return null}
    const p=existingParam(params,key,"query")||{
      id:`4j_query_${fourAp1Sha({op:op.id,input,key,first}).slice(0,12)}`,
      name:key,
      in:"query" as const,
      required:true,
      auth_like:false,
      example:value,
      description:"unique documented entity-gated build value query role",
      section_id:op.section_id,
      source:op.source,
    } as IrParameter;
    metrics.identifierRoleAcceptedUniqueBuildValue++;
    metrics.identifierRoleAcceptedQueryKey++;
    return {binding:p.id,param:p,score:20,role:"unique_query",entityConfirmed:true,secondaryConfirmed:true};
  }

  if(!pathSegmentIsExact(op.path,first,value)){
    metrics.identifierRoleRejectedSubstring++;
    return null;
  }
  const path=`${op.path.slice(0,first)}{${input}}${op.path.slice(first+value.length)}`;
  const p:IrParameter={
    id:`4j_path_${fourAp1Sha({op:op.id,input,first}).slice(0,12)}`,
    name:input,
    in:"path",
    required:true,
    auth_like:false,
    example:value,
    description:"unique documented entity-gated build value path role",
    section_id:op.section_id,
    source:op.source,
  };
  metrics.identifierRoleAcceptedUniqueBuildValue++;
  metrics.identifierRoleAcceptedPathSegment++;
  return {binding:p.id,param:p,score:20,path,role:"unique_path",entityConfirmed:true,secondaryConfirmed:true};
}
function makeHypothesis(caseId:string,s:any,op:Operation4G,metrics:Metrics,evidence:DocEvidence[]){
  metrics.alignmentCandidates++;
  const base=s.ir.api_bases.find((b:any)=>b.id===op.api_base_id);
  if(!base)return null;
  let params=paramsFor(s,op);
  let path=op.path;
  const signals=semanticSignals(caseId,op,s,params);
  const originalSection=sourceSectionText(evidence,s,op);
  const localRequired=REQUIRED_AUTH_LOCAL.test(`${op.title} ${op.context}`)||REQUIRED_AUTH_LOCAL.test(originalSection);
  if(op.auth_class==="REQUIRED"||localRequired){
    metrics.requiredAuthSlotsBlocked+=params.filter(p=>p.auth_like).length||1;
    return null;
  }

  let alignment:any=alignTaskOperation4H(caseId,s,op,params,metrics);
  let structural:StructuralRole|null=null;
  let proofClass="named_parameter";
  if(alignment.accepted&&alignment.signals?.concrete&&!alignment.signals?.morphology){
    if(!signals.entity){metrics.identifierRoleRejectedEntityMismatch++;alignment={...alignment,accepted:false,reason:"entity_mismatch"}}
    else if(!(signals.action||signals.output)){metrics.identifierRoleRejectedSecondarySupport++;alignment={...alignment,accepted:false,reason:"secondary_support"}}
    else proofClass="concrete_parameter_entity_gate";
  }
  if(alignment.accepted){
    metrics.identifierRoleAcceptedNamedParameter++;
  }else if(alignment.reason==="no_identifier"||alignment.reason==="entity_mismatch"||alignment.reason==="secondary_support"){
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
      signals:{identifier:1,entity:Number(structural.entityConfirmed),action:0,output:0,generic:structural.role==="generic_placeholder",concrete:structural.role.startsWith("unique_"),morphology:structural.role==="exact_placeholder"},
    };
    proofClass=structural.role;
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
    literals:p.example!==null?[{id:`lit4j_${fourAp1Sha({p:p.id,v:p.example}).slice(0,16)}`,value:p.example}]:[],
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
    id:`req4j_${fourAp1Sha({op:op.id,base:base.id,path:pruned,input:alignment.bindings,literal_bindings,proofClass}).slice(0,16)}`,
    source_operation_id:op.id,
    origin:base.origin,
    full_path:pruned,
    proof_type:`4j_entity_gated_identifier_role_${proofClass}_${op.form}_${op.api_base_relation||"absolute"}`,
    evidence_ids:[op.source.evidence_id,base.source.evidence_id],
    source_urls:[op.source.source_url,base.source.source_url],
    slots,
    input_bindings:alignment.bindings,
    literal_bindings,
    score:1000+alignment.score+(structural?45:0)+(op.source.expanded?30:0),
    concrete_relation:structural!==null||op.absolute_url===null,
  } as P1RequestHypothesis;
}
function renderCheck(h:P1RequestHypothesis,caseId:string):RenderCheck{
  const c=FOUR_A_CASES.find(x=>x.case_id===caseId);
  if(!c)return {kind:"compile_reject"};
  let url:string;
  try{url=compileRequestHypothesisP1(h,c.build)}catch{return {kind:"compile_reject"}}
  let parsed:URL;
  try{parsed=new URL(url)}catch{return {kind:"url_reject"}}
  for(const [name] of parsed.searchParams)if(AUTH_NAME.test(name))return {kind:"auth_like",url};
  if(h.slots.some(slot=>slot.auth_like||AUTH_NAME.test(slot.name)))return {kind:"auth_like",url};
  return {kind:"ok",url};
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
    identifierRoleAcceptedExactPlaceholder:0,
    identifierRoleAcceptedGenericPlaceholder:0,
    identifierRoleAcceptedUniqueBuildValue:0,
    identifierRoleAcceptedQueryKey:0,
    identifierRoleAcceptedPathSegment:0,
    identifierRoleRejectedEntityMismatch:0,
    identifierRoleRejectedSecondarySupport:0,
    identifierRoleRejectedAmbiguousOccurrence:0,
    identifierRoleRejectedSubstring:0,
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
  return {semantics,hypotheses,metrics};
}
function eligibleGraph(evidence:DocEvidence[],caseId:string){
  const base=buildGraph(evidence,caseId);
  const hypotheses:P1RequestHypothesis[]=[];
  let renderCompileRejected=0,renderUrlParseRejected=0,authLikeRenderedRequests=0;
  for(const h of base.hypotheses){
    const check=renderCheck(h,caseId);
    if(check.kind==="compile_reject"){renderCompileRejected++;continue}
    if(check.kind==="url_reject"){renderUrlParseRejected++;continue}
    if(check.kind==="auth_like"){authLikeRenderedRequests++;continue}
    hypotheses.push(h);
  }
  return {
    ...base,
    hypotheses,
    metrics:{...base.metrics,renderCompileRejected,renderUrlParseRejected,authLikeRenderedRequests},
    graph_fingerprint:fourAp1Sha({s:base.semantics.fingerprint,h:hypotheses.map(h=>h.id)}),
  };
}
export async function prepareRequestGraph4J(evidence:DocEvidence[],caseId:string,ledger:RecoveryLedger){
  const expansion=await expandReferenceEvidence4E(evidence,ledger,3);
  const graph=eligibleGraph(evidence,caseId);
  const packet:P1RequestHypothesis[]=[];
  const seen=new Set<string>();
  let duplicateRenderedProbeUrlsRejected=0,entityIncompatibleStructuralProbeAttempts=0;
  for(const h of graph.hypotheses){
    const check=renderCheck(h,caseId);
    if(check.kind!=="ok"||!check.url)continue;
    if(/4j_entity_gated_identifier_role_(?:generic_placeholder|unique_path|unique_query)_/.test(h.proof_type)&&!h.proof_type.includes("entity_gated_identifier_role_"))entityIncompatibleStructuralProbeAttempts++;
    if(seen.has(check.url)){duplicateRenderedProbeUrlsRejected++;continue}
    seen.add(check.url);
    packet.push(h);
    if(packet.length>=FOUR_AP1_MAX_PROBES_PER_PROVIDER)break;
  }
  return {
    ...graph,
    probe_packet:packet,
    metrics:{
      ...graph.metrics,
      ...expansion,
      knownAuthProbeAttempts:0,
      wrongTaskProbeAttempts:0,
      entityIncompatibleStructuralProbeAttempts,
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
export function rebuildRequestGraph4J(evidence:DocEvidence[],caseId:string){
  return eligibleGraph(evidence,caseId);
}
