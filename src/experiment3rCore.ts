import {isIP} from "node:net";
import {operationExists,sha,type Candidate,type CaseDef,type LiveContract,type ParamInfo} from "./experiment3qCore.js";

export type BindingKind="DIRECT"|"SPLIT"|"LITERAL"|"UNUSED";
export type BindingPlan={name:string;kind:BindingKind;source:string;delimiter:string;index:number;literal:string};
export type ProcurementPlan={case_id:string;decision:"COMPILE"|"REJECT";candidate_id:string;reason:string;bindings:BindingPlan[]};
export type PersistedParam={name:string;in:string;required:boolean;schema:any};
export type ExecutionCase={case_id:string;build:Record<string,unknown>;replay:Record<string,unknown>;required:readonly string[];validator:"repository"|"ability"|"currency"};
export type Readiness={ready:boolean;errors:string[];server_base:string|null;allowed_host:string|null;params:ParamInfo[];operation_raw:any};
export type Recipe={case_id:string;api_key:string;title:string;spec_url:string;spec_fingerprint:string;discovery_descriptor_fingerprint:string;server_base:string;allowed_host:string;operation_path:string;method:"GET";bindings:BindingPlan[];params:PersistedParam[];projection:Record<string,string>;recipe_fingerprint:string};
export type NegativeControl={control:string;executed:boolean;rejected:boolean;evidence:any};

export const EXEC_CASES:Record<string,ExecutionCase>={
  public_source_code_repository_metadata:{case_id:"public_source_code_repository_metadata",build:{owner:"openai",repo:"openai-python"},replay:{owner:"nodejs",repo:"node"},required:["full_name","stargazers_count","language"],validator:"repository"},
  fantasy_role_playing_ability_score_metadata:{case_id:"fantasy_role_playing_ability_score_metadata",build:{ability_index:"cha"},replay:{ability_index:"str"},required:["index","name","full_name"],validator:"ability"},
  currency_metadata:{case_id:"currency_metadata",build:{currency_id:"USD"},replay:{currency_id:"EUR"},required:["code","name"],validator:"currency"}
};

export const ALLOWED_SPLIT_DELIMITERS=new Set([",",":","/","|",";"," "]);

function resolveRef(spec:any,value:any){
  if(!value||typeof value!=="object"||typeof value.$ref!=="string"||!value.$ref.startsWith("#/"))return value;
  let cur:any=spec;for(const raw of value.$ref.slice(2).split("/")){const key=raw.replace(/~1/g,"/").replace(/~0/g,"~");cur=cur?.[key];}return cur??value;
}
function getPathItem(spec:any,path:string){return resolveRef(spec,spec?.paths?.[path]);}
export function getOperationRaw(spec:any,path:string){const item=getPathItem(spec,path);return resolveRef(spec,item?.get)??null;}
function mergeParams(spec:any,path:string):ParamInfo[]{
  const item=getPathItem(spec,path),op=getOperationRaw(spec,path);const all=[...(Array.isArray(item?.parameters)?item.parameters:[]),...(Array.isArray(op?.parameters)?op.parameters:[])];const out=new Map<string,ParamInfo>();
  for(const raw of all){const p=resolveRef(spec,raw);if(!p?.name||!p?.in)continue;const schema=resolveRef(spec,p.schema)||p||{};out.set(`${p.in}:${p.name}`,{name:String(p.name),in:String(p.in),required:Boolean(p.required||p.in==="path"),description:String(p.description||""),schema});}
  return [...out.values()];
}
function expandServer(raw:string,specUrl:string,variables:any){let value=raw;for(const [name,v] of Object.entries(variables||{}))value=value.replace(`{${name}}`,String((v as any)?.default??""));return new URL(value,specUrl).toString().replace(/\/$/,"");}
export function deriveExecutionBase(spec:any,specUrl:string){
  if(typeof spec?.openapi==="string"){
    const server=Array.isArray(spec.servers)?spec.servers[0]:null;if(server?.url)return expandServer(String(server.url),specUrl,server.variables);
    return null;
  }
  if(typeof spec?.swagger==="string"){
    const schemes=Array.isArray(spec.schemes)?spec.schemes.map(String):[];if(schemes.length&&!schemes.includes("https"))return null;if(!spec.host)return null;const basePath=typeof spec.basePath==="string"?spec.basePath:"";return `https://${String(spec.host)}${basePath}`.replace(/\/$/,"");
  }
  return null;
}
export function validateExecutionBase(base:string|null){
  if(!base)return {ok:false,reason:"missing_execution_base",host:null as string|null};
  try{const u=new URL(base);if(u.protocol!=="https:")return {ok:false,reason:"non_https_execution_base",host:null};if(isIP(u.hostname))return {ok:false,reason:"ip_literal_execution_host",host:null};return {ok:true,reason:null as string|null,host:u.hostname};}catch{return {ok:false,reason:"invalid_execution_base",host:null};}
}
function effectiveSecurity(spec:any,op:any){return op&&Object.prototype.hasOwnProperty.call(op,"security")?op.security:spec?.security;}
export function isAnonymousSecurityAllowed(spec:any,op:any){
  const security=effectiveSecurity(spec,op);if(security===undefined||security===null)return true;if(!Array.isArray(security))return false;if(security.length===0)return true;return security.some((req:any)=>req&&typeof req==="object"&&!Array.isArray(req)&&Object.keys(req).length===0);
}
export function executionReadiness(contract:LiveContract,candidate:Candidate):Readiness{
  const errors:string[]=[];if(candidate.method!=="GET")errors.push("non_get_operation");if(!operationExists(contract.spec,candidate.path,"GET"))errors.push("operation_absent_from_contract");const op=getOperationRaw(contract.spec,candidate.path);if(!op)errors.push("operation_missing_raw");const base=deriveExecutionBase(contract.spec,contract.spec_url),baseValidation=validateExecutionBase(base);if(!baseValidation.ok)errors.push(baseValidation.reason!);if(op&&!isAnonymousSecurityAllowed(contract.spec,op))errors.push("auth_required");const params=mergeParams(contract.spec,candidate.path);for(const p of params.filter(x=>x.required))if(!["path","query"].includes(p.in))errors.push(`unsupported_required_parameter_location:${p.name}:${p.in}`);return {ready:errors.length===0,errors,server_base:baseValidation.ok?base:null,allowed_host:baseValidation.host,params,operation_raw:op};
}

function inputKey(source:string){return source.startsWith("$input.")?source.slice(7):null;}
export function bindingShapeErrors(b:BindingPlan){
  const errors:string[]=[];if(b.kind==="UNUSED"){if(b.name||b.source||b.delimiter||b.literal||b.index!==-1)errors.push("unused_slot_not_empty");return errors;}if(!b.name)errors.push("binding_missing_name");
  if(b.kind==="DIRECT"){if(!b.source.startsWith("$input."))errors.push("direct_source_must_input");if(b.delimiter!==""||b.index!==-1||b.literal!=="")errors.push("direct_shape_invalid");}
  else if(b.kind==="SPLIT"){if(!b.source.startsWith("$input."))errors.push("split_source_must_input");if(!ALLOWED_SPLIT_DELIMITERS.has(b.delimiter)||b.delimiter==="")errors.push("split_delimiter_invalid");if(!Number.isInteger(b.index)||b.index<0||b.index>8)errors.push("split_index_invalid");if(b.literal!=="")errors.push("split_literal_must_empty");}
  else if(b.kind==="LITERAL"){if(b.source!==""||b.delimiter!==""||b.index!==-1)errors.push("literal_shape_invalid");if(b.literal==="")errors.push("literal_empty");}
  else errors.push("unsupported_transform");return errors;
}
function transformRaw(b:BindingPlan,input:Record<string,unknown>){
  if(b.kind==="DIRECT"){const key=inputKey(b.source);if(!key||!(key in input))throw new Error(`missing_input:${key??b.source}`);return input[key];}
  if(b.kind==="SPLIT"){const key=inputKey(b.source);if(!key||!(key in input))throw new Error(`missing_input:${key??b.source}`);const parts=String(input[key]).split(b.delimiter);if(b.index<0||b.index>=parts.length)throw new Error(`split_index_out_of_range:${b.name}:${b.index}:${parts.length}`);return parts[b.index];}
  if(b.kind==="LITERAL")return b.literal;throw new Error(`unsupported_transform:${(b as any).kind}`);
}
function schemaTypes(schema:any){const t=schema?.type;if(Array.isArray(t))return t.filter((x:any)=>x!=="null").map(String);return t?[String(t)]:[];}
export function schemaValue(raw:any,schema:any,paramName:string){
  const types=schemaTypes(schema);let value:any=raw;const primary=types[0]??null;
  if(primary==="integer"){const n=typeof raw==="number"?raw:Number(String(raw).trim());if(!Number.isFinite(n)||!Number.isInteger(n))throw new Error(`schema_type_integer:${paramName}`);value=n;}
  else if(primary==="number"){const n=typeof raw==="number"?raw:Number(String(raw).trim());if(!Number.isFinite(n))throw new Error(`schema_type_number:${paramName}`);value=n;}
  else if(primary==="boolean"){if(typeof raw==="boolean")value=raw;else if(String(raw).toLowerCase()==="true")value=true;else if(String(raw).toLowerCase()==="false")value=false;else throw new Error(`schema_type_boolean:${paramName}`);}
  else if(primary==="string")value=String(raw);
  if(Array.isArray(schema?.enum)&&!schema.enum.some((x:any)=>String(x)===String(value)))throw new Error(`schema_enum:${paramName}`);
  if(typeof value==="number"){if(Number.isFinite(schema?.minimum)&&value<schema.minimum)throw new Error(`schema_minimum:${paramName}`);if(Number.isFinite(schema?.maximum)&&value>schema.maximum)throw new Error(`schema_maximum:${paramName}`);}
  if(typeof value==="string"){if(Number.isInteger(schema?.minLength)&&value.length<schema.minLength)throw new Error(`schema_min_length:${paramName}`);if(Number.isInteger(schema?.maxLength)&&value.length>schema.maxLength)throw new Error(`schema_max_length:${paramName}`);if(typeof schema?.pattern==="string"&&schema.pattern.length<=200){try{if(!(new RegExp(schema.pattern)).test(value))throw new Error(`schema_pattern:${paramName}`);}catch(e){if(String(e).includes("schema_pattern:"))throw e;}}}
  return value;
}
export function compileTypedValue(b:BindingPlan,input:Record<string,unknown>,param:ParamInfo|PersistedParam){return schemaValue(transformRaw(b,input),param.schema||{},param.name);}
export function validateBindingProgram(plan:ProcurementPlan,execCase:ExecutionCase,readiness:Readiness){
  const errors:string[]=[];if(plan.case_id!==execCase.case_id)errors.push("case_id_mismatch");if(plan.decision!=="COMPILE")return {errors,bindings:[] as BindingPlan[]};const bindings=plan.bindings.filter(b=>b.kind!=="UNUSED"),declared=new Map(readiness.params.map(p=>[p.name,p])),seen=new Set<string>();
  for(const b of plan.bindings){for(const e of bindingShapeErrors(b))errors.push(`${e}:${b.name||"slot"}`);if(b.kind==="UNUSED")continue;if(seen.has(b.name))errors.push(`duplicate_parameter:${b.name}`);else seen.add(b.name);const p=declared.get(b.name);if(!p){errors.push(`undeclared_parameter:${b.name}`);continue;}if(!["path","query"].includes(p.in)){errors.push(`unsupported_parameter_location:${b.name}:${p.in}`);continue;}try{compileTypedValue(b,execCase.build,p);}catch(e){errors.push(String(e).replace(/^Error:\s*/,""));}}
  for(const p of readiness.params.filter(p=>p.required&&["path","query"].includes(p.in)))if(!bindings.some(b=>b.name===p.name))errors.push(`missing_required_parameter:${p.name}`);
  if(Object.keys(execCase.build).length&&bindings.filter(b=>b.kind==="DIRECT"||b.kind==="SPLIT").length===0)errors.push("no_input_binding");return {errors,bindings};
}
export function compileRequest(server_base:string,allowed_host:string,operation_path:string,params:Array<ParamInfo|PersistedParam>,bindings:BindingPlan[],input:Record<string,unknown>){
  const declared=new Map(params.map(p=>[p.name,p]));let path=operation_path;const q=new URLSearchParams();for(const b of bindings){const p=declared.get(b.name);if(!p)throw new Error(`undeclared_parameter:${b.name}`);const value=compileTypedValue(b,input,p);if(p.in==="path")path=path.replace(new RegExp(`\\{${b.name}\\}`,"g"),encodeURIComponent(String(value)));else if(p.in==="query")q.set(b.name,String(value));else throw new Error(`unsupported_parameter_location:${b.name}:${p.in}`);}if(/\{[^}]+\}/.test(path))throw new Error("unresolved_path_parameter");const base=server_base.replace(/\/$/,"");const url=`${base}${path.startsWith("/")?path:`/${path}`}${q.size?`?${q.toString()}`:""}`;const u=new URL(url);if(u.protocol!=="https:"||u.hostname!==allowed_host||isIP(u.hostname))throw new Error("execution_host_not_allowed");return url;
}

function ciEqual(a:any,b:any){return typeof a==="string"&&typeof b==="string"&&a.toLowerCase()===b.toLowerCase();}
export function semanticValidate(execCase:ExecutionCase,input:Record<string,unknown>,out:Record<string,any>){
  if(execCase.validator==="repository")return ciEqual(out.full_name,`${input.owner}/${input.repo}`)&&Number.isFinite(out.stargazers_count)&&out.stargazers_count>=0&&(out.language===null||(typeof out.language==="string"&&out.language.length>0));
  if(execCase.validator==="ability")return ciEqual(out.index,input.ability_index)&&typeof out.name==="string"&&out.name.length>0&&typeof out.full_name==="string"&&out.full_name.length>0;
  if(execCase.validator==="currency")return ciEqual(out.code,input.currency_id)&&typeof out.name==="string"&&out.name.length>0;return false;
}
function objectNodes(root:any){const nodes:{path:string;value:Record<string,any>}[]=[];const seen=new Set<any>();function walk(v:any,path:string,depth:number){if(depth>12||v===null||v===undefined||typeof v!=="object"||seen.has(v))return;seen.add(v);if(Array.isArray(v)){for(let i=0;i<Math.min(v.length,100);i++)walk(v[i],path?`${path}.${i}`:String(i),depth+1);return;}nodes.push({path,value:v});for(const [k,val] of Object.entries(v))if(val&&typeof val==="object")walk(val,path?`${path}.${k}`:k,depth+1);}walk(root,"",0);return nodes;}
function keyFor(obj:Record<string,any>,wanted:string){return Object.keys(obj).find(k=>k===wanted)??Object.keys(obj).find(k=>k.toLowerCase()===wanted.toLowerCase())??null;}
export function induceProjection(body:any,execCase:ExecutionCase,input:Record<string,unknown>){
  const matches:any[]=[];for(const node of objectNodes(body)){const keys=execCase.required.map(w=>keyFor(node.value,w));if(keys.some(k=>!k))continue;const projected:Record<string,any>={},projection:Record<string,string>={};for(let i=0;i<execCase.required.length;i++){const wanted=execCase.required[i],actual=keys[i]!;projected[wanted]=node.value[actual];projection[wanted]=node.path?`${node.path}.${actual}`:actual;}if(semanticValidate(execCase,input,projected))matches.push({projection,depth:node.path?node.path.split(".").length:0,path:node.path});}
  matches.sort((a,b)=>a.depth-b.depth||a.path.localeCompare(b.path));if(!matches.length)throw new Error("semantic_projection_not_found");return matches[0].projection as Record<string,string>;
}
function getPath(v:any,path:string){return path.split(".").reduce((x,k)=>Array.isArray(x)&&/^\d+$/.test(k)?x[Number(k)]:x?.[k],v);}
export function project(body:any,projection:Record<string,string>){const out:Record<string,any>={};for(const [k,p] of Object.entries(projection))out[k]=getPath(body,p);return out;}
export function makeRecipe(execCase:ExecutionCase,descriptor:any,readiness:Readiness,bindings:BindingPlan[],projection:Record<string,string>):Recipe{
  if(!readiness.server_base||!readiness.allowed_host)throw new Error("readiness_missing_base");const params=readiness.params.filter(p=>p.required||bindings.some(b=>b.name===p.name)).map(p=>({name:p.name,in:p.in,required:p.required,schema:p.schema}));const base={case_id:execCase.case_id,api_key:descriptor.api_key,title:descriptor.title,spec_url:descriptor.spec_url,spec_fingerprint:descriptor.spec_fingerprint,discovery_descriptor_fingerprint:descriptor.descriptor_fingerprint,server_base:readiness.server_base,allowed_host:readiness.allowed_host,operation_path:descriptor.operation_path,method:"GET" as const,bindings,params,projection};return {...base,recipe_fingerprint:sha(base)};
}
export function hasRecipeFingerprintEvidence(recipes:Recipe[]){return recipes.length>=2&&recipes.every(r=>Boolean(r.spec_fingerprint&&r.discovery_descriptor_fingerprint&&r.recipe_fingerprint));}

function syntheticContract(spec:any,path:string):LiveContract{return {api_key:"synthetic.test",version:"1",spec_url:"https://synthetic.test/openapi.json",title:"Synthetic",spec,spec_fingerprint:sha(spec),operations:[{path,method:"GET",operation_id:"",summary:"",description:"",params:[],response_properties:["code","name"]}],registry_rank:1,registry_score:1};}
function unused():BindingPlan{return {name:"",kind:"UNUSED",source:"",delimiter:"",index:-1,literal:""};}
function padded(bindings:BindingPlan[]){return [...bindings,...Array.from({length:6},unused)].slice(0,6);}
export function runNegativeControls():NegativeControl[]{
  const controls:NegativeControl[]=[];let x=validateExecutionBase("http://example.com");controls.push({control:"non_https_execution_base",executed:true,rejected:!x.ok,evidence:x});x=validateExecutionBase("https://127.0.0.1");controls.push({control:"ip_literal_execution_host",executed:true,rejected:!x.ok,evidence:x});
  const authSpec={openapi:"3.0.3",servers:[{url:"https://synthetic.test"}],security:[{apiKey:[]}],paths:{"/items/{id}":{get:{parameters:[{name:"id",in:"path",required:true,schema:{type:"string"}}],responses:{"200":{description:"ok"}}}}}};const authContract=syntheticContract(authSpec,"/items/{id}"),authCandidate:any={candidate_id:"a",api_key:"synthetic.test",title:"Synthetic",path:"/items/{id}",method:"GET",operation_id:"",summary:"",description:"",params:[],response_properties:[],score:1,input_hits:1,output_hits:1,registry_rank:1};const authReady=executionReadiness(authContract,authCandidate);controls.push({control:"auth_required_operation",executed:true,rejected:!authReady.ready&&authReady.errors.includes("auth_required"),evidence:authReady.errors});
  const publicSpec={openapi:"3.0.3",servers:[{url:"https://synthetic.test"}],paths:{"/items/{id}":{get:{parameters:[{name:"id",in:"path",required:true,schema:{type:"string"}},{name:"q",in:"query",required:false,schema:{type:"string"}}],responses:{"200":{description:"ok"}}}}}};const contract=syntheticContract(publicSpec,"/items/{id}"),candidate={...authCandidate},ready=executionReadiness(contract,candidate),execCase:ExecutionCase={case_id:"currency_metadata",build:{currency_id:"USD"},replay:{currency_id:"EUR"},required:["code","name"],validator:"currency"};
  const absent={...candidate,path:"/__missing__"};const absentReady=executionReadiness(contract,absent);controls.push({control:"operation_absent_from_contract",executed:true,rejected:!absentReady.ready&&absentReady.errors.includes("operation_absent_from_contract"),evidence:absentReady.errors});
  let plan:ProcurementPlan={case_id:execCase.case_id,decision:"COMPILE",candidate_id:"a",reason:"control",bindings:padded([{name:"missing",kind:"DIRECT",source:"$input.currency_id",delimiter:"",index:-1,literal:""}])};let v=validateBindingProgram(plan,execCase,ready);controls.push({control:"undeclared_bound_parameter",executed:true,rejected:v.errors.some(e=>e.startsWith("undeclared_parameter:")),evidence:v.errors});
  plan={...plan,bindings:padded([])};v=validateBindingProgram(plan,execCase,ready);controls.push({control:"missing_required_parameter",executed:true,rejected:v.errors.some(e=>e.startsWith("missing_required_parameter:")),evidence:v.errors});
  plan={...plan,bindings:padded([{name:"id",kind:"DIRECT",source:"$input.__missing__",delimiter:"",index:-1,literal:""}])};v=validateBindingProgram(plan,execCase,ready);controls.push({control:"direct_missing_input",executed:true,rejected:v.errors.some(e=>e.startsWith("missing_input:")),evidence:v.errors});
  plan={...plan,bindings:padded([{name:"id",kind:"SPLIT",source:"$input.currency_id",delimiter:",",index:8,literal:""}])};v=validateBindingProgram(plan,execCase,ready);controls.push({control:"split_out_of_range",executed:true,rejected:v.errors.some(e=>e.startsWith("split_index_out_of_range:")),evidence:v.errors});
  plan={...plan,bindings:padded([{name:"id",kind:"CONCAT" as any,source:"$input.currency_id",delimiter:"",index:-1,literal:""}])};v=validateBindingProgram(plan,execCase,ready);controls.push({control:"unsupported_transform",executed:true,rejected:v.errors.some(e=>e.startsWith("unsupported_transform:")),evidence:v.errors});
  const semanticRejected=!semanticValidate(execCase,execCase.build,{code:"EUR",name:"Euro"});controls.push({control:"semantic_identity_mismatch",executed:true,rejected:semanticRejected,evidence:{input:execCase.build,output:{code:"EUR",name:"Euro"}}});
  const fake:Recipe={case_id:"a",api_key:"x",title:"x",spec_url:"https://x.test/spec",spec_fingerprint:"spec",discovery_descriptor_fingerprint:"desc",server_base:"https://x.test",allowed_host:"x.test",operation_path:"/x",method:"GET",bindings:[],params:[],projection:{},recipe_fingerprint:"recipe"},fake2={...fake,case_id:"b"};const good=hasRecipeFingerprintEvidence([fake,fake2]),bad=hasRecipeFingerprintEvidence([{...fake,spec_fingerprint:""},fake2]);controls.push({control:"empty_recipe_fingerprint_evidence",executed:true,rejected:good&&!bad,evidence:{original:good,malformed:bad}});return controls;
}
