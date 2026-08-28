import type {DocEvidence} from "./experiment3wCore.js";
import type {RecoveryLedger} from "./experiment3yrCore.js";
import {FOUR_A_CASES} from "./experiment4aCore.js";
import {FOUR_AP1_MAX_PROBES_PER_PROVIDER,fourAp1Sha,type P1RequestHypothesis,type P1RequestSlot} from "./experiment4ap1Model.js";
import {compileRequestHypothesisP1,lexicalTokensP1} from "./experiment4ap1Request.js";
import {prepareRequestGraph4J,rebuildRequestGraph4J} from "./experiment4jRequest.js";
import type {Operation4G,SemanticIr4G} from "./experiment4gSemantics.js";

const AUTH_NAME=/^(?:api[_-]?key|apikey|key|token|access[_-]?token|secret|authorization|auth|client[_-]?id|client[_-]?secret)$/i;
const ASSET_EXT=/\.(?:js|mjs|css|map|png|jpe?g|gif|svg|webp|ico|bmp|avif|woff2?|ttf|otf|eot|mp4|webm|mp3|wav|pdf)(?:$|[?#])/i;
const ASSET_SEG=/(?:^|\/)(?:static|assets?|images?|img|icons?|logos?|fonts?|styles?|scripts?|css|js|media|thumbnails?|avatars?|_next\/image)(?:\/|$)/i;
const NAV_SEG=/(?:^|\/)(?:docs?|documentation|help|support|blog|about|contact|login|signin|signup|register|pricing|careers?|press|terms|privacy|downloads?)(?:\/|$)/i;
const API_PATH=/(?:^|\/)(?:api|v\d+|rest|graphql|query|search|lookup|decode|vehicles?|products?|objects?|resources?|records?)(?:\/|$|\?)/i;
const API_CTX=/(?:\bapi\b|endpoint|request|response|developer|reference|resource|lookup|search|query|decode|retrieve|fetch|operation)/i;
const RESPONSE_CTX=/(?:response|returns?|returned|json|schema|fields?|result|payload|data object|response body)/i;
const ACTION=new Set(["get","lookup","search","find","retrieve","fetch","decode","estimate","resolve","convert","list","identify"]);
const ENTITY_NOISE=new Set(["given","public","machine","readable","api","operation","return","returns","canonical","current","human","identify","identifier","identification","metadata","string","numeric","number","matching","queried","query","estimated","information","data","value","values","result","results","using","use","provide","provides"]);

type Metrics=Record<string,number|boolean>;
type QueryPart={keyRaw:string;key:string;valueRaw:string;valueNorm:string;auth:boolean};
type ParsedOp={op:Operation4G;origin:string;baseSourceId:string;baseSourceUrl:string;segmentsRaw:string[];segmentsNorm:string[];queryRaw:QueryPart[];positive:string[]};
type Position={kind:"path";index:number}|{kind:"query";key:string};
type CandidateMember={parsed:ParsedOp;valueRaw:string;valueNorm:string};
type CandidateFamily={signature:string;position:Position;members:Map<string,CandidateMember>};
type Signals={entity:boolean;action:boolean;output:boolean;count:number};
type RenderCheck={kind:"ok"|"compile_reject"|"url_reject"|"auth_like";url?:string};
export type ExecutableGateDecision4L={accepted:boolean;reason:"accepted"|"asset"|"navigation"|"documentation"|"no_positive_signal";positive:string[]};

function toks(v:string){return lexicalTokensP1(v)}
function norm(v:string){let x=v;try{x=decodeURIComponent(v.replace(/\+/g," "))}catch{}return x.trim().toLowerCase()}
function qname(v:string){return norm(v.replace(/^amp;/i,""))}
function splitPath(path:string){const q=path.indexOf("?");return {head:q<0?path:path.slice(0,q),query:q<0?"":path.slice(q+1)}}
function parseQuery(raw:string):QueryPart[]{if(!raw)return [];return raw.split("&").filter(Boolean).map(part=>{const eq=part.indexOf("="),keyRaw=eq<0?part:part.slice(0,eq),valueRaw=eq<0?"":part.slice(eq+1),key=qname(keyRaw);return {keyRaw,key,valueRaw,valueNorm:norm(valueRaw),auth:AUTH_NAME.test(key)}})}
function sourceTargetEqual(op:Operation4G){if(!op.absolute_url)return false;try{const a=new URL(op.absolute_url),b=new URL(op.source.source_url);return a.origin===b.origin&&a.pathname.replace(/\/$/,"")===b.pathname.replace(/\/$/,"")&&a.search===b.search}catch{return false}}

export function executableOperationDecision4L(semantics:SemanticIr4G,op:Operation4G):ExecutableGateDecision4L{
  const base=semantics.ir.api_bases.find((b:any)=>b.id===op.api_base_id),origin=base?.origin||op.absolute_url||"";
  const ctx=`${op.title} ${op.context}`,target=`${origin}${op.path}`;
  if(ASSET_EXT.test(op.path)||ASSET_SEG.test(op.path))return {accepted:false,reason:"asset",positive:[]};
  if(sourceTargetEqual(op)&&["table_or_link","relative","4f"].includes(op.form))return {accepted:false,reason:"documentation",positive:[]};
  if(NAV_SEG.test(op.path)&&!API_PATH.test(op.path))return {accepted:false,reason:"navigation",positive:[]};
  const positive:string[]=[];
  if(op.form==="openapi")positive.push("openapi");
  if(op.form==="explicit_http")positive.push("explicit_request");
  if(op.form==="endpoint_label")positive.push("endpoint_label");
  if(RESPONSE_CTX.test(ctx))positive.push("response_data_context");
  if(op.api_base_id&&op.api_base_relation)positive.push("api_base_relation");
  if(API_PATH.test(op.path)&&API_CTX.test(ctx))positive.push("api_path_context");
  try{const h=new URL(base?.origin||op.absolute_url||"https://invalid.example").hostname;if(/^(?:api|services?)[.-]|[.-]api[.-]/i.test(h)&&API_CTX.test(ctx))positive.push("api_host_context")}catch{}
  const accepted=positive.some(p=>p==="openapi"||p==="endpoint_label"||p==="explicit_request"||p==="response_data_context"||p==="api_path_context"||p==="api_host_context") || (positive.includes("api_base_relation")&&API_CTX.test(ctx));
  return accepted?{accepted:true,reason:"accepted",positive:[...new Set(positive)]}:{accepted:false,reason:"no_positive_signal",positive};
}

function safeParsed(semantics:SemanticIr4G,op:Operation4G,decision:ExecutableGateDecision4L):ParsedOp|null{
  if(!decision.accepted||op.method!=="GET"||op.auth_class==="REQUIRED"||!op.api_base_id||/[{}]/.test(op.path))return null;
  const base=semantics.ir.api_bases.find((b:any)=>b.id===op.api_base_id);if(!base)return null;
  const {head,query}=splitPath(op.path),segmentsRaw=head.split("/"),segmentsNorm=segmentsRaw.map(norm),queryRaw=parseQuery(query);
  if(queryRaw.some(q=>q.auth&&q.valueRaw.includes("{")))return null;
  return {op,origin:base.origin,baseSourceId:base.source.evidence_id,baseSourceUrl:base.source.source_url,segmentsRaw,segmentsNorm,queryRaw,positive:decision.positive};
}
function fixedQuery(p:ParsedOp,wildcard:string|null){return p.queryRaw.filter(q=>!q.auth).map(q=>[q.key,q.key===wildcard?"*":q.valueNorm] as const).sort((a,b)=>a[0].localeCompare(b[0]))}
function signature(p:ParsedOp,pos:Position){const segs=[...p.segmentsNorm];if(pos.kind==="path")segs[pos.index]="*";return fourAp1Sha({m:p.op.method,o:p.origin,s:segs,q:fixedQuery(p,pos.kind==="query"?pos.key:null),pos})}
function valueAt(p:ParsedOp,pos:Position){if(pos.kind==="path")return {raw:p.segmentsRaw[pos.index]||"",normalized:p.segmentsNorm[pos.index]||""};const q=p.queryRaw.find(x=>!x.auth&&x.key===pos.key);return {raw:q?.valueRaw||"",normalized:q?.valueNorm||""}}
function hasOverlap(a:Iterable<string>,b:Iterable<string>){const right=new Set(b);for(const x of a)if(right.has(x))return true;return false}
function semanticSignals(caseId:string,semantics:SemanticIr4G,members:CandidateMember[]):Signals{
  const c=FOUR_A_CASES.find(x=>x.case_id===caseId);if(!c)return {entity:false,action:false,output:false,count:0};
  const text=members.map(({parsed})=>{const sec=semantics.ir.sections.find((s:any)=>s.id===parsed.op.section_id);return `${parsed.op.title} ${sec?.title||""} ${parsed.op.path} ${parsed.op.context}`}).join(" ");
  const opTokens=new Set(toks(text)),intent=new Set(toks(c.intent||"")),outputs=new Set(c.required.flatMap(x=>toks(x))),inputs=new Set(c.input_names.flatMap(x=>toks(x)));
  const taskActions=new Set([...intent].filter(x=>ACTION.has(x))),opActions=new Set([...opTokens].filter(x=>ACTION.has(x)));
  const entityTokens=new Set([...intent].filter(x=>!ACTION.has(x)&&!outputs.has(x)&&!inputs.has(x)&&!ENTITY_NOISE.has(x)&&x.length>2));
  const entity=hasOverlap(entityTokens,opTokens),action=taskActions.size>0&&opActions.size>0,output=hasOverlap(outputs,opTokens);
  return {entity,action,output,count:Number(entity)+Number(action)+Number(output)};
}
function removeAuth(path:string){const q=path.indexOf("?");if(q<0)return path;const head=path.slice(0,q),kept=path.slice(q+1).split("&").filter(part=>!AUTH_NAME.test(qname(part.split("=",1)[0]||"")));return kept.length?`${head}?${kept.join("&")}`:head}
function template(rep:ParsedOp,pos:Position,input:string){let path=removeAuth(rep.op.path);if(pos.kind==="path"){const {head,query}=splitPath(path),segs=head.split("/");segs[pos.index]=`{${input}}`;path=segs.join("/")+(query?`?${query}`:"")}return path}
function renderCheck(h:P1RequestHypothesis,caseId:string):RenderCheck{const c=FOUR_A_CASES.find(x=>x.case_id===caseId);if(!c)return {kind:"compile_reject"};let url:string;try{url=compileRequestHypothesisP1(h,c.build)}catch{return {kind:"compile_reject"}}let u:URL;try{u=new URL(url)}catch{return {kind:"url_reject"}}for(const [name] of u.searchParams)if(AUTH_NAME.test(qname(name)))return {kind:"auth_like",url};if(h.slots.some(s=>s.auth_like||AUTH_NAME.test(qname(s.name))))return {kind:"auth_like",url};return {kind:"ok",url}}
function metrics0():Metrics{return {executableGateCandidates:0,executableGateAccepted:0,executableGateRejectedAsset:0,executableGateRejectedNavigation:0,executableGateRejectedDocumentation:0,executableGateRejectedNoPositiveSignal:0,executableGateAcceptedByOpenApi:0,executableGateAcceptedByExplicitRequest:0,executableGateAcceptedByEndpointLabel:0,executableGateAcceptedByResponseDataContext:0,executableGateAcceptedByApiBaseRelation:0,executableGateRouteFamilyHypotheses:0,routeFamilyCandidates:0,routeFamiliesAccepted:0,routeFamiliesRejectedInsufficientMembers:0,routeFamiliesRejectedMultipleVariablePositions:0,routeFamiliesRejectedOriginMismatch:0,routeFamiliesRejectedQueryShapeMismatch:0,routeFamiliesRejectedAuthLike:0,routeFamilyMembers:0,routeFamilyInducedPathSlots:0,routeFamilyInducedQuerySlots:0,routeFamilyDistinctObservedValues:0,routeFamilyShapeSupportedBindings:0,routeFamilyEntityRejectedBindings:0,routeFamilySecondarySupportRejectedBindings:0,routeFamilyHypotheses:0}}

export function induceExecutableRouteFamilies4L(semantics:SemanticIr4G,caseId:string){
  const metrics=metrics0(),eligible:ParsedOp[]=[];
  for(const op of semantics.operations){metrics.executableGateCandidates=Number(metrics.executableGateCandidates)+1;const d=executableOperationDecision4L(semantics,op);if(!d.accepted){const k=d.reason==="asset"?"executableGateRejectedAsset":d.reason==="navigation"?"executableGateRejectedNavigation":d.reason==="documentation"?"executableGateRejectedDocumentation":"executableGateRejectedNoPositiveSignal";metrics[k]=Number(metrics[k])+1;continue}metrics.executableGateAccepted=Number(metrics.executableGateAccepted)+1;if(d.positive.includes("openapi"))metrics.executableGateAcceptedByOpenApi=Number(metrics.executableGateAcceptedByOpenApi)+1;if(d.positive.includes("explicit_request"))metrics.executableGateAcceptedByExplicitRequest=Number(metrics.executableGateAcceptedByExplicitRequest)+1;if(d.positive.includes("endpoint_label"))metrics.executableGateAcceptedByEndpointLabel=Number(metrics.executableGateAcceptedByEndpointLabel)+1;if(d.positive.includes("response_data_context"))metrics.executableGateAcceptedByResponseDataContext=Number(metrics.executableGateAcceptedByResponseDataContext)+1;if(d.positive.includes("api_base_relation"))metrics.executableGateAcceptedByApiBaseRelation=Number(metrics.executableGateAcceptedByApiBaseRelation)+1;const p=safeParsed(semantics,op,d);if(p)eligible.push(p)}
  const families=new Map<string,CandidateFamily>();
  const add=(p:ParsedOp,pos:Position)=>{metrics.routeFamilyCandidates=Number(metrics.routeFamilyCandidates)+1;const sig=signature(p,pos),f=families.get(sig)||{signature:sig,position:pos,members:new Map<string,CandidateMember>()},v=valueAt(p,pos);f.members.set(p.op.id,{parsed:p,valueRaw:v.raw,valueNorm:v.normalized});families.set(sig,f)};
  for(const p of eligible){for(let i=0;i<p.segmentsNorm.length;i++)if(p.segmentsNorm[i])add(p,{kind:"path",index:i});for(const q of p.queryRaw)if(!q.auth&&q.valueNorm)add(p,{kind:"query",key:q.key})}
  const c=FOUR_A_CASES.find(x=>x.case_id===caseId),hypotheses:P1RequestHypothesis[]=[];if(!c||c.input_names.length!==1)return {hypotheses,metrics};const input=c.input_names[0];
  for(const f of families.values()){
    const members=[...f.members.values()],values=[...new Set(members.map(m=>m.valueNorm).filter(Boolean))];if(members.length<2||values.length<2){metrics.routeFamiliesRejectedInsufficientMembers=Number(metrics.routeFamiliesRejectedInsufficientMembers)+1;continue}
    const signals=semanticSignals(caseId,semantics,members);if(!signals.entity){metrics.routeFamilyEntityRejectedBindings=Number(metrics.routeFamilyEntityRejectedBindings)+1;continue}if(!(signals.action||signals.output)){metrics.routeFamilySecondarySupportRejectedBindings=Number(metrics.routeFamilySecondarySupportRejectedBindings)+1;continue}
    const rep=[...members].sort((a,b)=>a.parsed.op.id.localeCompare(b.parsed.op.id))[0],path=template(rep.parsed,f.position,input),slotName=f.position.kind==="path"?input:f.position.key;if(AUTH_NAME.test(slotName)){metrics.routeFamiliesRejectedAuthLike=Number(metrics.routeFamiliesRejectedAuthLike)+1;continue}
    const slot:P1RequestSlot={id:`4l_family_${fourAp1Sha({f:f.signature,input}).slice(0,14)}`,name:slotName,in:f.position.kind,required:true,auth_like:false,literals:[]};
    const evidenceIds=[...new Set(members.flatMap(m=>[m.parsed.op.source.evidence_id,m.parsed.baseSourceId]))],sourceUrls=[...new Set(members.flatMap(m=>[m.parsed.op.source.source_url,m.parsed.baseSourceUrl]))],positive=[...new Set(members.flatMap(m=>m.parsed.positive))];
    hypotheses.push({id:`req4l_${fourAp1Sha({f:f.signature,caseId,input,path,slot:slot.name}).slice(0,16)}`,source_operation_id:rep.parsed.op.id,origin:rep.parsed.origin,full_path:path,proof_type:`4l_executable_route_family_${f.position.kind}_${rep.parsed.op.form}_${rep.parsed.op.api_base_relation||"absolute"}`,evidence_ids:evidenceIds,source_urls:sourceUrls,slots:[slot],input_bindings:{[input]:slot.id},literal_bindings:{},score:760+signals.count*12+positive.length*10+Math.min(20,members.length),concrete_relation:true});
    metrics.routeFamiliesAccepted=Number(metrics.routeFamiliesAccepted)+1;metrics.routeFamilyMembers=Number(metrics.routeFamilyMembers)+members.length;metrics.routeFamilyDistinctObservedValues=Number(metrics.routeFamilyDistinctObservedValues)+values.length;if(f.position.kind==="path")metrics.routeFamilyInducedPathSlots=Number(metrics.routeFamilyInducedPathSlots)+1;else metrics.routeFamilyInducedQuerySlots=Number(metrics.routeFamilyInducedQuerySlots)+1;
  }
  metrics.routeFamilyHypotheses=hypotheses.length;metrics.executableGateRouteFamilyHypotheses=hypotheses.length;return {hypotheses:hypotheses.sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id)),metrics};
}

function augment(base:any,caseId:string){const induced=induceExecutableRouteFamilies4L(base.semantics,caseId),baseHyp=[...(base.hypotheses as P1RequestHypothesis[])],dedup=new Map<string,P1RequestHypothesis>();for(const h of [...baseHyp,...induced.hypotheses]){const key=fourAp1Sha({origin:h.origin,path:h.full_path,inputs:h.input_bindings,literals:h.literal_bindings}),p=dedup.get(key);if(!p||h.score>p.score)dedup.set(key,h)}let renderCompileRejected4l=0,renderUrlParseRejected4l=0,authLikeRenderedRequests4l=0;const hypotheses=[...dedup.values()].sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id)).filter(h=>{const c=renderCheck(h,caseId);if(c.kind==="compile_reject"){renderCompileRejected4l++;return false}if(c.kind==="url_reject"){renderUrlParseRejected4l++;return false}if(c.kind==="auth_like"){authLikeRenderedRequests4l++;return false}return true});return {...base,hypotheses,metrics:{...base.metrics,...induced.metrics,renderCompileRejected4l,renderUrlParseRejected4l,authLikeRenderedRequests4l},graph_fingerprint:fourAp1Sha({base:base.graph_fingerprint,h:hypotheses.map(h=>h.id),gate:induced.metrics})}}
function packetFor(hypotheses:P1RequestHypothesis[],caseId:string){const legacy=hypotheses.filter(h=>!h.proof_type.startsWith("4l_executable_route_family_")),route=hypotheses.filter(h=>h.proof_type.startsWith("4l_executable_route_family_")),ordered: P1RequestHypothesis[]=[];if(route.length){ordered.push(...legacy.slice(0,2),route[0]);for(const h of [...legacy.slice(2),...route.slice(1)])if(ordered.length<FOUR_AP1_MAX_PROBES_PER_PROVIDER)ordered.push(h)}else ordered.push(...legacy.slice(0,FOUR_AP1_MAX_PROBES_PER_PROVIDER));const seen=new Set<string>(),packet:P1RequestHypothesis[]=[];let duplicateRenderedProbeUrlsRejected4l=0;for(const h of ordered){const c=renderCheck(h,caseId);if(c.kind!=="ok"||!c.url)continue;if(seen.has(c.url)){duplicateRenderedProbeUrlsRejected4l++;continue}seen.add(c.url);packet.push(h);if(packet.length>=FOUR_AP1_MAX_PROBES_PER_PROVIDER)break}return {packet,seen,duplicateRenderedProbeUrlsRejected4l}}
export async function prepareRequestGraph4L(evidence:DocEvidence[],caseId:string,ledger:RecoveryLedger){const base=await prepareRequestGraph4J(evidence,caseId,ledger),graph=augment(base,caseId),p=packetFor(graph.hypotheses as P1RequestHypothesis[],caseId);return {...graph,probe_packet:p.packet,metrics:{...graph.metrics,requestHypotheses:graph.hypotheses.length,uniqueRenderedProbeUrls:p.seen.size,duplicateRenderedProbeUrlsRejected4l:p.duplicateRenderedProbeUrlsRejected4l,routeFamilyPacketHypotheses:p.packet.filter(h=>h.proof_type.startsWith("4l_executable_route_family_")).length,expandedEvidenceHypotheses:(graph.hypotheses as P1RequestHypothesis[]).filter(h=>h.evidence_ids.some(id=>/^4[e-g]_ref_/.test(id))).length,noIrOperation:graph.semantics.operations.length===0,irOperationUnusable:graph.semantics.operations.length>0&&graph.hypotheses.length===0}}}
export function rebuildRequestGraph4L(evidence:DocEvidence[],caseId:string){return augment(rebuildRequestGraph4J(evidence,caseId),caseId)}
