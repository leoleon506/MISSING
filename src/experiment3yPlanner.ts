import type {Config} from "./config/index.js";
import type {DocEvidence} from "./experiment3wCore.js";
import type {HoldoutCase,ProviderRef,CompileDecision} from "./experiment3yCore.js";

function evidencePayload(evidence:DocEvidence[]){let used=0;const max=48000;return evidence.filter(e=>e.state==="ok").map(e=>{const left=Math.max(0,max-used),text=e.text.slice(0,Math.min(14000,left));used+=text.length;return {evidence_id:e.evidence_id,url:e.resolved_url,content_type:e.content_type,text};}).filter(x=>x.text.length>0);}

export async function compileCapability(config:Config,c:HoldoutCase,p:ProviderRef,evidence:DocEvidence[],phase:"initial"|"repair",previousError?:string){const system=[
 "You are MISSING's blind end-to-end capability compiler.",
 "Use ONLY the supplied capability contract and documentation evidence. Do not rely on prior knowledge of the provider.",
 "Return one JSON object only. If evidence does not literally support an anonymous public GET satisfying every required output, return REJECT.",
 "For REJECT use exactly: case_id, provider_candidate_id, decision, reason.",
 "For COMPILE use exactly: case_id, provider_candidate_id, decision, method, base_url, path_template, path_bindings, query_bindings, outputs, evidence_ids, reason.",
 "method must be GET. base_url must be an HTTPS origin literally present in cited evidence. path_template must be literally documented except placeholders.",
 "Bindings may reference only $input.<name> or documented literal strings.",
 "outputs maps every canonical output to exactly one bounded DSL expression.",
 "Allowed DSL: FIELD(path), represented as {op:'FIELD',path}; INPUT(name); LOOKUP(map_path,key,value_path) where key is INPUT or grounded LITERAL; FIND(array_path,where_path,equals,value_path) where equals is INPUT or grounded LITERAL.",
 "Never emit headers, Authorization, credentials, cookies, arbitrary functions, JavaScript, regex execution, shell, code, browser instructions, filesystem operations, loops, joins, arithmetic transforms, or network instructions.",
 "Provider-native path/field tokens in projections must be visibly grounded in cited documentation evidence. Cite only supplied evidence_ids."
 ].join(" ");
 const payload={case:{case_id:c.case_id,intent:c.intent,input_names:c.input_names,build_input:c.build,required_output_leaf_names:c.required_output_leaf_names},provider:{candidate_id:p.candidate_id,name:p.name},phase,previous_validation_error:previousError??null,evidence:evidencePayload(evidence)};
 const r=await fetch(`${config.baseUrl.replace(/\/$/,"")}/chat/completions`,{method:"POST",headers:{authorization:`Bearer ${config.apiKey}`,"content-type":"application/json"},body:JSON.stringify({model:config.model,messages:[{role:"system",content:system},{role:"user",content:JSON.stringify(payload)}],response_format:{type:"json_object"}})});
 const text=await r.text();let body:any=null;try{body=JSON.parse(text);}catch{}const msg=body?.choices?.[0]?.message,raw=msg?.content??null;let parsed:CompileDecision|null=null,parse_error:string|null=null;if(typeof raw==="string"){try{parsed=JSON.parse(raw);}catch(e){parse_error=String(e);}}
 return {phase,http_status:r.status,http_ok:r.ok,refusal:msg?.refusal??null,raw_content:raw,parsed_json:parsed,parse_error};
}
