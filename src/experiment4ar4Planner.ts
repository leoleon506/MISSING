import type {Config} from "./config/index.js";
import {FOUR_A_CASES} from "./experiment4aCore.js";
import type {Provider4A} from "./experiment4aContract.js";
import type {MicroContract} from "./experiment3wCore.js";
import type {ProjectionPlan} from "./experiment4arCore.js";
import {RESPONSE_REPAIR_SCHEMA,canonicalizeRepairProjection,summarizeJsonShape} from "./experiment4ar4Core.js";

const BY_ID=Object.fromEntries(FOUR_A_CASES.map(x=>[x.case_id,x]));
export async function repairProjection4ar4(config:Config,p:Provider4A,contract:MicroContract,projection:ProjectionPlan,body:any,failure:string){
 const ec=BY_ID[p.case_id],inputNames=Object.keys(ec.build),shape=summarizeJsonShape(body);
 const system=["You are MISSING's response-grounded projection repair compiler.","The HTTP request is immutable. You may repair ONLY the projection program.","Use only the supplied JSON structural shape, frozen case inputs, required outputs, and original projection.","Never invent or change provider, host, method, path, path binding, query parameter, query binding, credential, header, endpoint, or input.","Do not infer from response values because values are not provided.","If the structural shape cannot support every required output, return REJECT.","Projection rows may use only FIELD, INPUT, LOOKUP, FIND.","Paths use dotted notation with numeric array indices. No JSONPath, brackets, wildcard, code, or transformations."].join(" ");
 const immutable_request={method:contract.method,base_url:contract.base_url,path_template:contract.path_template,path_bindings:contract.path_bindings,query_bindings:contract.query_bindings,evidence_ids:contract.evidence_ids};
 const payload={case:{case_id:p.case_id,input_names:inputNames,required_outputs:ec.required},provider_candidate_id:p.candidate_id,immutable_request,original_projection:projection,semantic_failure:failure,response_shape:shape};
 const t0=Date.now();const r=await fetch(`${config.baseUrl.replace(/\/$/,"")}/chat/completions`,{method:"POST",headers:{authorization:`Bearer ${config.apiKey}`,"content-type":"application/json"},body:JSON.stringify({model:config.model,messages:[{role:"system",content:system},{role:"user",content:JSON.stringify(payload)}],response_format:{type:"json_schema",json_schema:RESPONSE_REPAIR_SCHEMA}})});
 const latency_ms=Date.now()-t0,text=await r.text();let response:any=null;try{response=JSON.parse(text);}catch{}const msg=response?.choices?.[0]?.message,raw=msg?.content??null;let parsed:any=null,parse_error:string|null=null,repaired:ProjectionPlan|null=null;
 if(typeof raw==="string"){try{parsed=JSON.parse(raw);if(parsed?.decision==="REPAIR")repaired=canonicalizeRepairProjection(parsed.projection,ec.required,inputNames);else if(parsed?.decision!=="REJECT")throw new Error("response_repair_decision_invalid");}catch(e){parse_error=String(e);}}
 return {http_status:r.status,http_ok:r.ok,refusal:msg?.refusal??null,raw_content:raw,parsed_json:parsed,parse_error,projection:repaired,usage:response?.usage??null,latency_ms,response_shape:shape};
}
