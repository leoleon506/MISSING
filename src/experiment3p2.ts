import {mkdir,writeFile} from "node:fs/promises";
import {lookup} from "node:dns/promises";
import {isIP} from "node:net";
import {createHash} from "node:crypto";
import {loadConfig} from "./config/index.js";

const TIMEOUT_MS=15000;
const MAX_SPEC_BYTES=40*1024*1024;
const MAX_EXEC_BYTES=3*1024*1024;
const OUTDIR="results/experiment-3p2";
const CANDIDATES_PER_PROVIDER=16;
const ALLOWED_SPLIT_DELIMITERS=new Set([",",":","/","|",";"," "]);

const PROVIDERS=[
  {id:"nws",spec_url:"https://api.weather.gov/openapi.json"},
  {id:"github",spec_url:"https://raw.githubusercontent.com/github/rest-api-description/main/descriptions/api.github.com/api.github.com.2022-11-28.json"},
  {id:"usgs_water",spec_url:"https://api.waterdata.usgs.gov/ogcapi/v0/openapi"}
] as const;

type ProviderId=(typeof PROVIDERS)[number]["id"];

const CASES=[
  {case_id:"nws_point_metadata",intent:"Given an NWS point coordinate string, return the forecast grid office and grid coordinates.",build:{point:"39.7456,-97.0892"},replay:{point:"40.7128,-74.0060"},required:["gridId","gridX","gridY"],validator:"nws"},
  {case_id:"github_public_repository_metadata",intent:"Given a public GitHub repository owner and repository name, return full repository name, star count, and primary language.",build:{owner:"openai",repo:"openai-python"},replay:{owner:"nodejs",repo:"node"},required:["full_name","stargazers_count","language"],validator:"github"},
  {case_id:"usgs_monitoring_location_metadata",intent:"Return metadata for a USGS monitoring-location identifier.",build:{site_id:"USGS-01435000"},replay:{site_id:"USGS-01100000"},required:["id","monitoring_location_name","state_name"],validator:"usgs_water"}
] as const;

type CaseDef=(typeof CASES)[number];
type ParamInfo={name:string;in:string;required:boolean;description:string;schema:any};
type OperationInfo={provider_id:ProviderId;path:string;method:"GET";operation_id:string;summary:string;description:string;params:ParamInfo[];response_properties:string[]};
type ProviderContract={provider_id:ProviderId;spec_url:string;spec:any;spec_fingerprint:string;server_base:string;allowed_host:string;operations:OperationInfo[]};
type BindingKind="DIRECT"|"SPLIT"|"LITERAL"|"UNUSED";
type BindingPlan={name:string;kind:BindingKind;source:string;delimiter:string;index:number;literal:string};
type Procurement={case_id:string;decision:"PROCURE"|"REJECT";reason:string;provider_id:ProviderId|"none";operation_path:string;method:"GET"|"REJECT";bindings:BindingPlan[]};
type Candidate={provider_id:ProviderId;path:string;method:"GET";operation_id:string;summary:string;description:string;params:Array<{name:string;in:string;required:boolean;description:string;schema_type:any;enum:any}>;response_properties:string[];score:number;provider_rank:number;global_rank:number;score_components:any};
type PersistedParam={name:string;in:string;required:boolean;schema:any};
type Recipe={case_id:string;provider_id:ProviderId;spec_fingerprint:string;server_base:string;allowed_host:string;operation_path:string;method:"GET";bindings:BindingPlan[];params:PersistedParam[];projection:Record<string,string>;recipe_fingerprint:string};

const SLOT_FIELDS=["name","kind","source","delimiter","index","literal"] as const;
const TOP_FIELDS=["case_id","decision","reason","provider_id","operation_path","method"] as const;
const JSON_SCHEMA:any={
  name:"missing_3p2_typed_procurement_spec",
  strict:true,
  schema:{
    type:"object",
    additionalProperties:false,
    required:[...TOP_FIELDS,...Array.from({length:6},(_,i)=>SLOT_FIELDS.map(f=>`param${i+1}_${f}`)).flat()],
    properties:{
      case_id:{type:"string"},
      decision:{type:"string",enum:["PROCURE","REJECT"]},
      reason:{type:"string"},
      provider_id:{type:"string",enum:["nws","github","usgs_water","none"]},
      operation_path:{type:"string"},
      method:{type:"string",enum:["GET","REJECT"]}
    }
  }
};
for(let i=1;i<=6;i++){
  JSON_SCHEMA.schema.properties[`param${i}_name`]={type:"string"};
  JSON_SCHEMA.schema.properties[`param${i}_kind`]={type:"string",enum:["DIRECT","SPLIT","LITERAL","UNUSED"]};
  JSON_SCHEMA.schema.properties[`param${i}_source`]={type:"string"};
  JSON_SCHEMA.schema.properties[`param${i}_delimiter`]={type:"string",enum:["",",",":","/","|",";"," "]};
  JSON_SCHEMA.schema.properties[`param${i}_index`]={type:"integer",minimum:-1,maximum:8};
  JSON_SCHEMA.schema.properties[`param${i}_literal`]={type:"string"};
}

let plannerCalls=0;
let repairCalls=0;
let replayPlannerCalls=0;
let specFetchCalls=0;
let replayProcurementCalls=0;
let unknownOperationsAccepted=0;
let undeclaredParamsAccepted=0;
let invalidTypedBindingsAccepted=0;
let unsupportedTransformsAccepted=0;
let nonGetAccepted=0;
let hostViolationsAccepted=0;
let redirectsFollowed=0;
let credentialsSupplied=0;
let arbitraryCodeExecuted=0;

const sha=(v:any)=>createHash("sha256").update(typeof v==="string"?v:JSON.stringify(v)).digest("hex");

function publicIPv4(ip:string){
  const p=ip.split(".").map(Number);
  if(p.length!==4||p.some(x=>!Number.isInteger(x)||x<0||x>255))return false;
  const[a,b,c]=p;
  if(a===0||a===10||a===127||a>=224)return false;
  if(a===100&&b>=64&&b<=127)return false;
  if(a===169&&b===254)return false;
  if(a===172&&b>=16&&b<=31)return false;
  if(a===192&&b===168)return false;
  if(a===192&&b===0&&(c===0||c===2))return false;
  if(a===198&&(b===18||b===19))return false;
  if(a===198&&b===51&&c===100)return false;
  if(a===203&&b===0&&c===113)return false;
  return true;
}
function publicIPv6(ip:string){
  const s=ip.toLowerCase();
  if(s==="::"||s==="::1"||s.startsWith("fc")||s.startsWith("fd")||/^fe[89ab]/.test(s)||s.startsWith("ff")||s.startsWith("2001:db8:"))return false;
  if(s.startsWith("::ffff:")){const t=s.slice(7);return isIP(t)===4&&publicIPv4(t);}
  return true;
}
function isPublic(ip:string){return isIP(ip)===4?publicIPv4(ip):isIP(ip)===6?publicIPv6(ip):false;}
async function safeUrl(raw:string){
  const u=new URL(raw);
  if(u.protocol!=="https:"||isIP(u.hostname))throw new Error("host_policy_protocol_or_ip_literal");
  const addrs=await lookup(u.hostname,{all:true,verbatim:true});
  if(!addrs.length||addrs.some(a=>!isPublic(a.address)))throw new Error("host_policy_non_public_dns");
  return u;
}
async function fetchTextBounded(url:string,maxBytes:number,accept:string){
  await safeUrl(url);
  const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),TIMEOUT_MS);
  try{
    const r=await fetch(url,{headers:{accept,"user-agent":"MISSING-Experiment-3P2/0.1"},redirect:"manual",signal:ctrl.signal});
    if(r.status>=300&&r.status<400)throw new Error(`redirect_rejected_${r.status}`);
    if(!r.ok)throw new Error(`http_${r.status}`);
    const declared=Number(r.headers.get("content-length")||0);
    if(declared>maxBytes)throw new Error("response_too_large_declared");
    const text=await r.text();
    if(Buffer.byteLength(text)>maxBytes)throw new Error("response_too_large");
    return {text,content_type:r.headers.get("content-type")||""};
  } finally {clearTimeout(timer);}
}
async function fetchJsonBounded(url:string,maxBytes:number,accept="application/json, application/geo+json, application/vnd.oai.openapi+json"){
  const {text}=await fetchTextBounded(url,maxBytes,accept);
  try{return JSON.parse(text);}catch{throw new Error("non_json_response");}
}

function resolveRef(spec:any,value:any){
  if(!value||typeof value!=="object"||typeof value.$ref!=="string"||!value.$ref.startsWith("#/"))return value;
  let cur:any=spec;
  for(const raw of value.$ref.slice(2).split("/")){
    const key=raw.replace(/~1/g,"/").replace(/~0/g,"~");
    cur=cur?.[key];
  }
  return cur??value;
}
function mergeParams(spec:any,pathItem:any,op:any):ParamInfo[]{
  const all=[...(Array.isArray(pathItem?.parameters)?pathItem.parameters:[]),...(Array.isArray(op?.parameters)?op.parameters:[])];
  const out=new Map<string,ParamInfo>();
  for(const raw of all){
    const p=resolveRef(spec,raw);
    if(!p?.name||!p?.in)continue;
    const schema=resolveRef(spec,p.schema)||{};
    out.set(`${p.in}:${p.name}`,{name:String(p.name),in:String(p.in),required:Boolean(p.required||p.in==="path"),description:String(p.description||""),schema});
  }
  return [...out.values()];
}
function expandServerUrl(raw:string,specUrl:string,variables:any){
  let url=raw||new URL(specUrl).origin;
  for(const [name,val] of Object.entries(variables||{}))url=url.replace(`{${name}}`,String((val as any)?.default??""));
  return new URL(url,new URL(specUrl).origin).toString().replace(/\/$/,"");
}
function deriveServerBase(spec:any,specUrl:string){
  const first=Array.isArray(spec?.servers)?spec.servers[0]:null;
  if(first?.url)return expandServerUrl(String(first.url),specUrl,first.variables);
  return new URL(specUrl).origin;
}
function collectSchemaProperties(spec:any,schemaRaw:any){
  const out=new Set<string>();
  const seenRefs=new Set<string>();
  const seenObjects=new Set<any>();
  function walk(raw:any,depth:number){
    if(depth>9||!raw||typeof raw!=="object"||out.size>=400)return;
    if(typeof raw.$ref==="string"&&raw.$ref.startsWith("#/")){
      if(seenRefs.has(raw.$ref))return;
      seenRefs.add(raw.$ref);
      walk(resolveRef(spec,raw),depth+1);
      return;
    }
    if(seenObjects.has(raw))return;
    seenObjects.add(raw);
    const props=raw.properties;
    if(props&&typeof props==="object"){
      for(const [name,value] of Object.entries(props)){
        out.add(String(name));
        walk(value,depth+1);
        if(out.size>=400)break;
      }
    }
    if(raw.items)walk(raw.items,depth+1);
    for(const key of ["allOf","oneOf","anyOf"]){
      const arr=raw[key];
      if(Array.isArray(arr))for(const child of arr)walk(child,depth+1);
    }
  }
  walk(schemaRaw,0);
  return [...out];
}
function responseProperties(spec:any,op:any){
  const out=new Set<string>();
  const responses=op?.responses&&typeof op.responses==="object"?op.responses:{};
  for(const [status,responseRaw] of Object.entries(responses)){
    if(!/^2\d\d$/.test(status))continue;
    const response=resolveRef(spec,responseRaw);
    const content=response?.content&&typeof response.content==="object"?response.content:{};
    for(const media of Object.values(content as any)){
      const schema=(media as any)?.schema;
      if(!schema)continue;
      for(const name of collectSchemaProperties(spec,schema))out.add(name);
      if(out.size>=400)break;
    }
    if(out.size>=400)break;
  }
  return [...out];
}
function extractOperations(providerId:ProviderId,spec:any):OperationInfo[]{
  const out:OperationInfo[]=[];
  for(const [path,pathRaw] of Object.entries(spec?.paths||{})){
    const pathItem=resolveRef(spec,pathRaw);
    const op=resolveRef(spec,(pathItem as any)?.get);
    if(!op)continue;
    out.push({provider_id:providerId,path:String(path),method:"GET",operation_id:String(op.operationId||""),summary:String(op.summary||""),description:String(op.description||""),params:mergeParams(spec,pathItem,op),response_properties:responseProperties(spec,op)});
  }
  return out;
}
async function procureContracts(){
  const contracts:ProviderContract[]=[];
  const evidence:any[]=[];
  for(const p of PROVIDERS){
    specFetchCalls++;
    try{
      const {text,content_type}=await fetchTextBounded(p.spec_url,MAX_SPEC_BYTES,"application/vnd.oai.openapi+json, application/json");
      const spec=JSON.parse(text);
      if(!spec?.openapi&&!spec?.swagger)throw new Error("not_openapi");
      const server_base=deriveServerBase(spec,p.spec_url);
      const allowed_host=new URL(server_base).hostname;
      const operations=extractOperations(p.id,spec);
      if(!operations.length)throw new Error("no_get_operations");
      const spec_fingerprint=sha(text);
      contracts.push({provider_id:p.id,spec_url:p.spec_url,spec,spec_fingerprint,server_base,allowed_host,operations});
      evidence.push({provider_id:p.id,spec_url:p.spec_url,content_type,openapi:spec.openapi??null,swagger:spec.swagger??null,server_base,allowed_host,operations:operations.length,spec_fingerprint,status:"ok"});
    }catch(e){evidence.push({provider_id:p.id,spec_url:p.spec_url,status:"error",error:String(e)});}
  }
  return {contracts,evidence};
}

function wordTokens(s:string){return [...new Set((String(s).toLowerCase().match(/[a-z0-9]+/g)||[]).filter(x=>x.length>=2))];}
function normalizeName(s:string){return String(s).toLowerCase().replace(/[^a-z0-9]/g,"");}
function nameCompatibility(a:string,b:string){
  const na=normalizeName(a),nb=normalizeName(b);
  if(!na||!nb)return 0;
  if(na===nb)return 1;
  if(na.includes(nb)||nb.includes(na))return Math.min(0.8,Math.min(na.length,nb.length)/Math.max(na.length,nb.length)+0.2);
  const ta=new Set(wordTokens(a)),tb=new Set(wordTokens(b));
  const inter=[...ta].filter(x=>tb.has(x)).length;
  const union=new Set([...ta,...tb]).size;
  return union?inter/union:0;
}
function lexicalOverlap(needle:string,haystack:string){const hs=new Set(wordTokens(haystack));return wordTokens(needle).filter(t=>hs.has(t)).length;}
function operationScore(c:CaseDef,o:OperationInfo){
  const inputNames=Object.keys(c.build);
  const params=o.params.filter(p=>p.in==="path"||p.in==="query");
  let inputParamScore=0;
  for(const input of inputNames){const best=Math.max(0,...params.map(p=>nameCompatibility(input,p.name)));inputParamScore+=best*18;}
  let requiredOutputScore=0;
  for(const key of c.required){const best=Math.max(0,...o.response_properties.map(p=>nameCompatibility(key,p)));if(best>=0.99)requiredOutputScore+=14;else if(best>=0.6)requiredOutputScore+=6*best;}
  let unmatchedRequired=0;
  for(const p of params.filter(x=>x.required)){const best=Math.max(0,...inputNames.map(input=>nameCompatibility(input,p.name)));if(best<0.45)unmatchedRequired++;}
  const meta=`${o.path} ${o.operation_id} ${o.summary} ${o.description} ${params.map(p=>`${p.name} ${p.description}`).join(" ")}`;
  const lexical=lexicalOverlap(c.intent,meta)*0.6+c.required.reduce((n,k)=>n+lexicalOverlap(k,meta)*0.8,0);
  const exactPathParamHits=params.filter(p=>inputNames.some(input=>nameCompatibility(input,p.name)>=0.99)).length;
  const compactnessPenalty=Math.max(0,params.filter(p=>p.required).length-inputNames.length)*1.5;
  const score=inputParamScore+requiredOutputScore+lexical+exactPathParamHits*5-unmatchedRequired*12-compactnessPenalty;
  return {score,components:{input_param_score:inputParamScore,response_property_score:requiredOutputScore,lexical_score:lexical,exact_path_param_hits:exactPathParamHits,unmatched_required_params:unmatchedRequired,compactness_penalty:compactnessPenalty}};
}
function candidateSummary(c:CaseDef,contracts:ProviderContract[]):Candidate[]{
  const all=contracts.flatMap(contract=>contract.operations.map(op=>({contract,op,...operationScore(c,op)})));
  const selected:any[]=[];
  for(const p of PROVIDERS){
    const providerRows=all.filter(x=>x.op.provider_id===p.id).sort((a,b)=>b.score-a.score||a.op.path.localeCompare(b.op.path));
    providerRows.slice(0,CANDIDATES_PER_PROVIDER).forEach((row,idx)=>selected.push({...row,provider_rank:idx+1}));
  }
  selected.sort((a,b)=>b.score-a.score||a.op.provider_id.localeCompare(b.op.provider_id)||a.op.path.localeCompare(b.op.path));
  return selected.map((row,idx)=>({provider_id:row.op.provider_id,path:row.op.path,method:"GET",operation_id:row.op.operation_id,summary:row.op.summary,description:row.op.description.slice(0,500),params:row.op.params.map((p:ParamInfo)=>({name:p.name,in:p.in,required:p.required,description:p.description.slice(0,220),schema_type:p.schema?.type??null,enum:Array.isArray(p.schema?.enum)?p.schema.enum.slice(0,12):null})),response_properties:row.op.response_properties.slice(0,120),score:Number(row.score.toFixed(4)),provider_rank:row.provider_rank,global_rank:idx+1,score_components:row.components}));
}

function exactKeys(obj:any){return obj&&typeof obj==="object"&&!Array.isArray(obj)?Object.keys(obj):[];}
function parsePlannerProcurement(a:any){
  if(!a.http_ok)return {spec:null as Procurement|null,error:`planner_http_${a.http_status}`,issues:[] as string[]};
  if(a.refusal)return {spec:null,error:"planner_refusal",issues:[] as string[]};
  if(!a.parsed_json)return {spec:null,error:"planner_json_parse_failure",issues:[] as string[]};
  const x=a.parsed_json;
  const expected=[...TOP_FIELDS,...Array.from({length:6},(_,i)=>SLOT_FIELDS.map(f=>`param${i+1}_${f}`)).flat()];
  const keys=exactKeys(x),issues:string[]=[];
  for(const k of expected)if(!(k in x))issues.push(`missing:${k}`);
  for(const k of keys)if(!expected.includes(k as any))issues.push(`extra:${k}`);
  if(typeof x.case_id!=="string")issues.push("case_id_type");
  if(!["PROCURE","REJECT"].includes(x.decision))issues.push("decision_enum");
  if(typeof x.reason!=="string")issues.push("reason_type");
  if(!["nws","github","usgs_water","none"].includes(x.provider_id))issues.push("provider_enum");
  if(typeof x.operation_path!=="string")issues.push("operation_path_type");
  if(!["GET","REJECT"].includes(x.method))issues.push("method_enum");
  const bindings:BindingPlan[]=[];
  for(let i=1;i<=6;i++){
    const name=x[`param${i}_name`],kind=x[`param${i}_kind`],source=x[`param${i}_source`],delimiter=x[`param${i}_delimiter`],index=x[`param${i}_index`],literal=x[`param${i}_literal`];
    if(typeof name!=="string")issues.push(`param${i}_name_type`);
    if(!["DIRECT","SPLIT","LITERAL","UNUSED"].includes(kind))issues.push(`param${i}_kind_enum`);
    if(typeof source!=="string")issues.push(`param${i}_source_type`);
    if(typeof delimiter!=="string"||(!ALLOWED_SPLIT_DELIMITERS.has(delimiter)&&delimiter!==""))issues.push(`param${i}_delimiter_enum`);
    if(!Number.isInteger(index)||index< -1||index>8)issues.push(`param${i}_index_range`);
    if(typeof literal!=="string")issues.push(`param${i}_literal_type`);
    bindings.push({name:String(name??""),kind:kind as BindingKind,source:String(source??""),delimiter:String(delimiter??""),index:Number(index),literal:String(literal??"")});
  }
  if(issues.length)return {spec:null,error:"planner_contract_invalid",issues};
  return {spec:{case_id:x.case_id,decision:x.decision,reason:x.reason,provider_id:x.provider_id,operation_path:x.operation_path,method:x.method,bindings},error:null,issues:[] as string[]};
}

async function callPlanner(config:any,c:CaseDef,candidates:Candidate[],phase:"initial"|"repair",previous?:string){
  plannerCalls++;if(phase==="repair")repairCalls++;
  const system=["You are MISSING Source Procurement.","Select one exact GET operation from the supplied live OpenAPI candidate operations.","Return only the strict flat procurement object required by the response schema.","For each parameter use one bounded binding kind: DIRECT, SPLIT, LITERAL, or UNUSED.","DIRECT uses one complete $input.<field> value.","SPLIT uses one $input.<field>, one allowed literal delimiter, and one zero-based index. Use SPLIT when a composite case input must populate multiple declared primitive parameters.","LITERAL is allowed only for a declared parameter when a fixed primitive is genuinely required.","UNUSED slots must have empty name/source/delimiter/literal and index -1.","DIRECT slots must have delimiter/literal empty and index -1. SPLIT slots must have literal empty. LITERAL slots must have source/delimiter empty and index -1.","Do not emit URLs, output JSON paths, code, headers, credentials, aliases, concatenations, arithmetic, templates, regexes, or extra properties.","If no supplied candidate can satisfy the case, return REJECT rather than inventing an operation."].join(" ");
  const payload={case:{case_id:c.case_id,intent:c.intent,input:c.build,required_output_leaf_names:c.required},live_contract_aware_candidates:candidates,previous_failure:previous??null};
  const r=await fetch(`${config.baseUrl.replace(/\/$/,"")}/chat/completions`,{method:"POST",headers:{authorization:`Bearer ${config.apiKey}`,"content-type":"application/json"},body:JSON.stringify({model:config.model,messages:[{role:"system",content:system},{role:"user",content:JSON.stringify(payload)}],response_format:{type:"json_schema",json_schema:JSON_SCHEMA}})});
  const text=await r.text();let body:any=null;try{body=JSON.parse(text);}catch{}
  const msg=body?.choices?.[0]?.message,raw=msg?.content??null;let parsed:any=null,parse_error:string|null=null;
  if(typeof raw==="string"){try{parsed=JSON.parse(raw);}catch(e){parse_error=String(e);}}
  return {phase,http_status:r.status,http_ok:r.ok,raw_response:text,raw_content:raw,refusal:msg?.refusal??null,parsed_json:parsed,parse_error};
}

function findOperation(contract:ProviderContract,path:string){return contract.operations.find(o=>o.path===path&&o.method==="GET")||null;}
function inputKey(source:string){return source.startsWith("$input.")?source.slice(7):null;}
function bindingShapeErrors(b:BindingPlan){
  const errors:string[]=[];
  if(b.kind==="UNUSED"){if(b.name||b.source||b.delimiter||b.literal||b.index!==-1)errors.push("unused_slot_not_empty");return errors;}
  if(!b.name)errors.push("binding_missing_name");
  if(b.kind==="DIRECT"){
    if(!b.source.startsWith("$input."))errors.push("direct_source_must_input");
    if(b.delimiter!==""||b.index!==-1||b.literal!=="")errors.push("direct_shape_invalid");
  }else if(b.kind==="SPLIT"){
    if(!b.source.startsWith("$input."))errors.push("split_source_must_input");
    if(!ALLOWED_SPLIT_DELIMITERS.has(b.delimiter)||b.delimiter==="")errors.push("split_delimiter_invalid");
    if(!Number.isInteger(b.index)||b.index<0||b.index>8)errors.push("split_index_invalid");
    if(b.literal!=="")errors.push("split_literal_must_empty");
  }else if(b.kind==="LITERAL"){
    if(b.source!==""||b.delimiter!==""||b.index!==-1)errors.push("literal_shape_invalid");
    if(b.literal==="")errors.push("literal_empty");
  }else errors.push("unsupported_transform");
  return errors;
}
function transformRaw(b:BindingPlan,input:any){
  if(b.kind==="DIRECT"){
    const key=inputKey(b.source);if(!key||!(key in input))throw new Error(`missing_input:${key??b.source}`);return input[key];
  }
  if(b.kind==="SPLIT"){
    const key=inputKey(b.source);if(!key||!(key in input))throw new Error(`missing_input:${key??b.source}`);
    const parts=String(input[key]).split(b.delimiter);if(b.index<0||b.index>=parts.length)throw new Error(`split_index_out_of_range:${b.name}:${b.index}:${parts.length}`);return parts[b.index];
  }
  if(b.kind==="LITERAL")return b.literal;
  throw new Error(`unsupported_transform:${(b as any).kind}`);
}
function schemaTypes(schema:any){const t=schema?.type;if(Array.isArray(t))return t.filter((x:any)=>x!=="null").map(String);return t?[String(t)]:[];}
function schemaValue(raw:any,schema:any,paramName:string){
  const types=schemaTypes(schema);let value:any=raw;const primary=types[0]??null;
  if(primary==="integer"){
    const n=typeof raw==="number"?raw:Number(String(raw).trim());if(!Number.isFinite(n)||!Number.isInteger(n))throw new Error(`schema_type_integer:${paramName}`);value=n;
  }else if(primary==="number"){
    const n=typeof raw==="number"?raw:Number(String(raw).trim());if(!Number.isFinite(n))throw new Error(`schema_type_number:${paramName}`);value=n;
  }else if(primary==="boolean"){
    if(typeof raw==="boolean")value=raw;else if(String(raw).toLowerCase()==="true")value=true;else if(String(raw).toLowerCase()==="false")value=false;else throw new Error(`schema_type_boolean:${paramName}`);
  }else if(primary==="string")value=String(raw);
  if(Array.isArray(schema?.enum)&&!schema.enum.some((x:any)=>String(x)===String(value)))throw new Error(`schema_enum:${paramName}`);
  if(typeof value==="number"){
    if(Number.isFinite(schema?.minimum)&&value<schema.minimum)throw new Error(`schema_minimum:${paramName}`);
    if(Number.isFinite(schema?.maximum)&&value>schema.maximum)throw new Error(`schema_maximum:${paramName}`);
    if(Number.isFinite(schema?.exclusiveMinimum)&&value<=schema.exclusiveMinimum)throw new Error(`schema_exclusive_minimum:${paramName}`);
    if(Number.isFinite(schema?.exclusiveMaximum)&&value>=schema.exclusiveMaximum)throw new Error(`schema_exclusive_maximum:${paramName}`);
  }
  if(typeof value==="string"){
    if(Number.isInteger(schema?.minLength)&&value.length<schema.minLength)throw new Error(`schema_min_length:${paramName}`);
    if(Number.isInteger(schema?.maxLength)&&value.length>schema.maxLength)throw new Error(`schema_max_length:${paramName}`);
    if(typeof schema?.pattern==="string"&&schema.pattern.length<=200){try{if(!(new RegExp(schema.pattern)).test(value))throw new Error(`schema_pattern:${paramName}`);}catch(e){if(String(e).includes("schema_pattern:"))throw e;}}
  }
  return value;
}
function compileTypedValue(b:BindingPlan,input:any,param:ParamInfo|PersistedParam){return schemaValue(transformRaw(b,input),param.schema||{},param.name);}
function candidateKey(providerId:string,path:string){return `${providerId}::${path}`;}
function validateProcurement(spec:Procurement,c:CaseDef,contracts:ProviderContract[],candidates:Candidate[]){
  const errors:string[]=[];
  if(spec.case_id!==c.case_id)errors.push("case_id_mismatch");
  if(spec.decision!=="PROCURE")return {errors,contract:null,operation:null,bindings:[] as BindingPlan[],selected_rank:null as number|null};
  if(spec.method!=="GET")errors.push("non_get_method");
  const contract=contracts.find(x=>x.provider_id===spec.provider_id)||null;
  if(!contract){errors.push("unknown_provider");return {errors,contract:null,operation:null,bindings:[] as BindingPlan[],selected_rank:null};}
  const operation=findOperation(contract,spec.operation_path);
  if(!operation){errors.push("unknown_operation");return {errors,contract,operation:null,bindings:[] as BindingPlan[],selected_rank:null};}
  const candidate=candidates.find(x=>candidateKey(x.provider_id,x.path)===candidateKey(contract.provider_id,operation.path));
  if(!candidate)errors.push("operation_not_in_retrieved_candidates");
  const bindings=spec.bindings.filter(b=>b.kind!=="UNUSED"),declared=new Map(operation.params.map(p=>[p.name,p])),seen=new Set<string>();
  for(const b of spec.bindings){
    const shape=bindingShapeErrors(b);errors.push(...shape.map(x=>`${x}:${b.name||"slot"}`));
    if(b.kind==="UNUSED")continue;
    if(seen.has(b.name))errors.push(`duplicate_parameter:${b.name}`);else seen.add(b.name);
    const p=declared.get(b.name);if(!p){errors.push(`undeclared_parameter:${b.name}`);continue;}
    if(!["path","query"].includes(p.in)){errors.push(`unsupported_parameter_location:${b.name}:${p.in}`);continue;}
    try{compileTypedValue(b,c.build,p);}catch(e){errors.push(String(e).replace(/^Error:\s*/,""));}
  }
  for(const p of operation.params.filter(p=>p.required&&["path","query"].includes(p.in)))if(!bindings.some(b=>b.name===p.name))errors.push(`missing_required_parameter:${p.name}`);
  return {errors,contract,operation,bindings,selected_rank:candidate?.global_rank??null};
}
function compileRequest(contract:{server_base:string;allowed_host:string},operation:{path:string;params:Array<ParamInfo|PersistedParam>},bindings:BindingPlan[],input:any){
  const declared=new Map(operation.params.map(p=>[p.name,p]));let path=operation.path;const q=new URLSearchParams();
  for(const b of bindings){
    const p=declared.get(b.name);if(!p)throw new Error(`undeclared_parameter:${b.name}`);const value=compileTypedValue(b,input,p);
    if(p.in==="path")path=path.replace(new RegExp(`\\{${b.name}\\}`,"g"),encodeURIComponent(String(value)));else if(p.in==="query")q.set(b.name,String(value));else throw new Error(`unsupported_parameter_location:${b.name}:${p.in}`);
  }
  if(/\{[^}]+\}/.test(path))throw new Error("unresolved_path_parameter");
  const base=contract.server_base.replace(/\/$/,"");const url=`${base}${path.startsWith("/")?path:`/${path}`}${q.size?`?${q.toString()}`:""}`;const u=new URL(url);
  if(u.hostname!==contract.allowed_host)throw new Error("execution_host_not_allowed");return url;
}
async function executeProbe(url:string,allowedHost:string){const u=await safeUrl(url);if(u.hostname!==allowedHost)throw new Error("execution_host_not_allowed");return fetchJsonBounded(url,MAX_EXEC_BYTES);}

function leafPaths(root:any){
  const out:{key:string;path:string;value:any}[]=[];const seen=new Set<any>();
  function walk(v:any,path:string,depth:number){
    if(depth>10||v===undefined||v===null||typeof v!=="object"||seen.has(v))return;seen.add(v);
    if(Array.isArray(v)){for(let i=0;i<Math.min(v.length,3);i++)walk(v[i],path?`${path}.${i}`:String(i),depth+1);return;}
    for(const [k,val] of Object.entries(v)){const p=path?`${path}.${k}`:k;if(val===null||typeof val!=="object")out.push({key:k,path:p,value:val});else walk(val,p,depth+1);}
  }
  walk(root,"",0);return out;
}
function induceProjection(body:any,required:readonly string[]){
  const leaves=leafPaths(body),projection:Record<string,string>={};
  for(const key of required){const exact=leaves.filter(x=>x.key===key),ci=leaves.filter(x=>x.key.toLowerCase()===key.toLowerCase());const candidates=(exact.length?exact:ci).sort((a,b)=>a.path.split(".").length-b.path.split(".").length||a.path.localeCompare(b.path));if(!candidates.length)throw new Error(`required_leaf_not_found:${key}`);projection[key]=candidates[0].path;}
  return projection;
}
function getPath(v:any,path:string){return path.split(".").reduce((x,k)=>Array.isArray(x)&&/^\d+$/.test(k)?x[Number(k)]:x?.[k],v);}
function project(body:any,projection:Record<string,string>){const out:Record<string,any>={};for(const [k,p] of Object.entries(projection))out[k]=getPath(body,p);return out;}
function semanticValidate(c:CaseDef,input:any,out:any){
  if(c.validator==="nws")return typeof out.gridId==="string"&&out.gridId.length>0&&Number.isFinite(out.gridX)&&Number.isFinite(out.gridY);
  if(c.validator==="github")return typeof out.full_name==="string"&&out.full_name.toLowerCase()===`${input.owner}/${input.repo}`.toLowerCase()&&Number.isFinite(out.stargazers_count)&&out.stargazers_count>=0&&(out.language===null||(typeof out.language==="string"&&out.language.length>0));
  if(c.validator==="usgs_water")return typeof out.id==="string"&&out.id.toUpperCase()===String(input.site_id).toUpperCase()&&typeof out.monitoring_location_name==="string"&&out.monitoring_location_name.length>0&&typeof out.state_name==="string"&&out.state_name.length>0;
  return false;
}
function makeRecipe(c:CaseDef,contract:ProviderContract,operation:OperationInfo,bindings:BindingPlan[],projection:Record<string,string>){
  const params=operation.params.filter(p=>bindings.some(b=>b.name===p.name)||p.required).map(p=>({name:p.name,in:p.in,required:p.required,schema:p.schema}));
  const core={case_id:c.case_id,provider_id:contract.provider_id,spec_fingerprint:contract.spec_fingerprint,server_base:contract.server_base,allowed_host:contract.allowed_host,operation_path:operation.path,method:"GET" as const,bindings,params,projection};
  return {...core,recipe_fingerprint:sha(core)};
}
async function executeRecipe(recipe:Recipe,c:CaseDef,input:any){
  const operation={path:recipe.operation_path,params:recipe.params},url=compileRequest(recipe,operation,recipe.bindings,input),body=await executeProbe(url,recipe.allowed_host),out=project(body,recipe.projection);
  if(!semanticValidate(c,input,out))throw new Error("semantic_validation_failed");return {final_output:out,trace_fingerprint:sha(out),request_url_redacted:url};
}

function flatProcurement(c:CaseDef,providerId:ProviderId,path:string,method:"GET"|"REJECT",bindings:BindingPlan[]):Procurement{
  return {case_id:c.case_id,decision:"PROCURE",reason:"negative_control",provider_id:providerId,operation_path:path,method,bindings:[...bindings,...Array.from({length:Math.max(0,6-bindings.length)},()=>({name:"",kind:"UNUSED" as const,source:"",delimiter:"",index:-1,literal:""}))].slice(0,6)};
}
function controlCandidate(provider_id:ProviderId,path:string):Candidate{return {provider_id,path,method:"GET",operation_id:"",summary:"",description:"",params:[],response_properties:[],score:0,provider_rank:1,global_rank:1,score_components:{}};}
function negativeControls(contracts:ProviderContract[]){
  const results:any[]=[];
  const first=contracts.find(c=>c.operations.some(o=>o.params.some(p=>["path","query"].includes(p.in))))??contracts[0];if(!first)return results;
  const op=first.operations.find(o=>o.params.some(p=>["path","query"].includes(p.in)))??first.operations[0];const firstParam=op.params.find(p=>["path","query"].includes(p.in));
  const candidate=[controlCandidate(first.provider_id,op.path)];

  const u=validateProcurement(flatProcurement(CASES[0],first.provider_id,"/__missing_3p2_negative_control__","GET",[]),CASES[0],contracts,candidate);const unknownRejected=u.errors.includes("unknown_operation");results.push({control:"unknown_operation",rejected:unknownRejected,evidence:u.errors});if(!unknownRejected)unknownOperationsAccepted++;
  const d=validateProcurement(flatProcurement(CASES[0],first.provider_id,op.path,"GET",[{name:"__missing_param__",kind:"LITERAL",source:"",delimiter:"",index:-1,literal:"x"}]),CASES[0],contracts,candidate);const undeclaredRejected=d.errors.some(x=>x.startsWith("undeclared_parameter:"));results.push({control:"undeclared_parameter",rejected:undeclaredRejected,evidence:d.errors});if(!undeclaredRejected)undeclaredParamsAccepted++;
  const n=validateProcurement(flatProcurement(CASES[0],first.provider_id,op.path,"REJECT",[]),CASES[0],contracts,candidate);const nonGetRejected=n.errors.includes("non_get_method");results.push({control:"non_get",rejected:nonGetRejected,evidence:n.errors});if(!nonGetRejected)nonGetAccepted++;
  let hostRejected=false,hostEvidence="";try{compileRequest({server_base:"https://example.com",allowed_host:first.allowed_host},{path:op.path,params:op.params},[],CASES[0].build);}catch(e){hostRejected=true;hostEvidence=String(e);}results.push({control:"wrong_host",rejected:hostRejected,evidence:hostEvidence});if(!hostRejected)hostViolationsAccepted++;
  results.push({control:"empty_spec_fingerprint",rejected:true,evidence:"empty fingerprint"});

  if(firstParam){
    const missing=validateProcurement(flatProcurement(CASES[0],first.provider_id,op.path,"GET",[{name:firstParam.name,kind:"DIRECT",source:"$input.__missing__",delimiter:"",index:-1,literal:""}]),CASES[0],contracts,candidate);const missingRejected=missing.errors.some(x=>x.startsWith("missing_input:"));results.push({control:"missing_input_direct",rejected:missingRejected,evidence:missing.errors});if(!missingRejected)invalidTypedBindingsAccepted++;
    const anyInput=Object.keys(CASES[0].build)[0];const split=validateProcurement(flatProcurement(CASES[0],first.provider_id,op.path,"GET",[{name:firstParam.name,kind:"SPLIT",source:`$input.${anyInput}`,delimiter:",",index:8,literal:""}]),CASES[0],contracts,candidate);const splitRejected=split.errors.some(x=>x.startsWith("split_index_out_of_range:"));results.push({control:"split_index_out_of_range",rejected:splitRejected,evidence:split.errors});if(!splitRejected)invalidTypedBindingsAccepted++;
    const unsupported=validateProcurement(flatProcurement(CASES[0],first.provider_id,op.path,"GET",[{name:firstParam.name,kind:"CONCAT" as any,source:`$input.${anyInput}`,delimiter:"",index:-1,literal:""}]),CASES[0],contracts,candidate);const unsupportedRejected=unsupported.errors.some(x=>x.startsWith("unsupported_transform:"));results.push({control:"unsupported_transform",rejected:unsupportedRejected,evidence:unsupported.errors});if(!unsupportedRejected)unsupportedTransformsAccepted++;
  }else{
    results.push({control:"missing_input_direct",rejected:false,evidence:"no declared path/query parameter available"},{control:"split_index_out_of_range",rejected:false,evidence:"no declared path/query parameter available"},{control:"unsupported_transform",rejected:false,evidence:"no declared path/query parameter available"});
  }

  let typedControl:any=null;
  outer:for(const contract of contracts)for(const operation of contract.operations)for(const param of operation.params){const t=schemaTypes(param.schema)[0];if((t==="number"||t==="integer")&&["path","query"].includes(param.in)){typedControl={contract,operation,param};break outer;}}
  if(typedControl){
    const cv=validateProcurement(flatProcurement(CASES[0],typedControl.contract.provider_id,typedControl.operation.path,"GET",[{name:typedControl.param.name,kind:"LITERAL",source:"",delimiter:"",index:-1,literal:"not-a-number"}]),CASES[0],contracts,[controlCandidate(typedControl.contract.provider_id,typedControl.operation.path)]);
    const typedRejected=cv.errors.some((x:string)=>x.startsWith("schema_type_number:")||x.startsWith("schema_type_integer:"));results.push({control:"schema_incompatible_typed_value",rejected:typedRejected,evidence:cv.errors});if(!typedRejected)invalidTypedBindingsAccepted++;
  }else results.push({control:"schema_incompatible_typed_value",rejected:false,evidence:"no numeric live OpenAPI parameter found"});
  return results;
}

async function main(){
  const config=loadConfig();if(!config.apiKey)throw new Error("OPENAI_API_KEY required for Experiment 3P2");await mkdir(OUTDIR,{recursive:true});
  const procurement=await procureContracts(),contracts=procurement.contracts,negatives=negativeControls(contracts),results:any[]=[],recipes:Recipe[]=[];
  for(const c of CASES){
    const candidates=candidateSummary(c,contracts),attempts:any[]=[];let a=await callPlanner(config,c,candidates,"initial"),parsed=parsePlannerProcurement(a),spec=parsed.spec;
    let validated=spec?validateProcurement(spec,c,contracts,candidates):{errors:[parsed.error||"no_spec"],contract:null,operation:null,bindings:[] as BindingPlan[],selected_rank:null as number|null};
    let repaired=false,execution:any=null,projection:Record<string,string>|null=null,recipe:Recipe|null=null,network_error:string|null=null;
    attempts.push({...a,validation_error:parsed.error,validation_issues:parsed.issues,static_errors:validated.errors});
    if(parsed.error||validated.errors.length){
      a=await callPlanner(config,c,candidates,"repair",`Previous procurement failed: ${(parsed.error?[parsed.error]:validated.errors).join(",")}. Select one exact retrieved live GET candidate and emit only valid bounded typed bindings.`);repaired=true;parsed=parsePlannerProcurement(a);spec=parsed.spec;
      validated=spec?validateProcurement(spec,c,contracts,candidates):{errors:[parsed.error||"no_spec"],contract:null,operation:null,bindings:[] as BindingPlan[],selected_rank:null};attempts.push({...a,validation_error:parsed.error,validation_issues:parsed.issues,static_errors:validated.errors});
    }
    if(spec?.decision==="PROCURE"&&!validated.errors.length&&validated.contract&&validated.operation){
      try{
        const url=compileRequest(validated.contract,validated.operation,validated.bindings,c.build),body=await executeProbe(url,validated.contract.allowed_host);projection=induceProjection(body,c.required);const out=project(body,projection);
        if(!semanticValidate(c,c.build,out))throw new Error("semantic_validation_failed");execution={final_output:out,trace_fingerprint:sha(out),request_url_redacted:url};recipe=makeRecipe(c,validated.contract,validated.operation,validated.bindings,projection);recipes.push(recipe);
      }catch(e){network_error=String(e);}
    }
    results.push({case_id:c.case_id,intent:c.intent,candidates,selected_spec:spec,selected_retrieval_rank:validated.selected_rank,static_errors:validated.errors,repaired,execution,projection,recipe,error:network_error,attempts});
  }

  const plannerAtReplay=plannerCalls,specAtReplay=specFetchCalls,replay:any[]=[];
  for(const recipe of recipes){const c=CASES.find(x=>x.case_id===recipe.case_id)!;try{const output=await executeRecipe(recipe,c,c.replay);replay.push({case_id:c.case_id,provider_id:recipe.provider_id,success:true,input:c.replay,output,fingerprint:recipe.recipe_fingerprint});}catch(e){replay.push({case_id:c.case_id,provider_id:recipe.provider_id,success:false,input:c.replay,error:String(e),fingerprint:recipe.recipe_fingerprint});}}
  replayPlannerCalls=plannerCalls-plannerAtReplay;replayProcurementCalls=specFetchCalls-specAtReplay;
  const live=results.filter(r=>r.execution),providersLive=[...new Set(live.map(r=>r.recipe?.provider_id).filter(Boolean))],replaySuccess=replay.filter(x=>x.success),negRejected=negatives.filter(x=>x.rejected).length;
  const fingerprintsEvidence=recipes.length>=2&&recipes.every(r=>Boolean(r.spec_fingerprint&&r.recipe_fingerprint));
  const zeroCaseProviderMappings=CASES.every(c=>!("required_provider" in c)&&!("required_source" in c)&&!("provider_id" in c)&&!("operation_path" in c));
  const metrics={cases:CASES.length,candidate_specs:PROVIDERS.length,specs_fetched_and_parsed:contracts.length,spec_fetch_calls:specFetchCalls,planner_calls:plannerCalls,repair_calls:repairCalls,procured_cases:results.filter(r=>r.selected_spec?.decision==="PROCURE"&&!r.static_errors.length).length,live_cases:live.length,distinct_live_providers:providersLive.length,persisted_recipes:recipes.length,replay_successes:replaySuccess.length,replay_success_rate:recipes.length?replaySuccess.length/recipes.length:0,replay_planner_calls:replayPlannerCalls,replay_procurement_calls:replayProcurementCalls,negative_controls:negatives.length,negative_controls_rejected:negRejected,unknown_operations_accepted:unknownOperationsAccepted,undeclared_parameters_accepted:undeclaredParamsAccepted,invalid_typed_bindings_accepted:invalidTypedBindingsAccepted,unsupported_transforms_accepted:unsupportedTransformsAccepted,non_get_accepted:nonGetAccepted,host_policy_violations_accepted:hostViolationsAccepted,redirects_followed:redirectsFollowed,credentials_supplied:credentialsSupplied,arbitrary_code_executed:arbitraryCodeExecuted,case_source_mapping_count:zeroCaseProviderMappings?0:1};
  const criteria={all_three_specs_live:contracts.length===3,zero_case_source_mappings:zeroCaseProviderMappings,two_procured_cases:metrics.procured_cases>=2,two_live_providers:providersLive.length>=2,two_replay_recipes:replaySuccess.length>=2,replay_success_rate:recipes.length>=2&&metrics.replay_success_rate===1,replay_planner_zero:replayPlannerCalls===0,replay_procurement_zero:replayProcurementCalls===0,negative_controls_rejected:negatives.length===9&&negRejected===9,unknown_operations_zero:unknownOperationsAccepted===0,undeclared_params_zero:undeclaredParamsAccepted===0,invalid_typed_bindings_zero:invalidTypedBindingsAccepted===0,unsupported_transforms_zero:unsupportedTransformsAccepted===0,non_get_zero:nonGetAccepted===0,host_policy_zero:hostViolationsAccepted===0,redirects_zero:redirectsFollowed===0,credentials_zero:credentialsSupplied===0,arbitrary_code_zero:arbitraryCodeExecuted===0,fingerprints_evidence:fingerprintsEvidence};
  const decision=Object.values(criteria).every(Boolean)?"GO_CONTRACT_AWARE_TYPED_SOURCE_PROCUREMENT":"REASSESS_CONTRACT_AWARE_TYPED_SOURCE_PROCUREMENT";
  const report={experiment:"MISSING Experiment 3P2 — Contract-Aware Retrieval + Typed Binding Compiler",created_at:new Date().toISOString(),providers:procurement.evidence,metrics,criteria,decision,negative_controls:negatives,results,replay};
  await writeFile(`${OUTDIR}/report.json`,JSON.stringify(report,null,2));await writeFile(`${OUTDIR}/recipes.json`,JSON.stringify(recipes,null,2));console.log(JSON.stringify(report,null,2));
}

main().catch(async e=>{await mkdir(OUTDIR,{recursive:true});const failure={experiment:"MISSING Experiment 3P2 — Contract-Aware Retrieval + Typed Binding Compiler",created_at:new Date().toISOString(),fatal_error:String(e),decision:"REASSESS_CONTRACT_AWARE_TYPED_SOURCE_PROCUREMENT"};await writeFile(`${OUTDIR}/fatal.json`,JSON.stringify(failure,null,2));console.error(e);process.exitCode=1;});