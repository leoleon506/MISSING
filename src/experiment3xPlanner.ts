import type {Config} from "./config/index.js";
import type {CompileDecision,Frozen3xCase} from "./experiment3xCore.js";

function promptFor(c:Frozen3xCase,phase:"initial"|"repair",previous?:string){return {case:{case_id:c.case_id,provider_candidate_id:c.provider_candidate_id,provider_name:c.provider_name,build_input:c.build,replay_input:c.replay,required_outputs:c.required,kind:c.kind,negative_reason:c.negative_reason??null},request:c.request??null,evidence:c.evidence,projection_dsl:{FIELD:{op:"FIELD",path:"provider.response.path"},INPUT:{op:"INPUT",name:"input_name"},LOOKUP:{op:"LOOKUP",map_path:"object.map.path",key:{op:"INPUT",name:"input_name"},value_path:"relative.field"},FIND:{op:"FIND",array_path:"array.path",where_path:"relative.match.field",equals:{op:"INPUT",name:"input_name"},value_path:"relative.output.field"}},phase,previous_validation_error:previous??null};}
export async function compileProjection(config:Config,c:Frozen3xCase,phase:"initial"|"repair",previous?:string){const system=[
 "You are MISSING's evidence-grounded semantic projection compiler.",
 "Use ONLY the supplied frozen evidence and frozen request template.",
 "Never invent or modify an endpoint, host, method, credential, header, input, response field, or provider.",
 "The HTTP request is already frozen; your job is only to map its JSON response into the required canonical outputs.",
 "Allowed projection operators are exactly FIELD, INPUT, LOOKUP, FIND as shown in the payload. No other operators, code, scripts, regex, arithmetic, loops, functions, URLs, or network actions.",
 "Provider-native field names may differ from canonical output names when the supplied documentation explicitly defines their semantics. Example principle: a documented provider field described as a currency name may satisfy canonical name; do not require literal leaf-name equality.",
 "LOOKUP is valid when the evidence documents an object/map keyed by a runtime input. FIND is valid only for a documented array shape.",
 "For COMPILE return exactly: case_id, provider_candidate_id, decision, outputs, evidence_ids, reason.",
 "For REJECT return exactly: case_id, provider_candidate_id, decision, reason.",
 "If the case is negative, or the evidence cannot support every required output without credentials or invention, return REJECT.",
 "Return one JSON object only."
 ].join(" ");const payload=promptFor(c,phase,previous);const r=await fetch(`${config.baseUrl.replace(/\/$/,"")}/chat/completions`,{method:"POST",headers:{authorization:`Bearer ${config.apiKey}`,"content-type":"application/json"},body:JSON.stringify({model:config.model,messages:[{role:"system",content:system},{role:"user",content:JSON.stringify(payload)}],response_format:{type:"json_object"}})});const text=await r.text();let body:any=null;try{body=JSON.parse(text);}catch{}const msg=body?.choices?.[0]?.message,raw=msg?.content??null;let parsed_json:CompileDecision|null=null,parse_error:string|null=null;if(typeof raw==="string"){try{parsed_json=JSON.parse(raw);}catch(e){parse_error=String(e);}}return {phase,http_status:r.status,http_ok:r.ok,refusal:msg?.refusal??null,raw_content:raw,parsed_json,parse_error};}
