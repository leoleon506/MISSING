import type {Candidate,CaseDef,PlannerSelection} from "./experiment3qCore.js";

const JSON_SCHEMA:any={name:"missing_3q_source_discovery",strict:true,schema:{type:"object",additionalProperties:false,required:["case_id","decision","candidate_id","reason"],properties:{case_id:{type:"string"},decision:{type:"string",enum:["DISCOVER","REJECT"]},candidate_id:{type:"string"},reason:{type:"string"}}}};

export function parsePlannerSelection(attempt:any){
  if(!attempt.http_ok)return {selection:null as PlannerSelection|null,error:`planner_http_${attempt.http_status}`};if(attempt.refusal)return {selection:null,error:"planner_refusal"};if(!attempt.parsed_json)return {selection:null,error:"planner_json_parse_failure"};
  const x=attempt.parsed_json,keys=Object.keys(x&&typeof x==="object"&&!Array.isArray(x)?x:{}),expected=["case_id","decision","candidate_id","reason"],issues:string[]=[];
  for(const k of expected)if(!(k in x))issues.push(`missing:${k}`);for(const k of keys)if(!expected.includes(k))issues.push(`extra:${k}`);if(typeof x.case_id!=="string")issues.push("case_id_type");if(!["DISCOVER","REJECT"].includes(x.decision))issues.push("decision_enum");if(typeof x.candidate_id!=="string")issues.push("candidate_id_type");if(typeof x.reason!=="string")issues.push("reason_type");
  if(issues.length)return {selection:null,error:`planner_contract_invalid:${issues.join(",")}`};return {selection:{case_id:x.case_id,decision:x.decision,candidate_id:x.candidate_id,reason:x.reason} as PlannerSelection,error:null};
}

export async function callPlanner(config:any,c:CaseDef,candidates:Candidate[],phase:"initial"|"repair",previous?:string){
  const system=["You are MISSING Source Discovery.","Choose the single best exact candidate operation for the requested capability from only the supplied candidates derived from live registry contracts.","Return only the strict response object.","Emit DISCOVER with the exact opaque candidate_id when a candidate can plausibly satisfy the requested inputs and outputs; otherwise emit REJECT.","Do not emit provider names, URLs, hostnames, operation paths, code, headers, credentials, or extra properties.","Do not invent candidate ids."].join(" ");
  const payload={case:{case_id:c.case_id,intent:c.intent,input_names:c.input_names,required_output_leaf_names:c.required_output_leaf_names},live_registry_candidates:candidates,previous_response_contract_failure:previous??null};
  const r=await fetch(`${config.baseUrl.replace(/\/$/,"")}/chat/completions`,{method:"POST",headers:{authorization:`Bearer ${config.apiKey}`,"content-type":"application/json"},body:JSON.stringify({model:config.model,messages:[{role:"system",content:system},{role:"user",content:JSON.stringify(payload)}],response_format:{type:"json_schema",json_schema:JSON_SCHEMA}})});
  const text=await r.text();let body:any=null;try{body=JSON.parse(text);}catch{}const msg=body?.choices?.[0]?.message,raw=msg?.content??null;let parsed:any=null,parse_error:string|null=null;if(typeof raw==="string"){try{parsed=JSON.parse(raw);}catch(e){parse_error=String(e);}}
  return {phase,http_status:r.status,http_ok:r.ok,raw_response:text,raw_content:raw,refusal:msg?.refusal??null,parsed_json:parsed,parse_error};
}
