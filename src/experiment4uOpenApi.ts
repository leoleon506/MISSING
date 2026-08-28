import {parse as parseYaml} from "yaml";
import {createHash} from "node:crypto";
import {docScopeAllowed} from "./experiment3wCore.js";

export type MachineSpec4U={format:"json"|"yaml";kind:"openapi3"|"swagger2";spec:any};
export type RefMetrics4U={operationLocalRefsResolved4u:number;operationLocalRefsRejected4u:number;operationExternalRefsRejected4u:number;operationExternalRefFetches4u:number;operationRefCyclesRejected4u:number;unrelatedRefFailuresIsolated4u:number};
export const sha4u=(v:any)=>createHash("sha256").update(typeof v==="string"?v:JSON.stringify(v)).digest("hex");
export function qualifyMachineSpec4U(text:string){
  let parsed:any=null,format:"json"|"yaml"="json",jsonOk=false,yamlOk=false;
  try{parsed=JSON.parse(text);jsonOk=true}catch{format="yaml";try{parsed=parseYaml(text,{schema:"core",merge:false,uniqueKeys:true});yamlOk=true}catch{return {spec:null as MachineSpec4U|null,jsonOk,yamlOk,nonSpecJson:false,nonSpecYaml:false}}}
  const object=parsed&&typeof parsed==="object"&&!Array.isArray(parsed),paths=object&&parsed.paths&&typeof parsed.paths==="object"&&!Array.isArray(parsed.paths);
  const openapi3=typeof parsed?.openapi==="string"&&/^3\./.test(parsed.openapi),swagger2=parsed?.swagger==="2.0";
  if(!object||!paths||(!openapi3&&!swagger2))return {spec:null as MachineSpec4U|null,jsonOk,yamlOk,nonSpecJson:format==="json",nonSpecYaml:format==="yaml"};
  return {spec:{format,kind:openapi3?"openapi3":"swagger2",spec:parsed} as MachineSpec4U,jsonOk,yamlOk,nonSpecJson:false,nonSpecYaml:false};
}
function decodePointer(ref:string){return ref.slice(2).split("/").map(p=>p.replace(/~1/g,"/").replace(/~0/g,"~"))}
export function resolveLocalRef4U(root:any,node:any,metrics:RefMetrics4U,seen=new Set<string>(),depth=0):any{
  if(!node||typeof node!=="object"||Array.isArray(node)||typeof node.$ref!=="string")return node;
  const ref=node.$ref;if(!ref.startsWith("#/")){metrics.operationExternalRefsRejected4u++;throw new Error("4u_external_ref")}
  if(depth>12||seen.has(ref)){metrics.operationRefCyclesRejected4u++;throw new Error("4u_ref_cycle")}
  seen.add(ref);let cur=root;for(const part of decodePointer(ref)){cur=cur?.[part];if(cur===undefined){metrics.operationLocalRefsRejected4u++;throw new Error("4u_ref_missing")}}
  metrics.operationLocalRefsResolved4u++;const resolved=resolveLocalRef4U(root,cur,metrics,new Set(seen),depth+1);return {...resolved,...Object.fromEntries(Object.entries(node).filter(([k])=>k!=="$ref"))};
}
function replaceServerVars(raw:string,vars:any){return raw.replace(/\{([^}]+)\}/g,(_m,n)=>{const d=vars?.[n]?.default;if(d===undefined||d===null)throw new Error("4u_server_variable_missing_default");return encodeURIComponent(String(d))})}
export function resolveServerOrigin4U(spec:MachineSpec4U,contractUrl:string){
  const root=spec.spec,candidates:string[]=[];
  if(spec.kind==="openapi3"){
    const servers=Array.isArray(root.servers)?root.servers:[];
    if(servers.length){let validServer=false;for(const s of servers){if(typeof s?.url!=="string")continue;try{candidates.push(replaceServerVars(s.url,s.variables));validServer=true}catch{}}if(!validServer)return null}
  }else if(root.host){const schemes=Array.isArray(root.schemes)&&root.schemes.length?root.schemes:[new URL(contractUrl).protocol.replace(":","")];for(const scheme of schemes)candidates.push(`${scheme}://${root.host}${String(root.basePath||"")}`)}
  if(!candidates.length)candidates.push(new URL(contractUrl).origin);
  for(const raw of candidates){try{const u=new URL(raw,contractUrl);if(docScopeAllowed(contractUrl,u.toString()))return u.toString().replace(/\/$/,"")}catch{}}
  return null;
}
export function securityRequired4U(spec:any,op:any){const sec=op?.security===undefined?spec?.security:op.security;return Array.isArray(sec)&&sec.length>0}
export function responseHasDeferredRefs4U(op:any){try{return /"\$ref"\s*:/.test(JSON.stringify(op?.responses||{}))}catch{return false}}
export function responseSchemaFingerprint4U(op:any){try{return sha4u(op?.responses||{})}catch{return null}}
