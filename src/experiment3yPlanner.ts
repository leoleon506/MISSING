import type {Config} from "./config/index.js";
import type {DocEvidence} from "./experiment3wCore.js";
import type {HoldoutCase,ProviderRef,CompileDecision} from "./experiment3yCore.js";

function terms(c:HoldoutCase){return [...new Set(["GET","https://","endpoint","example response","response",...c.input_names,...c.required_output_leaf_names,...c.intent.toLowerCase().match(/[a-z0-9_]+/g)||[]].filter(x=>String(x).length>=3).map(x=>String(x).toLowerCase()))];}
function compact(text:string,c:HoldoutCase,max=9000){if(text.length<=max)return text;const low=text.toLowerCase(),ranges:{a:number;b:number}[]=[];for(const t of terms(c)){let from=0,hits=0;while(hits<5){const i=low.indexOf(t,from);if(i<0)break;ranges.push({a:Math.max(0,i-700),b:Math.min(text.length,i+1700)});from=i+t.length;hits++;}}ranges.sort((x,y)=>x.a-y.a);const merged:{a:number;b:number}[]=[];for(const r of ranges){const last=merged.at(-1);if(last&&r.a<=last.b+80)last.b=Math.max(last.b,r.b);else merged.push({...r});}let out="";for(const r of merged){const chunk=text.slice(r.a,r.b);if(out.length+chunk.length>max)out+=chunk.slice(0,Math.max(0,max-out.length));else out+=chunk;if(out.length>=max)break;out+="\n...[relevance window]...\n";}return out||text.slice(0,max);}
function evidencePayload(evidence:DocEvidence[],c:HoldoutCase){const ok=evidence.filter(e=>e.state==="ok"),per=Math.max(5000,Math.floor(48000/Math.max(1,ok.length)));return ok.map(e=>({evidence_id:e.evidence_id,url:e.resolved_url,content_type:e.content_type,text:compact(e.text,c,Math.min(10000,per))})).filter(x=>x.text.length>0);}

export async function compileCapability(config:Config,c:HoldoutCase,p:ProviderRef,evidence:DocEvidence[],phase:"initial"|"repair",previousError?:string){const system=[
 "You are MISSING's blind end-to-end capability compiler.",
 "Use ONLY the supplied capability contract and documentation evidence. Do not rely on prior knowledge of the provider.",
 "Return one JSON object only. If evidence does not literally support an anonymous public GET satisfying every required output, return REJECT.",
 "For REJECT use exactly: case_id, provider_candidate_id, decision, reason.",
 "For COMPILE use exactly: case_id, provider_candidate_id, decision, method, base_url, path_template, path_bindings, query_bindings, outputs, evidence_ids, reason.",
 "method must be GET. base_url must be an HTTPS origin literally present in cited evidence. path_template must be literally documented except placeholders.",
 "path_bindings and query_bindings MUST be flat JSON objects whose VALUES ARE STRINGS, never nested objects. Example: {\"isbn\":\"$input.isbn\"} or {\"format\":\"json\"}.",
 "A binding may reference only $input.<name> or a documented literal string. Never emit {source:...}, {value:...}, or any wrapper object for a binding.",
 "outputs maps every canonical output to exactly one bounded DSL expression.",
 "Allowed DSL JSON forms are exactly: {\"op\":\"FIELD\",\"path\":\"field.path\"}; {\"op\":\"INPUT\",\"name\":\"input_name\"}; {\"op\":\"LOOKUP\",\"map_path\":\"map.path\",\"key\":{\"op\":\"INPUT\",\"name\":\"input_name\"},\"value_path\":\"field\"}; {\"op\":\"FIND\",\"array_path\":\"rows\",\"where_path\":\"id\",\"equals\":{\"op\":\"INPUT\",\"name\":\"input_name\"},\"value_path\":\"field\"}.",
 "For endpoint placeholders whose documented name differs from the canonical input name, bind the documented placeholder to the canonical input, e.g. {\"address\":\"$input.ip\"}.",
 "Never emit headers, Authorization, credentials, cookies, arbitrary functions, JavaScript, regex execution, shell, code, browser instructions, filesystem operations, loops, joins, arithmetic transforms, or network instructions.",
 "Provider-native path/field tokens in projections must be visibly grounded in cited documentation evidence. Cite only supplied evidence_ids."
 ].join(" ");
 const payload={case:{case_id:c.case_id,intent:c.intent,input_names:c.input_names,build_input:c.build,required_output_leaf_names:c.required_output_leaf_names},provider:{candidate_id:p.candidate_id,name:p.name},phase,previous_validation_error:previousError??null,evidence:evidencePayload(evidence,c)};
 const r=await fetch(`${config.baseUrl.replace(/\/$/,"")}/chat/completions`,{method:"POST",headers:{authorization:`Bearer ${config.apiKey}`,"content-type":"application/json"},body:JSON.stringify({model:config.model,messages:[{role:"system",content:system},{role:"user",content:JSON.stringify(payload)}],response_format:{type:"json_object"}})});
 const text=await r.text();let body:any=null;try{body=JSON.parse(text);}catch{}const msg=body?.choices?.[0]?.message,raw=msg?.content??null;let parsed:CompileDecision|null=null,parse_error:string|null=null;if(typeof raw==="string"){try{parsed=JSON.parse(raw);}catch(e){parse_error=String(e);}}
 return {phase,http_status:r.status,http_ok:r.ok,refusal:msg?.refusal??null,raw_content:raw,parsed_json:parsed,parse_error};
}
