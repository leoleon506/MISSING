import type {DocEvidence} from "./experiment3wCore.js";
import {FOUR_A_CASES} from "./experiment4aCore.js";
import {FOUR_AP1_MAX_PROBES_PER_PROVIDER,fourAp1Sha,type P1RequestHypothesis,type P1RequestSlot} from "./experiment4ap1Model.js";
import {buildRequestHypothesesP1,compileRequestHypothesisP1,lexicalTokensP1} from "./experiment4ap1Request.js";

const AUTH_LIKE=/^(?:api[_-]?key|apikey|key|token|access[_-]?token|secret|authorization|auth|app[_-]?id|appid|client[_-]?id|client[_-]?secret)$/i;
const GENERIC_SINGLE_SLOT=/^(?:id|name|q|s|query|search|term|value|input)$/i;
const NAV_PATH=/(?:^|\/)(?:privacy|terms|legal|license|community|contact|about|login|signin|signup|register|account|blog|news|careers?|press|status)(?:\/|$)/i;
const ASSET=/\.(?:png|jpe?g|gif|svg|css|m?js|woff2?|pdf|zip|tar|gz)(?:$|\?)/i;

export type TypedRequestEvidenceType="openapi_operation"|"http_get_line"|"curl_get"|"fetch_get"|"axios_get"|"labeled_endpoint"|"structured_endpoint_example";
export type TypedEvidenceItem={id:string;type:TypedRequestEvidenceType;evidence_id:string;source_url:string;raw:string;offset:number;url:string|null;origin:string|null;path:string|null;};
export type TypedRequestMetrics={typedEvidenceItems:number;typedEvidenceByType:Record<string,number>;typedRequestHypotheses:number;documentationOriginFallbacks:number;standaloneUrlPromotions:number;};

function tokens(v:string){return lexicalTokensP1(v);}
function overlap(a:string,b:string){const x=new Set(tokens(a)),y=new Set(tokens(b));let n=0;for(const t of x)if(y.has(t))n++;return n;}
function norm(v:any){return String(v??"").trim().toLowerCase();}
function sid(seed:any){return `par_${fourAp1Sha(seed).slice(0,14)}`;}
function lid(seed:any){return `lit_${fourAp1Sha(seed).slice(0,14)}`;}
function clean(raw:string){return raw.trim().replace(/[),;\]}]+$/g,"").replace(/&amp;/g,"&");}
function safeAbsolute(raw:string){try{const u=new URL(clean(raw));if(u.protocol!=="https:"||u.username||u.password||ASSET.test(u.pathname)||NAV_PATH.test(u.pathname))return null;return u;}catch{return null;}}

function addTyped(items:TypedEvidenceItem[],ev:DocEvidence,type:TypedRequestEvidenceType,raw:string,offset:number,urlRaw:string|null){let url:URL|null=null;if(urlRaw)url=safeAbsolute(urlRaw);if(urlRaw&&!url)return;items.push({id:`tev_${fourAp1Sha({e:ev.evidence_id,type,raw,offset,url:url?.toString()??null}).slice(0,16)}`,type,evidence_id:ev.evidence_id,source_url:ev.resolved_url||ev.requested_url,raw,offset,url:url?.toString()??null,origin:url?.origin??null,path:url?`${url.pathname}${url.search}`:null});}

export function extractTypedRequestEvidence4C(evidence:DocEvidence[]){const items:TypedEvidenceItem[]=[];
  for(const ev of evidence){if(ev.state!=="ok")continue;const text=ev.text;
    for(const m of text.matchAll(/\bGET\s+(https:\/\/[^\s<>"'`\\]+|\/[^\s<>"'`\\]+)/gi))addTyped(items,ev,"http_get_line",m[0],m.index??0,m[1].startsWith("https://")?m[1]:null);
    for(const m of text.matchAll(/\bcurl\b[^\n\r]{0,700}?(https:\/\/[^\s<>"'`\\]+)/gi)){const raw=m[0];if(/\s-X\s*(?:POST|PUT|PATCH|DELETE)\b/i.test(raw)||/--request\s+(?:POST|PUT|PATCH|DELETE)\b/i.test(raw))continue;addTyped(items,ev,"curl_get",raw,m.index??0,m[1]);}
    for(const m of text.matchAll(/\bfetch\s*\(\s*["'`](https:\/\/[^"'`]+)["'`]/gi)){const around=text.slice(m.index??0,(m.index??0)+500);if(/method\s*:\s*["'`](?:POST|PUT|PATCH|DELETE)["'`]/i.test(around))continue;addTyped(items,ev,"fetch_get",m[0],m.index??0,m[1]);}
    for(const m of text.matchAll(/\baxios\.get\s*\(\s*["'`](https:\/\/[^"'`]+)["'`]/gi))addTyped(items,ev,"axios_get",m[0],m.index??0,m[1]);
    for(const m of text.matchAll(/\b(?:Endpoint|Request\s+URL|API\s+URL)\s*:\s*(https:\/\/[^\s<>"'`\\]+)/gi))addTyped(items,ev,"labeled_endpoint",m[0],m.index??0,m[1]);
  }
  return [...new Map(items.map(x=>[x.id,x])).values()];}

function hypothesisFromUrl(item:TypedEvidenceItem,caseId:string){const c=FOUR_A_CASES.find(r=>r.case_id===caseId);if(!c||!item.url)return null;const url=safeAbsolute(item.url);if(!url)return null;let path=url.pathname||"/";const slots:P1RequestSlot[]=[];
  for(const ph of [...path.matchAll(/\{([A-Za-z_][A-Za-z0-9_.-]*)\}/g)])slots.push({id:sid({i:item.id,in:"path",name:ph[1]}),name:ph[1],in:"path",required:true,auth_like:AUTH_LIKE.test(ph[1]),literals:[]});
  for(const [name,value] of url.searchParams)slots.push({id:sid({i:item.id,in:"query",name}),name,in:"query",required:false,auth_like:AUTH_LIKE.test(name),literals:value?[{id:lid({i:item.id,name,value}),value}]:[]});
  const input_bindings:Record<string,string>={},used=new Set<string>();let score=0;
  for(const input of c.input_names){const build=String(c.build[input]??"");let candidates=slots.filter(s=>!s.auth_like&&!used.has(s.id)).map(s=>({s,n:overlap(input,s.name)*120+(s.literals.some(l=>norm(l.value)===norm(build))?220:0)})).filter(x=>x.n>0).sort((a,b)=>b.n-a.n);
    if(!candidates.length&&c.input_names.length===1){const free=slots.filter(s=>!s.auth_like&&!used.has(s.id));if(free.length===1&&GENERIC_SINGLE_SLOT.test(free[0].name))candidates=[{s:free[0],n:35}];}
    if(!candidates.length&&build.length>=3&&!path.includes("{")&&overlap(input,item.raw)>0){const segs=path.split("/"),hits:number[]=[];for(let i=0;i<segs.length;i++){let d=segs[i];try{d=decodeURIComponent(d);}catch{}if(norm(d)===norm(build))hits.push(i);}if(hits.length===1){segs[hits[0]]=`{${input}}`;path=segs.join("/")||"/";const s:P1RequestSlot={id:sid({i:item.id,in:"path",name:input,concrete:true}),name:input,in:"path",required:true,auth_like:false,literals:[]};slots.push(s);candidates=[{s,n:190}];}}
    if(!candidates.length)return null;input_bindings[input]=candidates[0].s.id;used.add(candidates[0].s.id);score+=candidates[0].n;}
  if(slots.some(s=>s.required&&s.auth_like))return null;const literal_bindings:Record<string,string>={};for(const s of slots){if(used.has(s.id)||s.auth_like)continue;if(s.required)return null;if(s.literals.length===1&&/json/i.test(s.literals[0].value)&&/(?:format|response|output|type)/i.test(s.name))literal_bindings[s.id]=s.literals[0].id;}
  const identity={item:item.id,origin:url.origin,path,input_bindings,literal_bindings};return {id:`req_${fourAp1Sha(identity).slice(0,16)}`,source_operation_id:item.id,origin:url.origin,full_path:path,proof_type:`4c_${item.type}`,evidence_ids:[item.evidence_id],source_urls:[item.source_url],slots,input_bindings,literal_bindings,score:400+score,concrete_relation:path!==url.pathname} satisfies P1RequestHypothesis;}

function inheritedStructured(evidence:DocEvidence[],caseId:string){const base=buildRequestHypothesesP1(evidence,caseId);return base.hypotheses.filter(h=>["openapi","endpoint_json_example","endpoint_template"].includes(String(h.proof_type))).map(h=>({...h,proof_type:`4c_structured_${h.proof_type}`,score:h.score+250}));}

export function buildTypedRequestGraph4C(evidence:DocEvidence[],caseId:string){const typed=extractTypedRequestEvidence4C(evidence);const direct=typed.map(x=>hypothesisFromUrl(x,caseId)).filter(Boolean) as P1RequestHypothesis[];const inherited=inheritedStructured(evidence,caseId);const all=[...direct,...inherited];const dedup=new Map<string,P1RequestHypothesis>();for(const h of all){const key=fourAp1Sha({o:h.origin,p:h.full_path,i:h.input_bindings,l:h.literal_bindings});const prev=dedup.get(key);if(!prev||h.score>prev.score)dedup.set(key,h);}const hypotheses=[...dedup.values()].sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id));const byType:Record<string,number>={};for(const x of typed)byType[x.type]=(byType[x.type]||0)+1;const metrics:TypedRequestMetrics={typedEvidenceItems:typed.length,typedEvidenceByType:byType,typedRequestHypotheses:hypotheses.length,documentationOriginFallbacks:0,standaloneUrlPromotions:0};const rendered=new Set<string>(),packet:P1RequestHypothesis[]=[];let duplicateRenderedProbeUrlsRejected=0;const c=FOUR_A_CASES.find(r=>r.case_id===caseId);for(const h of hypotheses){if(!c)break;let u:string;try{u=compileRequestHypothesisP1(h,c.build);}catch{continue;}if(rendered.has(u)){duplicateRenderedProbeUrlsRejected++;continue;}rendered.add(u);packet.push(h);if(packet.length>=FOUR_AP1_MAX_PROBES_PER_PROVIDER)break;}return {typed_evidence:typed,hypotheses,probe_packet:packet,metrics:{...metrics,uniqueRenderedProbeUrls:rendered.size,duplicateRenderedProbeUrlsRejected},inventory_fingerprint:fourAp1Sha({typed:typed.map(x=>x.id),inherited:inherited.map(x=>x.id)}),request_fingerprint:fourAp1Sha(hypotheses),graph_fingerprint:fourAp1Sha({typed:typed.map(x=>x.id),hypotheses:hypotheses.map(x=>x.id)})};}
