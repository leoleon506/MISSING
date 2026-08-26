import {createHash} from "node:crypto";
import {isIP} from "node:net";

export const REGISTRY_URL="https://api.apis.guru/v2/list.json";
export const MAX_REGISTRY_BYTES=64*1024*1024;
export const MAX_SPEC_BYTES=45*1024*1024;
export const REGISTRY_TOP_K=60;
export const SPEC_FETCH_LIMIT=20;
export const PLANNER_CANDIDATE_LIMIT=24;

export const CASES=[
  {case_id:"public_source_code_repository_metadata",intent:"Given an owner and repository name on a public source-code hosting service, identify a machine-readable API operation that can return the repository's canonical full name, star count, and primary language.",input_names:["owner","repo"],required_output_leaf_names:["full_name","stargazers_count","language"]},
  {case_id:"fantasy_role_playing_ability_score_metadata",intent:"Given a tabletop fantasy role-playing ability-score identifier such as cha, identify a machine-readable API operation that can return the canonical short index, abbreviated name, and full display name.",input_names:["ability_index"],required_output_leaf_names:["index","name","full_name"]},
  {case_id:"currency_metadata",intent:"Given a canonical currency identifier such as usd, identify a machine-readable API operation that can return canonical currency code and human-readable currency name.",input_names:["currency_id"],required_output_leaf_names:["code","name"]}
] as const;

export type CaseDef=(typeof CASES)[number];
export type ParamInfo={name:string;in:string;required:boolean;description:string;schema:any};
export type OperationInfo={path:string;method:"GET";operation_id:string;summary:string;description:string;params:ParamInfo[];response_properties:string[]};
export type RegistryRecord={api_key:string;version:string;spec_url:string;title:string;description:string;categories:string[];registry_score:number;registry_rank:number};
export type LiveContract={api_key:string;version:string;spec_url:string;title:string;spec:any;spec_fingerprint:string;operations:OperationInfo[];registry_rank:number;registry_score:number};
export type Candidate={candidate_id:string;api_key:string;title:string;path:string;method:string;operation_id:string;summary:string;description:string;params:Array<{name:string;in:string;required:boolean;description:string;schema_type:string|null}>;response_properties:string[];score:number;input_hits:number;output_hits:number;registry_rank:number};
export type PlannerSelection={case_id:string;decision:"DISCOVER"|"REJECT";candidate_id:string;reason:string};
export type DiscoveryDescriptor={case_id:string;api_key:string;title:string;spec_url:string;spec_fingerprint:string;operation_path:string;method:"GET";candidate_id:string;score:number;input_hits:number;output_hits:number;planner_reason:string;descriptor_fingerprint:string};
export type NegativeControl={control:string;executed:boolean;rejected:boolean;evidence:any};

export const sha=(v:any)=>createHash("sha256").update(typeof v==="string"?v:JSON.stringify(v)).digest("hex");

export function validateSpecUrlSyntax(raw:string){
  try{
    const u=new URL(raw);
    if(u.protocol!=="https:")return {ok:false,reason:"non_https",url:null as URL|null};
    if(isIP(u.hostname))return {ok:false,reason:"ip_literal",url:null as URL|null};
    return {ok:true,reason:null as string|null,url:u};
  }catch{return {ok:false,reason:"invalid_url",url:null as URL|null};}
}

function wordTokens(value:string){
  const raw=(String(value).toLowerCase().match(/[a-z0-9]+/g)||[]).filter(x=>x.length>=2);
  const out=new Set(raw);
  if(out.has("repository")){out.add("repo");out.add("git");}
  if(out.has("repo")){out.add("repository");out.add("git");}
  if(out.has("ability"))out.add("score");
  if(out.has("currency")){out.add("money");out.add("finance");out.add("financial");}
  if(out.has("star")||out.has("stargazer")||out.has("stargazers")){out.add("star");out.add("stargazer");}
  return [...out];
}
function normalizeName(s:string){return String(s).toLowerCase().replace(/[^a-z0-9]/g,"");}
export function nameCompatibility(a:string,b:string){
  const na=normalizeName(a),nb=normalizeName(b);
  if(!na||!nb)return 0;
  if(na===nb)return 1;
  if(na.length>=3&&nb.length>=3&&(na.includes(nb)||nb.includes(na)))return Math.min(0.85,Math.min(na.length,nb.length)/Math.max(na.length,nb.length)+0.25);
  const ta=new Set(wordTokens(a)),tb=new Set(wordTokens(b));
  const inter=[...ta].filter(x=>tb.has(x)).length,union=new Set([...ta,...tb]).size;
  return union?inter/union:0;
}
function tokenAffinity(query:string,document:string){
  const q=wordTokens(query),d=wordTokens(document);let score=0;
  for(const qt of q){let best=0;for(const dt of d){if(qt===dt)best=Math.max(best,2);else if(qt.length>=3&&dt.length>=3&&(qt.includes(dt)||dt.includes(qt)))best=Math.max(best,1.15);}score+=best;}
  return score;
}
function caseText(c:CaseDef){return `${c.intent} ${c.input_names.join(" ")} ${c.required_output_leaf_names.join(" ")}`;}

export function flattenRegistry(raw:any):RegistryRecord[]{
  if(!raw||typeof raw!=="object"||Array.isArray(raw))throw new Error("registry_not_object");
  const records:RegistryRecord[]=[];
  for(const [apiKey,entryRaw] of Object.entries(raw)){
    const entry:any=entryRaw,versions=entry?.versions&&typeof entry.versions==="object"?entry.versions:{};
    const keys=Object.keys(versions);if(!keys.length)continue;
    const version=typeof entry?.preferred==="string"&&versions[entry.preferred]?entry.preferred:keys.sort((a,b)=>a.localeCompare(b,undefined,{numeric:true})).at(-1)!;
    const vr:any=versions[version],specUrl=typeof vr?.swaggerUrl==="string"?vr.swaggerUrl:"";if(!specUrl)continue;
    const info:any=vr?.info&&typeof vr.info==="object"?vr.info:{},categories=Array.isArray(info?.["x-apisguru-categories"])?info["x-apisguru-categories"].map(String):[];
    records.push({api_key:String(apiKey),version:String(version),spec_url:specUrl,title:String(info.title||apiKey),description:String(info.description||""),categories,registry_score:0,registry_rank:0});
  }
  return records;
}
function scoreRegistryRecord(c:CaseDef,r:RegistryRecord){
  const metadata=`${r.api_key} ${r.title} ${r.categories.join(" ")} ${r.description.slice(0,5000)}`;let score=tokenAffinity(caseText(c),metadata);
  for(const input of c.input_names)score+=Math.max(nameCompatibility(input,r.api_key),nameCompatibility(input,r.title))*1.5;
  for(const out of c.required_output_leaf_names)score+=Math.max(nameCompatibility(out,r.api_key),nameCompatibility(out,r.title));
  return score;
}
export function rankRegistryRecords(c:CaseDef,records:RegistryRecord[]){
  return records.map(r=>({...r,registry_score:scoreRegistryRecord(c,r)})).sort((a,b)=>b.registry_score-a.registry_score||a.api_key.localeCompare(b.api_key)).slice(0,REGISTRY_TOP_K).map((r,i)=>({...r,registry_rank:i+1}));
}

function resolveRef(spec:any,value:any){
  if(!value||typeof value!=="object"||typeof value.$ref!=="string"||!value.$ref.startsWith("#/"))return value;
  let cur:any=spec;for(const raw of value.$ref.slice(2).split("/")){const key=raw.replace(/~1/g,"/").replace(/~0/g,"~");cur=cur?.[key];}return cur??value;
}
function mergeParams(spec:any,pathItem:any,op:any):ParamInfo[]{
  const all=[...(Array.isArray(pathItem?.parameters)?pathItem.parameters:[]),...(Array.isArray(op?.parameters)?op.parameters:[])],out=new Map<string,ParamInfo>();
  for(const raw of all){const p=resolveRef(spec,raw);if(!p?.name||!p?.in)continue;const schema=resolveRef(spec,p.schema)||p||{};out.set(`${p.in}:${p.name}`,{name:String(p.name),in:String(p.in),required:Boolean(p.required||p.in==="path"),description:String(p.description||""),schema});}
  return [...out.values()];
}
function collectSchemaProperties(spec:any,schemaRaw:any){
  const out=new Set<string>(),seenRefs=new Set<string>(),seenObjects=new Set<any>();
  function walk(raw:any,depth:number){
    if(depth>9||!raw||typeof raw!=="object"||out.size>=400)return;
    if(typeof raw.$ref==="string"&&raw.$ref.startsWith("#/")){if(seenRefs.has(raw.$ref))return;seenRefs.add(raw.$ref);walk(resolveRef(spec,raw),depth+1);return;}
    if(seenObjects.has(raw))return;seenObjects.add(raw);
    if(raw.properties&&typeof raw.properties==="object")for(const [name,value] of Object.entries(raw.properties)){out.add(String(name));walk(value,depth+1);if(out.size>=400)break;}
    if(raw.items)walk(raw.items,depth+1);for(const key of ["allOf","oneOf","anyOf"]){const arr=raw[key];if(Array.isArray(arr))for(const child of arr)walk(child,depth+1);}
  }
  walk(schemaRaw,0);return [...out];
}
function responseProperties(spec:any,op:any){
  const out=new Set<string>(),responses=op?.responses&&typeof op.responses==="object"?op.responses:{};
  for(const [status,responseRaw] of Object.entries(responses)){
    if(!/^2\d\d$/.test(status)&&status!=="default")continue;const response:any=resolveRef(spec,responseRaw);
    if(response?.schema)for(const name of collectSchemaProperties(spec,response.schema))out.add(name);
    const content=response?.content&&typeof response.content==="object"?response.content:{};
    for(const media of Object.values(content as any)){const schema=(media as any)?.schema;if(schema)for(const name of collectSchemaProperties(spec,schema))out.add(name);if(out.size>=400)break;}if(out.size>=400)break;
  }
  return [...out];
}
export function validateOpenApiDocument(spec:any){return Boolean(spec&&typeof spec==="object"&&!Array.isArray(spec)&&(typeof spec.openapi==="string"||typeof spec.swagger==="string")&&spec.paths&&typeof spec.paths==="object");}
export function operationExists(spec:any,path:string,method:string){const pathItem:any=resolveRef(spec,spec?.paths?.[path]);return Boolean(pathItem&&method.toLowerCase()==="get"&&resolveRef(spec,pathItem.get));}
export function parseContractDocument(record:RegistryRecord,text:string):LiveContract{
  const spec=JSON.parse(text);if(!validateOpenApiDocument(spec))throw new Error("not_openapi");const operations:OperationInfo[]=[];
  for(const [path,pathRaw] of Object.entries(spec.paths||{})){const pathItem:any=resolveRef(spec,pathRaw),op:any=resolveRef(spec,pathItem?.get);if(!op)continue;operations.push({path:String(path),method:"GET",operation_id:String(op.operationId||""),summary:String(op.summary||""),description:String(op.description||""),params:mergeParams(spec,pathItem,op),response_properties:responseProperties(spec,op)});}
  if(!operations.length)throw new Error("no_get_operations");return {api_key:record.api_key,version:record.version,spec_url:record.spec_url,title:record.title,spec,spec_fingerprint:sha(text),operations,registry_rank:record.registry_rank,registry_score:record.registry_score};
}

function operationScore(c:CaseDef,contract:LiveContract,o:OperationInfo){
  const params=o.params.filter(p=>p.in==="path"||p.in==="query");
  const inputBest=c.input_names.map(input=>Math.max(0,...params.map(p=>nameCompatibility(input,p.name))));
  const operationWords=wordTokens(`${o.path} ${o.operation_id} ${o.summary} ${o.description}`);
  const outputBest=c.required_output_leaf_names.map(output=>Math.max(0,...o.response_properties.map(p=>nameCompatibility(output,p)),...operationWords.map(p=>nameCompatibility(output,p))));
  const input_hits=inputBest.filter(x=>x>=0.35).length,output_hits=outputBest.filter(x=>x>=0.55).length;
  const requiredParams=params.filter(p=>p.required),unmatchedRequired=requiredParams.filter(p=>Math.max(0,...c.input_names.map(i=>nameCompatibility(i,p.name)))<0.35).length;
  const score=inputBest.reduce((a,b)=>a+b,0)*18+outputBest.reduce((a,b)=>a+b,0)*14+tokenAffinity(c.intent,`${contract.title} ${o.path} ${o.operation_id} ${o.summary} ${o.description}`)*0.7+contract.registry_score*0.35-unmatchedRequired*8;
  return {score,input_hits,output_hits};
}
function candidateId(contract:LiveContract,o:OperationInfo){return sha(`${contract.api_key}|${contract.version}|${contract.spec_fingerprint}|${o.path}|GET`).slice(0,20);}
export function candidateSummary(c:CaseDef,contracts:LiveContract[]):Candidate[]{
  const pool=contracts.flatMap(contract=>contract.operations.map(op=>({contract,op,...operationScore(c,contract,op)}))),diversified:any[]=[];
  for(const contract of contracts){const rows=pool.filter(x=>x.contract.spec_url===contract.spec_url).sort((a,b)=>b.score-a.score||a.op.path.localeCompare(b.op.path));diversified.push(...rows.slice(0,3));}
  diversified.sort((a,b)=>b.score-a.score||a.contract.api_key.localeCompare(b.contract.api_key)||a.op.path.localeCompare(b.op.path));
  return diversified.slice(0,PLANNER_CANDIDATE_LIMIT).map(row=>({candidate_id:candidateId(row.contract,row.op),api_key:row.contract.api_key,title:row.contract.title,path:row.op.path,method:"GET",operation_id:row.op.operation_id,summary:row.op.summary,description:row.op.description.slice(0,500),params:row.op.params.map((p:ParamInfo)=>({name:p.name,in:p.in,required:p.required,description:p.description.slice(0,220),schema_type:typeof p.schema?.type==="string"?p.schema.type:null})),response_properties:row.op.response_properties.slice(0,120),score:Number(row.score.toFixed(4)),input_hits:row.input_hits,output_hits:row.output_hits,registry_rank:row.contract.registry_rank}));
}

export function validateSelection(selection:PlannerSelection,c:CaseDef,candidates:Candidate[]){
  const errors:string[]=[];if(selection.case_id!==c.case_id)errors.push("case_id_mismatch");if(selection.decision==="REJECT")return {errors,candidate:null as Candidate|null};const candidate=candidates.find(x=>x.candidate_id===selection.candidate_id)||null;if(!candidate)errors.push("candidate_id_not_presented");return {errors,candidate};
}
export function descriptorEligibility(candidate:Candidate,contract:LiveContract|null){
  const errors:string[]=[];if(!contract){errors.push("missing_live_contract");return {ok:false,errors};}if(!contract.spec_fingerprint)errors.push("empty_spec_fingerprint");if(candidate.method!=="GET")errors.push("non_get_operation");if(!operationExists(contract.spec,candidate.path,candidate.method))errors.push("operation_absent_from_contract");if(candidate.input_hits<1)errors.push("no_input_compatibility_evidence");if(candidate.output_hits<1)errors.push("no_output_compatibility_evidence");return {ok:errors.length===0,errors};
}
export function buildDescriptor(c:CaseDef,selection:PlannerSelection,candidate:Candidate,contract:LiveContract):DiscoveryDescriptor{
  const base={case_id:c.case_id,api_key:contract.api_key,title:contract.title,spec_url:contract.spec_url,spec_fingerprint:contract.spec_fingerprint,operation_path:candidate.path,method:"GET" as const,candidate_id:candidate.candidate_id,score:candidate.score,input_hits:candidate.input_hits,output_hits:candidate.output_hits,planner_reason:selection.reason};return {...base,descriptor_fingerprint:sha(base)};
}
export function descriptorHasFingerprintEvidence(d:DiscoveryDescriptor){return Boolean(d.spec_fingerprint&&d.descriptor_fingerprint);}
export function casesContainNoMappings(){
  const allowed=new Set(["case_id","intent","input_names","required_output_leaf_names"]);
  for(const c of CASES){if(Object.keys(c).some(k=>!allowed.has(k)))return false;const raw=JSON.stringify(c);if(/https?:\/\//i.test(raw)||/[a-z0-9-]+\.[a-z]{2,}\//i.test(raw)||/operation_path|spec_url|provider_id|api_key/i.test(raw))return false;}return true;
}

function syntheticContract(){
  const record:RegistryRecord={api_key:"synthetic.test",version:"1",spec_url:"https://synthetic.test/openapi.json",title:"Synthetic",description:"",categories:[],registry_score:1,registry_rank:1};
  const spec={openapi:"3.0.3",info:{title:"Synthetic",version:"1"},paths:{"/demo/{id}":{get:{parameters:[{name:"id",in:"path",required:true,schema:{type:"string"}}],responses:{"200":{description:"ok",content:{"application/json":{schema:{type:"object",properties:{name:{type:"string"}}}}}}}}}}};
  return parseContractDocument(record,JSON.stringify(spec));
}
export function runNegativeControls():NegativeControl[]{
  const controls:NegativeControl[]=[];
  const nonHttps=validateSpecUrlSyntax("http://example.com/openapi.json");controls.push({control:"non_https_spec_url",executed:true,rejected:!nonHttps.ok,evidence:{reason:nonHttps.reason}});
  const ipLiteral=validateSpecUrlSyntax("https://127.0.0.1/openapi.json");controls.push({control:"ip_literal_spec_url",executed:true,rejected:!ipLiteral.ok,evidence:{reason:ipLiteral.reason}});
  let nonOpenApiRejected=false,nonOpenApiError="";try{parseContractDocument({api_key:"bad",version:"1",spec_url:"https://example.com/spec.json",title:"Bad",description:"",categories:[],registry_score:0,registry_rank:1},JSON.stringify({hello:"world"}));}catch(e){nonOpenApiRejected=true;nonOpenApiError=String(e);}controls.push({control:"non_openapi_json",executed:true,rejected:nonOpenApiRejected,evidence:{error:nonOpenApiError}});
  const contract=syntheticContract(),op=contract.operations[0],candidate:Candidate={candidate_id:"synthetic-candidate",api_key:contract.api_key,title:contract.title,path:op.path,method:"GET",operation_id:op.operation_id,summary:op.summary,description:op.description,params:[],response_properties:op.response_properties,score:1,input_hits:1,output_hits:1,registry_rank:1},syntheticCase=CASES[2];
  const selectionResult=validateSelection({case_id:syntheticCase.case_id,decision:"DISCOVER",candidate_id:"missing-candidate",reason:"control"},syntheticCase,[candidate]);controls.push({control:"unknown_candidate_id",executed:true,rejected:selectionResult.errors.includes("candidate_id_not_presented"),evidence:{errors:selectionResult.errors}});
  const missingOp=descriptorEligibility({...candidate,path:"/__missing__"},contract);controls.push({control:"operation_absent_from_contract",executed:true,rejected:!missingOp.ok&&missingOp.errors.includes("operation_absent_from_contract"),evidence:{errors:missingOp.errors}});
  const metadataOnly=descriptorEligibility(candidate,null);controls.push({control:"metadata_without_live_spec",executed:true,rejected:!metadataOnly.ok&&metadataOnly.errors.includes("missing_live_contract"),evidence:{errors:metadataOnly.errors}});
  const emptyFingerprint=descriptorEligibility(candidate,{...contract,spec_fingerprint:""});controls.push({control:"empty_spec_fingerprint",executed:true,rejected:!emptyFingerprint.ok&&emptyFingerprint.errors.includes("empty_spec_fingerprint"),evidence:{errors:emptyFingerprint.errors}});
  const nonGet=descriptorEligibility({...candidate,method:"POST"},contract);controls.push({control:"non_get_operation",executed:true,rejected:!nonGet.ok&&nonGet.errors.includes("non_get_operation"),evidence:{errors:nonGet.errors}});
  return controls;
}
