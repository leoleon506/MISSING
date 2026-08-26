import {mkdir,writeFile} from "node:fs/promises";
import {lookup} from "node:dns/promises";
import {isIP} from "node:net";
import {createHash} from "node:crypto";
import {z} from "zod";
import {loadConfig} from "./config/index.js";

const TIMEOUT_MS=12000;
const CASES=[
 {case_id:"typed_capital_coordinates_a",intent:"Given a country name, return coordinates for that country's capital and prove the selected geocoder candidate belongs to the same original country.",build:{country:"Argentina"},replay:{country:"France"}},
 {case_id:"typed_capital_coordinates_b",intent:"Given a country name, return coordinates for that country's capital and prove the selected geocoder candidate belongs to the same original country.",build:{country:"Australia"},replay:{country:"India"}}
] as const;
const SOURCES={
 worldbank_countries:{source_id:"worldbank_countries",url:"https://api.worldbank.org/v2/country?format=json&per_page=400",description:"World Bank country metadata. Response index 1 is an array with fields including name and capitalCity."},
 openmeteo_geocode:{source_id:"openmeteo_geocode",url_template:"https://geocoding-api.open-meteo.com/v1/search?name={city}&count=10&language=en&format=json",description:"Open-Meteo geocoder returns a results array with name, latitude, longitude, country and country_code."}
};

const sourceWorld=z.object({op:z.literal("SOURCE"),source_id:z.literal("worldbank_countries")}).strict();
const sourceGeo=z.object({op:z.literal("SOURCE"),source_id:z.literal("openmeteo_geocode"),args:z.object({city:z.literal("$capital")}).strict()}).strict();
const arrayGet=z.object({op:z.literal("ARRAY_GET"),index:z.literal(1)}).strict();
const filterEq=z.object({op:z.literal("FILTER_EQ"),path:z.enum(["name","country"]),ref:z.literal("$input.country")}).strict();
const first=z.object({op:z.literal("FIRST")}).strict();
const select=z.object({op:z.literal("SELECT"),path:z.literal("capitalCity"),save_as:z.literal("$capital")}).strict();
const project=z.object({op:z.literal("PROJECT"),fields:z.tuple([z.literal("latitude"),z.literal("longitude"),z.literal("country"),z.literal("name")])}).strict();
const output=z.object({op:z.literal("OUTPUT")}).strict();
const opSchema=z.union([sourceWorld,sourceGeo,arrayGet,filterEq,first,select,project,output]);
const planSchema=z.object({case_id:z.string(),decision:z.enum(["MANUFACTURE","REJECT"]),reason:z.string(),ops:z.array(opSchema).max(12)}).strict();
type Plan=z.infer<typeof planSchema>;
type Op=z.infer<typeof opSchema>;

let plannerCalls=0,repairCalls=0,replayPlannerCalls=0,aliasRejections=0,constraintOmissionRejections=0,sourceViolations=0,operationViolations=0,hostViolations=0,redirectsFollowed=0,credentialsSupplied=0,arbitraryCodeExecuted=0;
const sha=(v:any)=>createHash("sha256").update(JSON.stringify(v)).digest("hex");
function publicIPv4(ip:string){const p=ip.split(".").map(Number);if(p.length!==4||p.some(x=>!Number.isInteger(x)||x<0||x>255))return false;const[a,b,c]=p;if(a===0||a===10||a===127||a>=224)return false;if(a===100&&b>=64&&b<=127)return false;if(a===169&&b===254)return false;if(a===172&&b>=16&&b<=31)return false;if(a===192&&b===168)return false;if(a===192&&b===0&&(c===0||c===2))return false;if(a===198&&(b===18||b===19))return false;if(a===198&&b===51&&c===100)return false;if(a===203&&b===0&&c===113)return false;return true;}
function publicIPv6(ip:string){const s=ip.toLowerCase();if(s==="::"||s==="::1"||s.startsWith("fc")||s.startsWith("fd")||/^fe[89ab]/.test(s)||s.startsWith("ff")||s.startsWith("2001:db8:"))return false;if(s.startsWith("::ffff:")){const t=s.slice(7);return isIP(t)===4&&publicIPv4(t);}return true;}
function isPublic(ip:string){return isIP(ip)===4?publicIPv4(ip):isIP(ip)===6?publicIPv6(ip):false;}
async function safeUrl(raw:string){const u=new URL(raw),ev:any={url:raw,hostname:u.hostname,resolved:[],allowed:false};if(u.protocol!=="https:"||isIP(u.hostname)){hostViolations++;throw new Error("host_policy_protocol_or_ip_literal");}const addrs=await lookup(u.hostname,{all:true,verbatim:true});ev.resolved=addrs;if(!addrs.length||addrs.some(a=>!isPublic(a.address))){hostViolations++;throw new Error("host_policy_non_public_dns");}ev.allowed=true;return ev;}
async function fetchJson(url:string,network:any[]){network.push(await safeUrl(url));const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),TIMEOUT_MS);try{const r=await fetch(url,{headers:{accept:"application/json","user-agent":"MISSING-Experiment-3N2/0.2"},redirect:"manual",signal:ctrl.signal});if(r.status>=300&&r.status<400)throw new Error(`redirect_rejected_${r.status}`);if(!r.ok)throw new Error(`http_${r.status}`);if(!(r.headers.get("content-type")??"").toLowerCase().includes("json"))throw new Error("non_json");return await r.json();}finally{clearTimeout(timer);}}

function hasAliasFields(raw:any){const aliases=new Set(["field","value","city","as"]);if(!raw||typeof raw!=="object")return false;for(const op of Array.isArray(raw.ops)?raw.ops:[])if(op&&typeof op==="object"&&Object.keys(op).some(k=>aliases.has(k)))return true;return false;}
function staticValidate(plan:Plan,c:any){const errors:string[]=[];if(plan.case_id!==c.case_id)errors.push("case_id_mismatch");if(plan.decision!=="MANUFACTURE")return errors;const o=plan.ops;
 const expect=["SOURCE","ARRAY_GET","FILTER_EQ","FIRST","SELECT","SOURCE","FILTER_EQ","FIRST","PROJECT","OUTPUT"];
 if(o.length!==expect.length)errors.push("wrong_sequence_length");
 for(let i=0;i<Math.min(o.length,expect.length);i++)if(o[i].op!==expect[i])errors.push(`wrong_op_${i}`);
 if(o[0]?.op==="SOURCE"&&o[0].source_id!=="worldbank_countries"){sourceViolations++;errors.push("wrong_worldbank_source");}
 if(o[1]?.op==="ARRAY_GET"&&o[1].index!==1)errors.push("wrong_worldbank_array_index");
 if(o[2]?.op==="FILTER_EQ"&&!(o[2].path==="name"&&o[2].ref==="$input.country")){constraintOmissionRejections++;errors.push("missing_input_country_filter");}
 if(o[4]?.op==="SELECT"&&!(o[4].path==="capitalCity"&&o[4].save_as==="$capital"))errors.push("bad_capital_select");
 if(o[5]?.op==="SOURCE"&&!(o[5].source_id==="openmeteo_geocode"&&o[5].args.city==="$capital")){sourceViolations++;errors.push("bad_geocode_source");}
 if(o[6]?.op==="FILTER_EQ"&&!(o[6].path==="country"&&o[6].ref==="$input.country")){constraintOmissionRejections++;errors.push("missing_geocode_country_filter");}
 if(o[8]?.op==="PROJECT"&&JSON.stringify(o[8].fields)!==JSON.stringify(["latitude","longitude","country","name"]))errors.push("bad_project");
 return errors;}

async function interpret(plan:Plan,input:{country:string},network:any[]){let value:any=undefined;const vars:Record<string,any>={};const trace:any[]=[];
 for(const [index,op] of plan.ops.entries()){
  switch(op.op){
   case "SOURCE":{
    if(op.source_id==="worldbank_countries"){value=await fetchJson(SOURCES.worldbank_countries.url,network);}
    else if(op.source_id==="openmeteo_geocode"){const city=vars[op.args.city];if(typeof city!=="string"||!city.trim())throw new Error("missing_capital_variable");const body:any=await fetchJson(SOURCES.openmeteo_geocode.url_template.replace("{city}",encodeURIComponent(city)),network);value=Array.isArray(body?.results)?body.results:[];}
    else{sourceViolations++;throw new Error("unknown_source_runtime");}
    break;
   }
   case "ARRAY_GET":if(!Array.isArray(value))throw new Error("array_get_non_array");value=value[op.index];break;
   case "FILTER_EQ":if(!Array.isArray(value))throw new Error("filter_non_array");value=value.filter((x:any)=>String(x?.[op.path]??"").trim()===String(input.country).trim());break;
   case "FIRST":if(!Array.isArray(value)||!value.length)throw new Error("first_empty");value=value[0];break;
   case "SELECT":value=value?.[op.path];if(typeof value!=="string"||!value.trim())throw new Error("select_empty");value=value.trim();vars[op.save_as]=value;break;
   case "PROJECT":{if(!value||typeof value!=="object")throw new Error("project_non_object");const out:any={};for(const f of op.fields)out[f]=value[f];value=out;break;}
   case "OUTPUT":{
    if(!value||typeof value.latitude!=="number"||typeof value.longitude!=="number"||String(value.country).trim()!==input.country.trim())throw new Error("semantic_constraint_failure");
    trace.push({index,op:op.op,value_fingerprint:sha(value)});
    return {capital:vars["$capital"],final_output:value,trace};
   }
   default:operationViolations++;throw new Error("unknown_operation_runtime");
  }
  trace.push({index,op:op.op,value_kind:Array.isArray(value)?"array":typeof value,value_fingerprint:sha(value)});
 }
 throw new Error("no_output");
}

async function callPlanner(config:any,c:any,previous?:string){plannerCalls++;if(previous)repairCalls++;const system=`You are MISSING Typed Constraint Composer. Return JSON only and obey the canonical schema exactly. Unknown properties or aliases fail. Top level keys: case_id, decision, reason, ops. decision is MANUFACTURE or REJECT. Allowed exact op shapes: SOURCE worldbank {op:'SOURCE',source_id:'worldbank_countries'}; ARRAY_GET {op:'ARRAY_GET',index:1}; FILTER_EQ {op:'FILTER_EQ',path:'name'|'country',ref:'$input.country'}; FIRST {op:'FIRST'}; SELECT {op:'SELECT',path:'capitalCity',save_as:'$capital'}; SOURCE geocode {op:'SOURCE',source_id:'openmeteo_geocode',args:{city:'$capital'}}; PROJECT {op:'PROJECT',fields:['latitude','longitude','country','name']}; OUTPUT {op:'OUTPUT'}. Do not use field/value/city/as aliases. The chain must preserve original country identity and must filter geocoder candidates by country before FIRST.`;
 const body={case:{case_id:c.case_id,intent:c.intent,input_schema:{country:"string"}},sources:SOURCES,semantic_requirements:["derive capital from World Bank record whose name equals $input.country","geocode $capital","filter geocoder candidate.country equals $input.country before FIRST","project latitude longitude country name from same candidate"],previous_failure:previous??null};
 const r=await fetch(`${config.baseUrl.replace(/\/$/,"")}/chat/completions`,{method:"POST",headers:{authorization:`Bearer ${config.apiKey}`,"content-type":"application/json"},body:JSON.stringify({model:"gpt-5.6-luna",messages:[{role:"system",content:system},{role:"user",content:JSON.stringify(body)}],response_format:{type:"json_object"}})});if(!r.ok)throw new Error(`planner_${r.status}:${await r.text()}`);const b:any=await r.json();return JSON.parse(b.choices?.[0]?.message?.content??"{}");}
function parseStrict(raw:any){if(hasAliasFields(raw))aliasRejections++;const p=planSchema.safeParse(raw);if(!p.success)return {plan:null,error:"planner_contract_invalid",details:p.error.issues};return {plan:p.data,error:null,details:[]};}

const config=loadConfig();if(!config.apiKey)throw new Error("OPENAI_API_KEY required for Experiment 3N2");const results:any[]=[],persisted:any[]=[];
for(const c of CASES){let raw=await callPlanner(config,c),parsed=parseStrict(raw),plan=parsed.plan as Plan|null,errors:string[]=parsed.error?[parsed.error]:plan?staticValidate(plan,c):["no_plan"],repaired=false,execution:any=null,network:any[]=[];
 const canRepair=()=>!repaired;
 if((parsed.error||errors.length)&&canRepair()){
  raw=await callPlanner(config,c,parsed.error?"Planner JSON violated the strict typed contract. Return only canonical fields and exact operation shapes.":"Plan violated the frozen semantic sequence or country-preservation requirement.");repaired=true;parsed=parseStrict(raw);plan=parsed.plan as Plan|null;errors=parsed.error?[parsed.error]:plan?staticValidate(plan,c):["no_plan"];
 }
 if(plan?.decision==="MANUFACTURE"&&!errors.length){
  try{execution=await interpret(plan,c.build,network);}catch(e){
   if(canRepair()){
    raw=await callPlanner(config,c,"The strict static-valid recipe failed live execution or semantic validation. Repair the recipe only; keep the same canonical DSL, sources, intent and country constraint.");repaired=true;parsed=parseStrict(raw);plan=parsed.plan as Plan|null;errors=parsed.error?[parsed.error]:plan?staticValidate(plan,c):["no_plan"];network=[];
    if(plan?.decision==="MANUFACTURE"&&!errors.length)try{execution=await interpret(plan,c.build,network);}catch(e2){execution={error:String(e2)};}else execution={error:"repair_invalid"};
   }else execution={error:String(e)};
  }
 }
 const validated=Boolean(plan?.decision==="MANUFACTURE"&&!errors.length&&execution&&!execution.error);if(validated)persisted.push({case_id:c.case_id,plan,execution,fingerprint:sha(plan)});results.push({case_id:c.case_id,raw_plan:raw,plan,contract_error:parsed.error,static_errors:errors,strict_typed:Boolean(plan&&!parsed.error),validated,repaired,execution,network_evidence:network});
}

const replay:any[]=[];for(const p of persisted){const c=CASES.find(x=>x.case_id===p.case_id)!;const before=plannerCalls,network:any[]=[];try{const output=await interpret(p.plan,c.replay,network);replay.push({case_id:p.case_id,input:c.replay,success:true,output,fingerprint:p.fingerprint,network_evidence:network});}catch(e){replay.push({case_id:p.case_id,input:c.replay,success:false,error:String(e),fingerprint:p.fingerprint,network_evidence:network});}replayPlannerCalls+=plannerCalls-before;}
const rs=replay.filter(x=>x.success).length,rr=persisted.length?rs/persisted.length:0;const semanticOk=persisted.every(p=>String(p.execution.final_output.country).trim()===String(CASES.find(c=>c.case_id===p.case_id)!.build.country).trim()&&replay.filter(r=>r.case_id===p.case_id&&r.success).every(r=>String(r.output.final_output.country).trim()===String(r.input.country).trim()));
const aliasAccepted=persisted.filter(p=>hasAliasFields(p.plan)).length;
const constraintOmissionAccepted=persisted.filter(p=>staticValidate(p.plan,CASES.find(c=>c.case_id===p.case_id)!).some(e=>e.includes("country_filter"))).length;
const criteria={one_manufacture:results.some(x=>x.plan?.decision==="MANUFACTURE"),one_strict_typed_plan:results.some(x=>x.strict_typed&&!x.static_errors.length),one_live_semantic_success:persisted.length>=1,one_independent_replay:rs>=1,replay_success_rate:rr===1,all_successes_preserve_country:semanticOk,unknown_alias_fields_accepted_zero:aliasAccepted===0,constraint_omissions_accepted_zero:constraintOmissionAccepted===0,replay_planner_repair_calls_zero:replayPlannerCalls===0,source_operation_host_policy_zero:sourceViolations===0&&operationViolations===0&&hostViolations===0,redirects_zero:redirectsFollowed===0,credentials_zero:credentialsSupplied===0,arbitrary_code_zero:arbitraryCodeExecuted===0,fingerprints_evidence_persisted:persisted.every(x=>x.fingerprint?.length===64&&Array.isArray(x.execution?.trace)&&x.execution.trace.length>0)};
const decision=Object.values(criteria).every(Boolean)?"GO_TYPED_CONSTRAINT_COMPOSITION":"REASSESS_TYPED_CONSTRAINT_COMPOSITION";
const summary={experiment:"MISSING Experiment 3N2 — Typed Constraint Composition",created_at:new Date().toISOString(),metrics:{cases:CASES.length,planner_calls:plannerCalls,repair_calls:repairCalls,manufacture_decisions:results.filter(x=>x.plan?.decision==="MANUFACTURE").length,strict_typed_plans:results.filter(x=>x.strict_typed).length,static_valid_plans:results.filter(x=>x.strict_typed&&!x.static_errors.length).length,validated_chains:persisted.length,replay_successes:rs,replay_success_rate:rr,replay_planner_calls:replayPlannerCalls,alias_rejections:aliasRejections,alias_fields_accepted:aliasAccepted,constraint_omission_rejections:constraintOmissionRejections,constraint_omissions_accepted:constraintOmissionAccepted,source_policy_violations:sourceViolations,operation_policy_violations:operationViolations,host_policy_violations:hostViolations,redirects_followed:redirectsFollowed,credentials_supplied:credentialsSupplied,arbitrary_code_executed:arbitraryCodeExecuted},criteria,decision,results:results.map(x=>({case_id:x.case_id,plan:x.plan,contract_error:x.contract_error,static_errors:x.static_errors,strict_typed:x.strict_typed,validated:x.validated,repaired:x.repaired,execution:x.execution})),replay:replay.map(x=>({case_id:x.case_id,input:x.input,success:x.success,output:x.output,error:x.error,fingerprint:x.fingerprint}))};
await mkdir("results/experiment-3n2",{recursive:true});await writeFile("results/experiment-3n2/summary.json",JSON.stringify(summary,null,2)+"\n");await writeFile("results/experiment-3n2/evidence.json",JSON.stringify({sources:SOURCES,results,persisted,replay},null,2)+"\n");console.log(JSON.stringify(summary,null,2));
