import {createHash} from "node:crypto";
import {isIP} from "node:net";
import type {DocEvidence,MicroContract} from "./experiment3wCore.js";
import {FOUR_A_CASES} from "./experiment4aCore.js";
import type {ProjectionPlan} from "./experiment4arCore.js";

export const FOUR_AR6R_BASE_SHA="f5c34c8598698ad9ee9e2cff856a298b7dd00690";
export const FOUR_AR6R_FROZEN_RUN=33038630313;
export const FOUR_AR6R_FROZEN_ARTIFACT=9633749547;
export const FOUR_AR6R_FROZEN_DIGEST="sha256:bf9b49a2b17cff695b676c50d2f733242cd93c834c257d46f5ec70e7bb576302";
export const FOUR_AR6R_FROZEN_REPORT_FP="9402d2488cfc71e83bc9c80595bf42ebe1937007e1f679dce3d0de08f06f2df6";
export const FOUR_AR6R_FROZEN_LEDGER_FP="518a95d6f53dbbd819783609b0224737b289291415d4a82fc2d73655acd819ef";
export const FOUR_AR6R_MAX_INVENTORY=80;
export const FOUR_AR6R_MAX_PACKET=12;

export const fourAr6rSha=(v:any)=>createHash("sha256")
  .update(typeof v==="string"?v:JSON.stringify(v))
  .digest("hex");

export type R6RParam={
  name:string;
  in:"path"|"query";
  required:boolean;
  literals:string[];
};

export type R6ROperation={
  operation_id:string;
  origin:string;
  base_path:string;
  operation_path:string;
  full_path:string;
  method:"GET";
  path_parameters:R6RParam[];
  query_parameters:R6RParam[];
  response_paths:string[];
  evidence_ids:string[];
  source_urls:string[];
  proof_type:"openapi"|"endpoint_json_example"|"endpoint_template";
  score:number;
  api_confidence:number;
  request_offset:number|null;
  response_offset:number|null;
};

export type EndpointReject={
  evidence_id:string;
  raw:string;
  offset:number;
  reason:string;
};

export type R6RInventory={
  raw_candidate_count:number;
  accepted_candidate_count:number;
  rejected_candidate_count:number;
  rejects:EndpointReject[];
  inventory:R6ROperation[];
  packet:R6ROperation[];
  inventory_fingerprint:string;
  packet_fingerprint:string;
};

export type R6RStageA={decision:"SELECT"|"REJECT";operation_index:number;reason:string};
export type R6RStageB={
  path_bindings:{parameter_index:number;input_name:string}[];
  query_bindings:{parameter_index:number;source_kind:"INPUT"|"LITERAL"|"OMIT";input_name:string|null;literal_index:number|null}[];
  output_mappings:{output_name:string;source_kind:"FIELD"|"INPUT";response_path_index:number|null;input_name:string|null}[];
  reason:string;
};

function decodeHtml(s:string){return s
  .replace(/&quot;|&#34;|&#x22;/gi,'"')
  .replace(/&#39;|&apos;|&#x27;/gi,"'")
  .replace(/&amp;/gi,"&")
  .replace(/&lt;/gi,"<")
  .replace(/&gt;/gi,">")
  .replace(/&#91;|&#x5b;/gi,"[")
  .replace(/&#93;|&#x5d;/gi,"]")
  .replace(/&#123;|&#x7b;/gi,"{")
  .replace(/&#125;|&#x7d;/gi,"}");}

function stripTags(s:string){return decodeHtml(s).replace(/<\/?(?:code|pre|span|a|div|p|li|strong|em|kbd|samp|var)(?:\s[^>]*)?>/gi,"").trim();}
function cleanEndpointToken(raw:string){let s=stripTags(raw).trim();s=s.replace(/^['"`(]+/,"").replace(/['"`,;.)]+$/g,"");s=s.replace(/\\u003[cC]/g,"<").replace(/\\u003[eE]/g,">");try{s=decodeURIComponent(s);}catch{}return s;}

export function canonicalizeEndpointTemplateR6R(raw:string){let s=cleanEndpointToken(raw)
  .replace(/%7B/gi,"{").replace(/%7D/gi,"}")
  .replace(/%3C/gi,"<").replace(/%3E/gi,">")
  .replace(/%5B/gi,"[").replace(/%5D/gi,"]")
  .replace(/<([A-Za-z_][A-Za-z0-9_.-]*)>/g,"{$1}")
  .replace(/\[([A-Za-z_][A-Za-z0-9_.-]*)\]/g,"{$1}")
  .replace(/:([A-Za-z_][A-Za-z0-9_.-]*)(?=\/|\?|&|$)/g,"{$1}");
  return s;
}

function normalizedBasePath(path:string){const x=String(path||"").trim();if(!x||x==="/")return "";const y=(x.startsWith("/")?x:`/${x}`).replace(/\/{2,}/g,"/").replace(/\/+$/g,"");return y==="/"?"":y;}
function normalizedOperationPath(path:string){let s=canonicalizeEndpointTemplateR6R(path);const q=s.indexOf("?");if(q>=0)s=s.slice(0,q);if(!s.startsWith("/"))s=`/${s}`;return s.replace(/\/{2,}/g,"/");}
function combine(base:string,path:string){return `${normalizedBasePath(base)}${normalizedOperationPath(path)}`.replace(/\/{2,}/g,"/")||"/";}
function pathParameterNames(path:string){return [...path.matchAll(/\{([A-Za-z_][A-Za-z0-9_.-]*)\}/g)].map(m=>m[1]);}
function regDomain(host:string){const p=host.toLowerCase().split(".").filter(Boolean);return p.slice(-2).join(".");}
function sameSite(a:string,b:string){try{const x=new URL(a),y=new URL(b);return x.hostname===y.hostname||regDomain(x.hostname)===regDomain(y.hostname);}catch{return false;}}

const STATIC_EXT=/\.(?:m?js|css|map|woff2?|ttf|otf|eot|png|jpe?g|gif|svg|webp|ico|bmp|mp4|webm|mov|avi|zip|tar|tgz|gz|7z|rar|pdf)(?:[?#]|$)/i;
const NAV_PATH=/(?:^|\/)(?:privacy|terms|legal|license|community|contact|about|login|signin|signup|register|account|blog|news|careers?|press|status)(?:\/|$)/i;
const API_PATH=/(?:^|\/)(?:api|v\d+|rest|graphql|search|lookup|decode|objects?|items?|products?|packages?|users?|meals?|drinks?|artworks?|vehicles?|metadata)(?:\/|$|\?)/i;
function apiRejectReason(raw:string,evidenceUrl:string,context:string){const s=cleanEndpointToken(raw);if(!s)return "empty";if(/^(?:mailto:|tel:|javascript:|#)/i.test(s))return "non_http_scheme";if(STATIC_EXT.test(s))return "static_asset";if(NAV_PATH.test(s)&&!/[?{[]/.test(s))return "navigation_path";if(/^https:\/\//i.test(s)&&!sameSite(s,evidenceUrl))return "cross_site";if(/^http:\/\//i.test(s))return "non_https";if(!/^https:\/\//i.test(s)&&!s.startsWith("/"))return "not_endpoint_shape";if(s.startsWith("/")&&!/[?{[]/.test(s)&&!API_PATH.test(s)&&!/(?:GET|curl|endpoint|request|response|example|api)/i.test(context))return "weak_relative_context";return null;}

function refResolve(spec:any,node:any){if(node&&typeof node==="object"&&typeof node.$ref==="string"&&node.$ref.startsWith("#/")){let cur=spec;for(const p of node.$ref.slice(2).split("/"))cur=cur?.[p.replace(/~1/g,"/").replace(/~0/g,"~")];return cur??node;}return node;}
function schemaPaths(spec:any,schema:any,prefix="",depth=0,seen=new Set<any>()):string[]{schema=refResolve(spec,schema);if(!schema||typeof schema!=="object"||depth>7||seen.has(schema))return [];seen.add(schema);const out:string[]=[];if(schema.properties&&typeof schema.properties==="object")for(const [k,v] of Object.entries(schema.properties)){const p=prefix?`${prefix}.${k}`:k;out.push(p,...schemaPaths(spec,v,p,depth+1,new Set(seen)));}if(schema.items){const p=prefix?`${prefix}.0`:"0";out.push(p,...schemaPaths(spec,schema.items,p,depth+1,new Set(seen)));}for(const k of ["allOf","oneOf","anyOf"])if(Array.isArray(schema[k]))for(const x of schema[k])out.push(...schemaPaths(spec,x,prefix,depth+1,new Set(seen)));return [...new Set(out)];}
function responsePaths(spec:any,responses:any){const out:string[]=[];for(const [code,r0] of Object.entries(responses||{})){if(!/^2\d\d$/.test(code)&&code!=="default")continue;const r:any=refResolve(spec,r0);for(const media of Object.values(r?.content||{}) as any[])out.push(...schemaPaths(spec,media?.schema));if(r?.schema)out.push(...schemaPaths(spec,r.schema));}return [...new Set(out)].slice(0,240);}
function literalsFrom(spec:any,p:any){const s=refResolve(spec,p?.schema)||p?.schema||{},vals:any[]=[];if(Array.isArray(s.enum))vals.push(...s.enum);vals.push(p?.example,p?.default,s?.example,s?.default);if(p?.examples)for(const x of Object.values(p.examples) as any[])vals.push(x?.value??x);return [...new Set(vals.filter(v=>v!==undefined&&v!==null&&["string","number","boolean"].includes(typeof v)).map(String))].slice(0,20);}

function applyServerVariables(raw:string,server:any){let s=raw;const matches=[...s.matchAll(/\{([^}]+)\}/g)];for(const m of matches){const v=server?.variables?.[m[1]]?.default;if(v===undefined||v===null)return null;s=s.replace(m[0],String(v));}return /\{[^}]+\}/.test(s)?null:s;}
export function normalizeOpenApiServersR6R(spec:any,resolvedUrl:string){const out:{origin:string;base_path:string}[]=[];const add=(raw0:string,server?:any)=>{let raw=applyServerVariables(String(raw0||"").trim(),server);if(!raw)return;try{let u:URL;if(/^https:\/\//i.test(raw))u=new URL(raw);else if(/^\/\//.test(raw))u=new URL(`https:${raw}`);else if(raw.startsWith("/"))u=new URL(raw,new URL(resolvedUrl).origin);else if(/^[A-Za-z0-9.-]+(?::\d+)?(?:\/|$)/.test(raw)&&raw.split("/")[0].includes("."))u=new URL(`https://${raw}`);else u=new URL(raw,resolvedUrl);if(u.protocol!=="https:"||u.username||u.password||isIP(u.hostname)||u.search||u.hash)return;out.push({origin:u.origin,base_path:normalizedBasePath(u.pathname)});}catch{}};
 for(const s of spec?.servers||[])if(typeof s?.url==="string")add(s.url,s);
 if(spec?.host){const schemes=Array.isArray(spec.schemes)?spec.schemes:["https"];if(schemes.map((x:any)=>String(x).toLowerCase()).includes("https"))add(`https://${spec.host}${spec.basePath||""}`);}
 if(!out.length)try{const u=new URL(resolvedUrl);if(u.protocol==="https:"&&!isIP(u.hostname))out.push({origin:u.origin,base_path:""});}catch{}
 return [...new Map(out.map(x=>[`${x.origin}${x.base_path}`,x])).values()];}

function parameterRows(spec:any,item:any,op:any):R6RParam[]{return [...(item?.parameters||[]),...(op?.parameters||[])].map((x:any)=>refResolve(spec,x)).filter((p:any)=>p&&["path","query"].includes(p.in)&&typeof p.name==="string").map((p:any)=>({name:p.name,in:p.in==="path"?"path":"query",required:p.in==="path"||Boolean(p.required),literals:literalsFrom(spec,p)}));}

export function specSummaryR6R(spec:any,caseId:string,resolvedUrl:string){const servers=normalizeOpenApiServersR6R(spec,resolvedUrl),ops:any[]=[];for(const [path,item] of Object.entries(spec?.paths||{}) as any[]){const op=item?.get;if(!op)continue;ops.push({method:"GET",path:normalizedOperationPath(path),operation_id:op.operationId||null,summary:op.summary||null,description:op.description||null,parameters:parameterRows(spec,item,op),response_paths:responsePaths(spec,op.responses||{})});}return `R6R_VERIFIED_API_SPEC\n${JSON.stringify({servers,operation_count:ops.length,operations:ops},null,2)}`;}

function jsonPaths(v:any,prefix="",depth=0):string[]{if(depth>7||v===null||v===undefined)return [];const out:string[]=[];if(Array.isArray(v)){if(v.length){const p=prefix?`${prefix}.0`:"0";out.push(p,...jsonPaths(v[0],p,depth+1));}}else if(typeof v==="object")for(const [k,x] of Object.entries(v)){const p=prefix?`${prefix}.${k}`:k;out.push(p,...jsonPaths(x,p,depth+1));}return [...new Set(out)];}
type JsonBlock={start:number;end:number;paths:string[]};
function jsonBlocks(text0:string):JsonBlock[]{const text=decodeHtml(text0),blocks:JsonBlock[]=[];const regexes=[/```(?:json|javascript|js)?\s*([\s\S]*?)```/gi,/<pre[^>]*>([\s\S]*?)<\/pre>/gi,/<code[^>]*>([\s\S]*?)<\/code>/gi,/<script[^>]*type=["']application\/json["'][^>]*>([\s\S]*?)<\/script>/gi];for(const re of regexes){for(const m of text.matchAll(re)){const raw=stripTags(m[1]).trim();try{const parsed=JSON.parse(raw),paths=jsonPaths(parsed);if(paths.length)blocks.push({start:m.index??0,end:(m.index??0)+m[0].length,paths});}catch{}}}return blocks.sort((a,b)=>a.start-b.start);}
function nearestJson(blocks:JsonBlock[],offset:number){let best:JsonBlock|null=null,bestScore=Infinity;for(const b of blocks){const delta=b.start>=offset?b.start-offset:(offset-b.end)+1200;if(delta<0||delta>6500)continue;if(delta<bestScore){best=b;bestScore=delta;}}return best;}

function codeRegions(text:string){const out:{start:number;end:number;text:string;strength:number}[]=[];for(const re of [/```[\w-]*\s*([\s\S]*?)```/gi,/<pre[^>]*>([\s\S]*?)<\/pre>/gi,/<code[^>]*>([\s\S]*?)<\/code>/gi])for(const m of text.matchAll(re))out.push({start:m.index??0,end:(m.index??0)+m[0].length,text:stripTags(m[1]),strength:3});for(const m of text.matchAll(/(?:^|\n)[^\n]{0,80}\b(?:GET|curl)\s+([^\n]{1,500})/gi))out.push({start:m.index??0,end:(m.index??0)+m[0].length,text:stripTags(m[0]),strength:4});return out;}

type RawEndpoint={evidence:DocEvidence;raw:string;offset:number;context:string;strength:number;absolute:boolean;};
function rawEndpointCandidates(e:DocEvidence){const text=decodeHtml(e.text),out:RawEndpoint[]=[];const seen=new Set<string>();const add=(raw:string,offset:number,context:string,strength:number)=>{const cleaned=cleanEndpointToken(raw);const key=`${offset}:${cleaned}`;if(!cleaned||seen.has(key))return;seen.add(key);out.push({evidence:e,raw:cleaned,offset,context,strength,absolute:/^https:\/\//i.test(cleaned)});};
 const abs=/https:\/\/[A-Za-z0-9.-]+(?::\d+)?[^\s"'`<>]*/gi;for(const m of text.matchAll(abs))add(m[0],m.index??0,text.slice(Math.max(0,(m.index??0)-350),Math.min(text.length,(m.index??0)+m[0].length+500)),2);
 for(const region of codeRegions(text)){const rel=/(?:^|\s)(\/[A-Za-z0-9_~.!$&'()*+,;=:@%{}<>\[\]-]+(?:\/[A-Za-z0-9_~.!$&'()*+,;=:@%{}<>\[\]-]+)*(?:\?[^\s"'`<>]*)?)/g;for(const m of region.text.matchAll(rel))add(m[1],region.start+(m.index??0),region.text,region.strength);const get=/(?:GET|curl(?:\s+-[^\s]+)*\s+)(https:\/\/[^\s"'`<>]+|\/[^\s"'`<>]+)/gi;for(const m of region.text.matchAll(get))add(m[1],region.start+(m.index??0),region.text,5);}
 return out;}

function queryParamsFrom(raw:string):R6RParam[]{const q=raw.indexOf("?");if(q<0)return [];const text=raw.slice(q+1),out:R6RParam[]=[];for(const piece of text.split("&")){if(!piece)continue;const eq=piece.indexOf("="),name=decodeURIComponent(eq>=0?piece.slice(0,eq):piece).trim();if(!/^[A-Za-z_][A-Za-z0-9_.-]*$/.test(name))continue;const value=eq>=0?decodeURIComponent(piece.slice(eq+1)):"";const templ=/^\{[^}]+\}$/.test(canonicalizeEndpointTemplateR6R(value));out.push({name,in:"query",required:false,literals:templ||!value?[]:[value]});}return [...new Map(out.map(x=>[x.name,x])).values()];}
function originAndPath(raw:string,evidenceUrl:string){const canonical=canonicalizeEndpointTemplateR6R(raw);if(/^https:\/\//i.test(canonical)){const q=canonical.indexOf("?"),noq=q>=0?canonical.slice(0,q):canonical;try{const u=new URL(noq.replace(/\{[^}]+\}/g,"x")),prefix=noq.match(/^https:\/\/[^/]+/i)?.[0]||u.origin,path=noq.slice(prefix.length)||"/";return {origin:u.origin,path:normalizedOperationPath(path)};}catch{return null;}}try{return {origin:new URL(evidenceUrl).origin,path:normalizedOperationPath(canonical)};}catch{return null;}}

function pathShape(path:string){return path.split("/").filter(Boolean).map(s=>/^\{[^}]+\}$/.test(s)?"{}":s.toLowerCase());}
function compatibleTemplate(template:string,concrete:string){const a=pathShape(template),b=pathShape(concrete);if(a.length!==b.length)return false;let params=0;for(let i=0;i<a.length;i++){if(a[i]==="{}"){params++;continue;}if(a[i]!==b[i])return false;}return params>0;}
function mergeParams(a:R6RParam[],b:R6RParam[]){const m=new Map<string,R6RParam>();for(const p of [...a,...b]){const prev=m.get(p.name);if(!prev)m.set(p.name,{...p,literals:[...p.literals]});else{prev.required=prev.required||p.required;prev.literals=[...new Set([...prev.literals,...p.literals])];}}return [...m.values()];}

function tokenSet(s:string){return new Set(s.toLowerCase().split(/[^a-z0-9]+/).filter(x=>x.length>=2));}
function overlap(a:string,b:string){const x=tokenSet(a),y=tokenSet(b);let n=0;for(const t of x)if(y.has(t))n++;return n;}
function scoreOperation(caseId:string,op:Omit<R6ROperation,"operation_id"|"score">){const c=FOUR_A_CASES.find(x=>x.case_id===caseId);if(!c)return 0;let s=0;const paramText=[...op.path_parameters,...op.query_parameters].map(x=>x.name).join(" "),responseText=op.response_paths.join(" ");for(const i of c.input_names)s+=overlap(i,paramText)*16;for(const r of c.required)s+=overlap(r,responseText)*22;s+=op.proof_type==="openapi"?80:op.proof_type==="endpoint_json_example"?55:20;s+=op.response_paths.length?Math.min(35,op.response_paths.length): -30;s+=op.path_parameters.length||op.query_parameters.length?18:0;s+=op.api_confidence*8;if(op.path_parameters.some(x=>x.required)&&!c.input_names.length)s-=30;return s;}

function parseSpecEvidence(e:DocEvidence,caseId:string):R6ROperation[]{if(!e.text.startsWith("R6R_VERIFIED_API_SPEC"))return [];let summary:any;try{summary=JSON.parse(e.text.slice(e.text.indexOf("\n")+1));}catch{return [];}const out:R6ROperation[]=[];for(const server of summary.servers||[])for(const row of summary.operations||[]){if(row.method!=="GET")continue;const params:R6RParam[]=(row.parameters||[]).filter((p:any)=>p&&typeof p.name==="string"&&["path","query"].includes(p.in)).map((p:any)=>({name:p.name,in:p.in==="path"?"path":"query",required:p.in==="path"||Boolean(p.required),literals:Array.isArray(p.literals)?p.literals.map(String):[]}));const base_path=normalizedBasePath(server.base_path||""),operation_path=normalizedOperationPath(row.path),partial:Omit<R6ROperation,"operation_id"|"score">={origin:String(server.origin||""),base_path,operation_path,full_path:combine(base_path,operation_path),method:"GET",path_parameters:params.filter(x=>x.in==="path"),query_parameters:params.filter(x=>x.in==="query"),response_paths:Array.isArray(row.response_paths)?[...new Set(row.response_paths.map(String))]:[],evidence_ids:[e.evidence_id],source_urls:[e.resolved_url],proof_type:"openapi",api_confidence:5,request_offset:null,response_offset:null};if(!/^https:\/\//.test(partial.origin))continue;out.push({...partial,score:scoreOperation(caseId,partial),operation_id:`spec_${fourAr6rSha({origin:partial.origin,path:partial.full_path,e:e.evidence_id}).slice(0,14)}`});}return out;}

function compileEndpointEvidence(e:DocEvidence,caseId:string){const blocks=jsonBlocks(e.text),raw=rawEndpointCandidates(e),rejects:EndpointReject[]=[],ops:R6ROperation[]=[];for(const candidate of raw){const reason=apiRejectReason(candidate.raw,e.resolved_url,candidate.context);if(reason){rejects.push({evidence_id:e.evidence_id,raw:candidate.raw.slice(0,300),offset:candidate.offset,reason});continue;}const originPath=originAndPath(candidate.raw,e.resolved_url);if(!originPath){rejects.push({evidence_id:e.evidence_id,raw:candidate.raw.slice(0,300),offset:candidate.offset,reason:"parse_failed"});continue;}if(/^https:\/\//.test(candidate.raw)&&!sameSite(candidate.raw,e.resolved_url)){rejects.push({evidence_id:e.evidence_id,raw:candidate.raw.slice(0,300),offset:candidate.offset,reason:"cross_site"});continue;}const response=nearestJson(blocks,candidate.offset),path_parameters=pathParameterNames(originPath.path).map(name=>({name,in:"path" as const,required:true,literals:[]})),query_parameters=queryParamsFrom(candidate.raw),api_confidence=Math.min(5,candidate.strength+(API_PATH.test(originPath.path)?1:0)+(path_parameters.length||query_parameters.length?1:0)),partial:Omit<R6ROperation,"operation_id"|"score">={origin:originPath.origin,base_path:"",operation_path:originPath.path,full_path:originPath.path,method:"GET",path_parameters,query_parameters,response_paths:response?.paths||[],evidence_ids:[e.evidence_id],source_urls:[e.resolved_url],proof_type:response?.paths.length?"endpoint_json_example":"endpoint_template",api_confidence,request_offset:candidate.offset,response_offset:response?.start??null};const score=scoreOperation(caseId,partial);ops.push({...partial,score,operation_id:`ep_${fourAr6rSha({origin:partial.origin,path:partial.full_path,q:partial.query_parameters,e:e.evidence_id,o:candidate.offset}).slice(0,14)}`});}
 // Reconcile explicit parameterized templates with concrete examples from the same evidence.
 for(const template of ops.filter(x=>x.path_parameters.length)){for(const concrete of ops.filter(x=>!x.path_parameters.length&&x.origin===template.origin)){if(!compatibleTemplate(template.operation_path,concrete.operation_path))continue;const tq=new Set(template.query_parameters.map(x=>x.name)),cq=new Set(concrete.query_parameters.map(x=>x.name));if(tq.size&&cq.size&&![...tq].every(x=>cq.has(x)))continue;template.query_parameters=mergeParams(template.query_parameters,concrete.query_parameters);if(!template.response_paths.length&&concrete.response_paths.length){template.response_paths=[...concrete.response_paths];template.response_offset=concrete.response_offset;template.proof_type="endpoint_json_example";}template.evidence_ids=[...new Set([...template.evidence_ids,...concrete.evidence_ids])];template.score=scoreOperation(caseId,{...template,operation_id:undefined as never,score:undefined as never});}}
 return {raw_count:raw.length,rejects,ops};}

function dedupeOperations(ops:R6ROperation[],caseId:string){const map=new Map<string,R6ROperation>();for(const op of ops){const key=fourAr6rSha({origin:op.origin,path:op.full_path,p:op.path_parameters.map(x=>[x.name,x.required]),q:op.query_parameters.map(x=>[x.name,x.required,x.literals]),r:op.response_paths});const prev=map.get(key);if(!prev)map.set(key,{...op});else{prev.evidence_ids=[...new Set([...prev.evidence_ids,...op.evidence_ids])];prev.source_urls=[...new Set([...prev.source_urls,...op.source_urls])];if(op.proof_type==="openapi"||(!prev.response_paths.length&&op.response_paths.length)){prev.response_paths=[...op.response_paths];prev.proof_type=op.proof_type;}prev.api_confidence=Math.max(prev.api_confidence,op.api_confidence);prev.score=Math.max(prev.score,op.score);}}
 const rows=[...map.values()];for(const op of rows)op.score=scoreOperation(caseId,{...op,operation_id:undefined as never,score:undefined as never});return rows.sort((a,b)=>b.score-a.score||b.api_confidence-a.api_confidence||(a.proof_type==="openapi"?-1:1)-(b.proof_type==="openapi"?-1:1)||a.origin.localeCompare(b.origin)||a.full_path.localeCompare(b.full_path));}

export function extractOperationInventoryR6R(evidence:DocEvidence[],caseId:string):R6RInventory{let rawCount=0;const rejects:EndpointReject[]=[],ops:R6ROperation[]=[];for(const e of evidence.filter(x=>x.state==="ok")){if(e.text.startsWith("R6R_VERIFIED_API_SPEC"))ops.push(...parseSpecEvidence(e,caseId));else{const c=compileEndpointEvidence(e,caseId);rawCount+=c.raw_count;rejects.push(...c.rejects);ops.push(...c.ops);}}const inventory=dedupeOperations(ops,caseId).slice(0,FOUR_AR6R_MAX_INVENTORY).map((op,i)=>({...op,operation_id:`r6r${String(i).padStart(2,"0")}_${fourAr6rSha({origin:op.origin,path:op.full_path,e:op.evidence_ids}).slice(0,10)}`}));const packet=inventory.filter(x=>x.api_confidence>=2&&(x.response_paths.length>0||x.path_parameters.length>0||x.query_parameters.length>0)).slice(0,FOUR_AR6R_MAX_PACKET);return {raw_candidate_count:rawCount,accepted_candidate_count:ops.length,rejected_candidate_count:rejects.length,rejects:rejects.slice(0,160),inventory,packet,inventory_fingerprint:fourAr6rSha(inventory),packet_fingerprint:fourAr6rSha(packet)};}

export function materializeR6R(caseId:string,providerId:string,op:R6ROperation,mapping:R6RStageB){const c=FOUR_A_CASES.find(x=>x.case_id===caseId);if(!c)throw new Error("r6r_unknown_case");const pb:Record<string,string>={},qb:Record<string,string>={};for(const b of mapping.path_bindings){const p=op.path_parameters[b.parameter_index];if(!p)throw new Error(`r6r_selected_operation_id=${op.operation_id}|path_parameter_index_invalid`);if(!c.input_names.includes(b.input_name))throw new Error(`r6r_selected_operation_id=${op.operation_id}|path_input_invalid`);if(pb[p.name]!==undefined)throw new Error(`r6r_selected_operation_id=${op.operation_id}|duplicate_path_binding`);pb[p.name]=`$input.${b.input_name}`;}for(const p of op.path_parameters)if(pb[p.name]===undefined)throw new Error(`r6r_selected_operation_id=${op.operation_id}|unbound_path:${p.name}`);
 for(const b of mapping.query_bindings){const p=op.query_parameters[b.parameter_index];if(!p)throw new Error(`r6r_selected_operation_id=${op.operation_id}|query_parameter_index_invalid`);if(b.source_kind==="OMIT"){if(p.required)throw new Error(`r6r_selected_operation_id=${op.operation_id}|required_query_omitted:${p.name}`);continue;}if(qb[p.name]!==undefined)throw new Error(`r6r_selected_operation_id=${op.operation_id}|duplicate_query_binding`);if(b.source_kind==="INPUT"){if(!b.input_name||!c.input_names.includes(b.input_name))throw new Error(`r6r_selected_operation_id=${op.operation_id}|query_input_invalid`);qb[p.name]=`$input.${b.input_name}`;}else{const lit=b.literal_index===null?undefined:p.literals[b.literal_index];if(lit===undefined)throw new Error(`r6r_selected_operation_id=${op.operation_id}|query_literal_index_invalid`);qb[p.name]=lit;}}for(const p of op.query_parameters)if(p.required&&qb[p.name]===undefined)throw new Error(`r6r_selected_operation_id=${op.operation_id}|required_query_unbound:${p.name}`);
 const projection:ProjectionPlan={},seen=new Set<string>();for(const m of mapping.output_mappings){if(!c.required.includes(m.output_name)||seen.has(m.output_name))throw new Error(`r6r_selected_operation_id=${op.operation_id}|output_name_invalid`);seen.add(m.output_name);if(m.source_kind==="INPUT"){if(!m.input_name||!c.input_names.includes(m.input_name))throw new Error(`r6r_selected_operation_id=${op.operation_id}|output_input_invalid`);projection[m.output_name]={op:"INPUT",name:m.input_name} as any;}else{const path=m.response_path_index===null?undefined:op.response_paths[m.response_path_index];if(!path)throw new Error(`r6r_selected_operation_id=${op.operation_id}|response_path_index_invalid`);projection[m.output_name]={op:"FIELD",path} as any;}}for(const r of c.required)if(!seen.has(r))throw new Error(`r6r_selected_operation_id=${op.operation_id}|missing_output:${r}`);
 const raw:any={case_id:caseId,provider_candidate_id:providerId,decision:"COMPILE",method:"GET",base_url:op.origin,path_template:op.full_path,path_bindings:pb,query_bindings:qb,evidence_ids:op.evidence_ids,reason:`R6R_OPERATION:${op.operation_id}`,projection};return {raw,proof:{operation_id:op.operation_id,proof_type:op.proof_type,evidence_ids:op.evidence_ids,source_urls:op.source_urls,origin:op.origin,full_path:op.full_path,input_mapping:{path:pb,query:qb},output_mapping:projection}};}

export function contractFromR6RRaw(raw:any):MicroContract{return {case_id:raw.case_id,provider_candidate_id:raw.provider_candidate_id,decision:raw.decision,method:raw.method,base_url:raw.base_url,path_template:raw.path_template,path_bindings:raw.path_bindings,query_bindings:raw.query_bindings,evidence_ids:raw.evidence_ids,reason:raw.reason};}
