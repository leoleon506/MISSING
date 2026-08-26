import type {Candidate,CaseDef} from "./experiment3qCore.js";
import {ALLOWED_SPLIT_DELIMITERS,type BindingKind,type BindingPlan,type ExecutionCase,type ProcurementPlan,type Readiness} from "./experiment3rCore.js";

const SLOT_FIELDS=["name","kind","source","delimiter","index","literal"] as const;
const TOP_FIELDS=["case_id","decision","candidate_id","reason"] as const;
const JSON_SCHEMA:any={name:"missing_3r_typed_binding_plan",strict:true,schema:{type:"object",additionalProperties:false,required:[...TOP_FIELDS,...Array.from({length:6},(_,i)=>SLOT_FIELDS.map(f=>`param${i+1}_${f}`)).flat()],properties:{case_id:{type:"string"},decision:{type:"string",enum:["COMPILE","REJECT"]},candidate_id:{type:"string"},reason:{type:"string"}}}};
for(let i=1;i<=6;i++){
  JSON_SCHEMA.schema.properties[`param${i}_name`]={type:"string"};
  JSON_SCHEMA.schema.properties[`param${i}_kind`]={type:"string",enum:["DIRECT","SPLIT","LITERAL","UNUSED"]};
  JSON_SCHEMA.schema.properties[`param${i}_source`]={type:"string"};
  JSON_SCHEMA.schema.properties[`param${i}_delimiter`]={type:"string",enum:["",",",":","/","|",";"," "]};
  JSON_SCHEMA.schema.properties[`param${i}_index`]={type:"integer",minimum:-1,maximum:8};
  JSON_SCHEMA.schema.properties[`param${i}_literal`]={type:"string"};
}

export function parseProcurementPlan(attempt:any){
  if(!attempt.http_ok)return {plan:null as ProcurementPlan|null,error:`planner_http_${attempt.http_status}`,issues:[] as string[]};
  if(attempt.refusal)return {plan:null,error:"planner_refusal",issues:[] as string[]};
  if(!attempt.parsed_json)return {plan:null,error:"planner_json_parse_failure",issues:[] as string[]};
  const x=attempt.parsed_json,expected=[...TOP_FIELDS,...Array.from({length:6},(_,i)=>SLOT_FIELDS.map(f=>`param${i+1}_${f}`)).flat()],keys=Object.keys(x&&typeof x==="object"&&!Array.isArray(x)?x:{}),issues:string[]=[];
  for(const k of expected)if(!(k in x))issues.push(`missing:${k}`);for(const k of keys)if(!expected.includes(k as any))issues.push(`extra:${k}`);
  if(typeof x.case_id!=="string")issues.push("case_id_type");if(!["COMPILE","REJECT"].includes(x.decision))issues.push("decision_enum");if(typeof x.candidate_id!=="string")issues.push("candidate_id_type");if(typeof x.reason!=="string")issues.push("reason_type");
  const bindings:BindingPlan[]=[];
  for(let i=1;i<=6;i++){
    const name=x[`param${i}_name`],kind=x[`param${i}_kind`],source=x[`param${i}_source`],delimiter=x[`param${i}_delimiter`],index=x[`param${i}_index`],literal=x[`param${i}_literal`];
    if(typeof name!=="string")issues.push(`param${i}_name_type`);if(!["DIRECT","SPLIT","LITERAL","UNUSED"].includes(kind))issues.push(`param${i}_kind_enum`);if(typeof source!=="string")issues.push(`param${i}_source_type`);if(typeof delimiter!=="string"||(!ALLOWED_SPLIT_DELIMITERS.has(delimiter)&&delimiter!==""))issues.push(`param${i}_delimiter_enum`);if(!Number.isInteger(index)||index< -1||index>8)issues.push(`param${i}_index_range`);if(typeof literal!=="string")issues.push(`param${i}_literal_type`);
    bindings.push({name:String(name??""),kind:kind as BindingKind,source:String(source??""),delimiter:String(delimiter??""),index:Number(index),literal:String(literal??"")});
  }
  if(issues.length)return {plan:null,error:"planner_contract_invalid",issues};return {plan:{case_id:x.case_id,decision:x.decision,candidate_id:x.candidate_id,reason:x.reason,bindings},error:null,issues:[] as string[]};
}

export async function callProcurementPlanner(config:any,c:CaseDef,execCase:ExecutionCase,candidate:Candidate,readiness:Readiness,phase:"initial"|"repair",previous?:string){
  const system=["You are the MISSING typed binding compiler planner.","The provider and exact GET operation were already discovered from a live registry contract.","Return only the strict response object.","Choose COMPILE only if the frozen case input can be mapped to the declared path/query parameters using bounded DIRECT, SPLIT, LITERAL, or UNUSED bindings.","DIRECT must be exactly one $input.<field> value.","SPLIT may split one $input.<field> using one allowed literal delimiter and one zero-based index.","LITERAL may be used only for a declared parameter and must not replace an available case input merely to fabricate success.","Bind at least one case input whenever the case has inputs.","When several declared parameters could consume the same input, prefer the narrowest parameter whose name and description express exact identity or code matching over a broad full-text search parameter; this improves deterministic replay without provider-specific knowledge.","UNUSED slots must have empty name/source/delimiter/literal and index -1.","DIRECT slots must have delimiter/literal empty and index -1. SPLIT slots must have literal empty. LITERAL slots must have source/delimiter empty and index -1.","Do not emit URLs, hostnames, provider names, output paths, headers, credentials, code, concatenations, regexes, templates, arithmetic, or extra properties.","Do not invent parameters. If the discovered operation cannot use the case input, return REJECT."].join(" ");
  const payload={case:{case_id:c.case_id,intent:c.intent,input:execCase.build,required_output_leaf_names:c.required_output_leaf_names},discovered_candidate:{candidate_id:candidate.candidate_id,path:candidate.path,method:candidate.method,operation_id:candidate.operation_id,summary:candidate.summary,description:candidate.description,params:readiness.params.filter(p=>["path","query"].includes(p.in)).map(p=>({name:p.name,in:p.in,required:p.required,description:p.description,schema_type:p.schema?.type??null,enum:Array.isArray(p.schema?.enum)?p.schema.enum.slice(0,20):null}))},previous_static_failure:previous??null};
  const r=await fetch(`${config.baseUrl.replace(/\/$/,"")}/chat/completions`,{method:"POST",headers:{authorization:`Bearer ${config.apiKey}`,"content-type":"application/json"},body:JSON.stringify({model:config.model,messages:[{role:"system",content:system},{role:"user",content:JSON.stringify(payload)}],response_format:{type:"json_schema",json_schema:JSON_SCHEMA}})});
  const text=await r.text();let body:any=null;try{body=JSON.parse(text);}catch{}const msg=body?.choices?.[0]?.message,raw=msg?.content??null;let parsed:any=null,parse_error:string|null=null;if(typeof raw==="string"){try{parsed=JSON.parse(raw);}catch(e){parse_error=String(e);}}
  return {phase,http_status:r.status,http_ok:r.ok,raw_response:text,raw_content:raw,refusal:msg?.refusal??null,parsed_json:parsed,parse_error};
}
