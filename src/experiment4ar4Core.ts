import {canonicalizeBoundary3,auditProviderBlindSource} from "./experiment4ar3Core.js";
import type {ProjectionPlan} from "./experiment4arCore.js";

export {auditProviderBlindSource};
export const FOUR_AR4_BASE_SHA="c355bd4f57bc1372d263ae2e9c73f7e47d59ebb9";
export const FOUR_AR4_FROZEN_RUN=33025835333;
export const FOUR_AR4_FROZEN_ARTIFACT=9628592181;
export const FOUR_AR4_FROZEN_DIGEST="sha256:5a7aa865e01c86fa08a3b250c64d25efceb46347afafafae7866b350a4378023";
export const FOUR_AR4_FROZEN_REPORT_FP="f243bde38de59f68317c12fafc6351f4bead5491160502b736ba385a9205354f";
export const FOUR_AR4_FROZEN_LEDGER_FP="230d972621cc9d98012b63dd9e780aea7e511ad6a4f54a1fc19fc547db2fb44d";

const projectionItem={type:"object",additionalProperties:false,required:["output","op","path","name","map_path","key_op","key_name","key_value","value_path","array_path","where_path","equals_op","equals_name","equals_value"],properties:{output:{type:"string"},op:{type:"string",enum:["FIELD","INPUT","LOOKUP","FIND"]},path:{type:["string","null"]},name:{type:["string","null"]},map_path:{type:["string","null"]},key_op:{type:["string","null"],enum:["INPUT","LITERAL",null]},key_name:{type:["string","null"]},key_value:{type:["string","null"]},value_path:{type:["string","null"]},array_path:{type:["string","null"]},where_path:{type:["string","null"]},equals_op:{type:["string","null"],enum:["INPUT","LITERAL",null]},equals_name:{type:["string","null"]},equals_value:{type:["string","null"]}}} as const;
export const RESPONSE_REPAIR_SCHEMA={name:"missing_4ar4_response_projection_repair",strict:true,schema:{type:"object",additionalProperties:false,required:["decision","projection","reason"],properties:{decision:{type:"string",enum:["REPAIR","REJECT"]},projection:{type:"array",items:projectionItem},reason:{type:"string"}}}} as const;

function scalarType(v:any){if(v===null)return "null";if(Array.isArray(v))return "array";return typeof v;}
export function summarizeJsonShape(value:any,maxDepth=5,maxKeys=40):any{
 const walk=(v:any,d:number):any=>{if(d>=maxDepth)return {type:scalarType(v)};if(Array.isArray(v)){const samples=v.slice(0,3).map(x=>walk(x,d+1));return {type:"array",length:v.length,item_shapes:[...new Map(samples.map(x=>[JSON.stringify(x),x])).values()].slice(0,3)};}if(v&&typeof v==="object"){const keys=Object.keys(v).sort().slice(0,maxKeys),properties:Record<string,any>={};for(const k of keys)properties[k]=walk(v[k],d+1);return {type:"object",keys,properties,truncated_keys:Object.keys(v).length>keys.length};}return {type:scalarType(v)};};return walk(value,0);
}

export function canonicalizeRepairProjection(rows:any,required:readonly string[],inputNames:readonly string[]):ProjectionPlan{
 const fake={decision:"COMPILE",case_id:"",provider_candidate_id:"",method:"GET",base_url:null,path_template:"/",path_bindings:[],query_bindings:[],projection:rows,evidence_ids:[],reason:""};
 return canonicalizeBoundary3(fake,required,inputNames).projection as ProjectionPlan;
}

export function normalizeDocumentedRelativeEndpoint(baseUrl:string,pathTemplate:string,evidenceText:string){
 const rel=String(pathTemplate||"").trim(),base=String(baseUrl||"").trim();if(!rel||rel.startsWith("/")||rel.includes("?")||rel.includes("#")||rel.split("/").includes(".."))return null;
 let u:URL;try{u=new URL(base);}catch{return null;}if(u.protocol!=="https:"||u.username||u.password)return null;
 if(!evidenceText.includes(base)||!evidenceText.includes(rel))return null;
 const prefix=u.pathname==="/"?"":u.pathname.replace(/\/$/,"");const path=`${prefix}/${rel.replace(/^\/+/,"")}`.replace(/\/{2,}/g,"/");
 return {base_url:u.origin,path_template:path,proof:{documented_base:base,documented_relative_path:rel,derived_path:path}};
}
