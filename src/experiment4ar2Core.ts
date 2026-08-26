import type {ProjectionExpr} from "./experiment3xCore.js";

export const FOUR_AR2_BASE_SHA="d8b7b0f2b0d4269d6bd39a7509089e75fe41c596";
export const FOUR_AR2_FROZEN_RUN=33018509285;
export const FOUR_AR2_FROZEN_ARTIFACT=9625994752;
export const FOUR_AR2_FROZEN_DIGEST="sha256:2f67410face41d9a49e28d958d526d6ed8c0bd9952c426f8e786311c98406c80";
export const FOUR_AR2_FROZEN_REPORT_FP="914c3a95d23c3275e1f9f27e8d07226d2088cb2e707eea23e3d7d0182ffff9a4";

export const BOUNDARY_SCHEMA={
 name:"missing_4ar2_typed_ir",
 strict:true,
 schema:{type:"object",additionalProperties:false,required:["case_id","provider_candidate_id","decision","method","base_url","path_template","path_bindings","query_bindings","projection","evidence_ids","reason"],properties:{
  case_id:{type:"string"},provider_candidate_id:{type:"string"},decision:{type:"string",enum:["COMPILE","REJECT"]},method:{type:["string","null"],enum:["GET",null]},base_url:{type:["string","null"]},path_template:{type:["string","null"]},
  path_bindings:{type:"array",items:{type:"object",additionalProperties:false,required:["name","source"],properties:{name:{type:"string"},source:{type:"string"}}}},
  query_bindings:{type:"array",items:{type:"object",additionalProperties:false,required:["name","source"],properties:{name:{type:"string"},source:{type:"string"}}}},
  projection:{type:"array",items:{type:"object",additionalProperties:false,required:["output","op","path","name","map_path","key_op","key_name","key_value","value_path","array_path","where_path","equals_op","equals_name","equals_value"],properties:{output:{type:"string"},op:{type:"string",enum:["FIELD","INPUT","LOOKUP","FIND"]},path:{type:["string","null"]},name:{type:["string","null"]},map_path:{type:["string","null"]},key_op:{type:["string","null"],enum:["INPUT","LITERAL",null]},key_name:{type:["string","null"]},key_value:{type:["string","null"]},value_path:{type:["string","null"]},array_path:{type:["string","null"]},where_path:{type:["string","null"]},equals_op:{type:["string","null"],enum:["INPUT","LITERAL",null]},equals_name:{type:["string","null"]},equals_value:{type:["string","null"]}}}},
  evidence_ids:{type:"array",items:{type:"string"}},reason:{type:"string"}
 }}
} as const;

function bindings(rows:any){const out:Record<string,string>={};for(const r of Array.isArray(rows)?rows:[])if(r&&typeof r.name==="string"&&typeof r.source==="string")out[r.name]=r.source;return out;}
function key(op:any,name:any,value:any){if(op==="INPUT")return {op:"INPUT",name:String(name||"")};if(op==="LITERAL")return {op:"LITERAL",value:String(value||"")};throw new Error("invalid_key");}
export function canonicalizeBoundary(raw:any,required:readonly string[]){if(!raw||typeof raw!=="object")throw new Error("boundary_not_object");if(raw.decision==="REJECT")return {case_id:raw.case_id,provider_candidate_id:raw.provider_candidate_id,decision:"REJECT",reason:String(raw.reason||"")};if(raw.decision!=="COMPILE")throw new Error("boundary_decision_invalid");const projection:Record<string,ProjectionExpr>={};for(const row of raw.projection||[]){if(!required.includes(row.output))throw new Error(`unexpected_output:${row.output}`);if(row.op==="FIELD")projection[row.output]={op:"FIELD",path:String(row.path||"")};else if(row.op==="INPUT")projection[row.output]={op:"INPUT",name:String(row.name||"")};else if(row.op==="LOOKUP")projection[row.output]={op:"LOOKUP",map_path:String(row.map_path||""),key:key(row.key_op,row.key_name,row.key_value) as any,value_path:String(row.value_path||"")};else if(row.op==="FIND")projection[row.output]={op:"FIND",array_path:String(row.array_path||""),where_path:String(row.where_path||""),equals:key(row.equals_op,row.equals_name,row.equals_value) as any,value_path:String(row.value_path||"")};else throw new Error(`invalid_op:${row.op}`);}for(const r of required)if(!projection[r])throw new Error(`missing_output:${r}`);return {case_id:raw.case_id,provider_candidate_id:raw.provider_candidate_id,decision:"COMPILE",method:raw.method,base_url:raw.base_url,path_template:raw.path_template,path_bindings:bindings(raw.path_bindings),query_bindings:bindings(raw.query_bindings),projection,evidence_ids:raw.evidence_ids,reason:String(raw.reason||"")};}

export function auditProviderBlindSource(sources:string[]){const joined=sources.join("\n");const providerAssignment=/\b(?:provider_start_url|start_url|base_url)\s*:\s*["'`]https?:\/\//i.test(joined);const caseProviderMap=/["'`][a-z0-9_]+["'`]\s*:\s*["'`]https?:\/\//i.test(joined);return {providerAssignment,caseProviderMap,clean:!providerAssignment&&!caseProviderMap};}
