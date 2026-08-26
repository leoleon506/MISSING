import type {HoldoutCase} from "./experiment3yCore.js";
import {plannerVisibleCandidates,validateRerankObject,type ProviderCandidate} from "./experiment3vCore.js";

function schemaFor(broad:ProviderCandidate[]){return {name:"missing_3y_provider_rerank",strict:true,schema:{type:"object",additionalProperties:false,required:["case_id","selected"],properties:{case_id:{type:"string"},selected:{type:"array",minItems:1,maxItems:12,items:{type:"object",additionalProperties:false,required:["candidate_id","reason"],properties:{candidate_id:{type:"string",enum:broad.map(x=>x.candidate_id)},reason:{type:"string"}}}}}}};}

export function parse3yRerankAttempt(attempt:any,broad:ProviderCandidate[],expectedCaseId:string){if(!attempt.http_ok)return {selection:null,error:`planner_http_${attempt.http_status}`};if(attempt.refusal)return {selection:null,error:"planner_refusal"};if(!attempt.parsed_json)return {selection:null,error:"planner_json_parse_failure"};return validateRerankObject(attempt.parsed_json,broad,expectedCaseId);}

export async function call3yProviderReranker(config:any,c:HoldoutCase,broad:ProviderCandidate[],phase:"initial"|"repair",previous?:string){
 const system=[
  "You are the MISSING high-recall provider reranker for a blind capability-manufacture benchmark.",
  "Select up to 12 provider candidates from the supplied bounded list, ordered from most to least promising. Prefer a broad slate (usually 10-12) when multiple candidates are plausible.",
  "MAXIMIZE RECALL: catalog descriptions are sparse, so include general-purpose providers from the correct functional category instead of only candidates whose one-line description repeats exact field names.",
  "For book identifiers such as ISBN, prefer library catalogs, book metadata/reference APIs, bibliographic APIs, and general book-data services over APIs that only serve one specific text or corpus.",
  "For postcode/location identifiers, prefer postcode lookup, geocoding, address, and reference-data APIs. For IP identifiers, prefer IP lookup/geolocation APIs.",
  "Use the requested input semantics and ALL required outputs. Keep plausible correct-category fallbacks even when their catalog description is generic.",
  "You may select only candidate_id values allowed by the response schema. Do not emit URLs, hosts, endpoints, headers, credentials, code, or providers outside the list.",
  "Return the exact supplied case_id and only the strict response object."
 ].join(" ");
 const payload={case:{case_id:c.case_id,intent:c.intent,input_names:c.input_names,required_output_leaf_names:c.required_output_leaf_names},providers:plannerVisibleCandidates(broad),phase,previous_response_contract_failure:previous??null};
 const r=await fetch(`${config.baseUrl.replace(/\/$/,"")}/chat/completions`,{method:"POST",headers:{authorization:`Bearer ${config.apiKey}`,"content-type":"application/json"},body:JSON.stringify({model:config.model,messages:[{role:"system",content:system},{role:"user",content:JSON.stringify(payload)}],response_format:{type:"json_schema",json_schema:schemaFor(broad)}})});
 const text=await r.text();let body:any=null;try{body=JSON.parse(text);}catch{}const msg=body?.choices?.[0]?.message,raw=msg?.content??null;let parsed:any=null,parse_error:string|null=null;if(typeof raw==="string"){try{parsed=JSON.parse(raw);}catch(e){parse_error=String(e);}}
 return {phase,expected_case_id:c.case_id,http_status:r.status,http_ok:r.ok,raw_response:text,raw_content:raw,refusal:msg?.refusal??null,parsed_json:parsed,parse_error};
}
