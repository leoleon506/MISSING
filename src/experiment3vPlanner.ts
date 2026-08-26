import type {CaseDef} from "./experiment3qCore.js";
import {plannerVisibleCandidates,validateRerankObject,type ProviderCandidate} from "./experiment3vCore.js";

const JSON_SCHEMA:any={name:"missing_3v_provider_rerank",strict:true,schema:{type:"object",additionalProperties:false,required:["case_id","selected"],properties:{case_id:{type:"string"},selected:{type:"array",maxItems:12,items:{type:"object",additionalProperties:false,required:["candidate_id","reason"],properties:{candidate_id:{type:"string"},reason:{type:"string"}}}}}}};

export function parseRerankAttempt(attempt:any,broad:ProviderCandidate[],expectedCaseId?:string){if(!attempt.http_ok)return {selection:null,error:`planner_http_${attempt.http_status}`};if(attempt.refusal)return {selection:null,error:"planner_refusal"};if(!attempt.parsed_json)return {selection:null,error:"planner_json_parse_failure"};return validateRerankObject(attempt.parsed_json,broad,expectedCaseId??attempt.expected_case_id);}

export async function callProviderReranker(config:any,c:CaseDef,broad:ProviderCandidate[],phase:"initial"|"repair",previous?:string){
  const system=["You are the MISSING semantic provider reranker.","Select up to 12 provider candidates that are most functionally likely to satisfy the requested capability.","You may select only opaque candidate_id values from the supplied candidate list.","Rank by functional fit, not lexical overlap alone.","Do not emit or infer URLs, hosts, endpoints, operation paths, headers, credentials, code, or providers outside the list.","Return the exact supplied case_id and only the strict response object."].join(" ");
  const payload={case:{case_id:c.case_id,intent:c.intent,input_names:c.input_names,required_output_leaf_names:c.required_output_leaf_names},providers:plannerVisibleCandidates(broad),previous_response_contract_failure:previous??null};
  const r=await fetch(`${config.baseUrl.replace(/\/$/,"")}/chat/completions`,{method:"POST",headers:{authorization:`Bearer ${config.apiKey}`,"content-type":"application/json"},body:JSON.stringify({model:config.model,messages:[{role:"system",content:system},{role:"user",content:JSON.stringify(payload)}],response_format:{type:"json_schema",json_schema:JSON_SCHEMA}})});
  const text=await r.text();let body:any=null;try{body=JSON.parse(text);}catch{}const msg=body?.choices?.[0]?.message,raw=msg?.content??null;let parsed:any=null,parse_error:string|null=null;if(typeof raw==="string"){try{parsed=JSON.parse(raw);}catch(e){parse_error=String(e);}}
  return {phase,expected_case_id:c.case_id,http_status:r.status,http_ok:r.ok,raw_response:text,raw_content:raw,refusal:msg?.refusal??null,parsed_json:parsed,parse_error};
}
