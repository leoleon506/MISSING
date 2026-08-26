import {compileRequest,enforceReplayDeltas,executeExpr,validateDecision,type CompileDecision,type HoldoutCase,type ProviderRef} from "./experiment3yCore.js";
import type {DocEvidence,SafetyEvent} from "./experiment3wCore.js";

export function run3yControls(){
 const c:HoldoutCase={case_id:"synthetic_guard_case",intent:"synthetic guard fixture",input_names:["id"],build:{id:"A"},replay:{id:"B"},required_output_leaf_names:["code","name"],validator:"book"};
 const p:ProviderRef={candidate_id:"p_guard",name:"Guard Provider",link:"https://api.example.com/docs"};
 const text="Documentation. GET https://api.example.com/items/{id}. Path parameter id. Optional query parameter format with documented literal json. Response JSON fields code and name. Map field records. Array field rows where field id and value field label.";
 const ev:DocEvidence={evidence_id:"p_guard-e01",provider_candidate_id:p.candidate_id,requested_url:p.link,resolved_url:p.link,verified_at:new Date(0).toISOString(),status:200,content_type:"text/plain",body_fingerprint:"fixture",text,state:"ok"};
 const valid:CompileDecision={case_id:c.case_id,provider_candidate_id:p.candidate_id,decision:"COMPILE",method:"GET",base_url:"https://api.example.com",path_template:"/items/{id}",path_bindings:{id:"$input.id"},query_bindings:{},outputs:{code:{op:"FIELD",path:"code"},name:{op:"FIELD",path:"name"}},evidence_ids:[ev.evidence_id],reason:"fixture"};
 const controls:any[]=[];
 function reject(name:string,fn:()=>any,guard:string){let rejected=false,error="";try{fn();}catch(e){rejected=true;error=String(e);}controls.push({control:name,executed:true,rejected,guard,evidence:{error}});}
 reject("wrong_case_id",()=>validateDecision({...valid,case_id:"wrong"},c,p,[ev]),"validateDecision");
 reject("wrong_provider_id",()=>validateDecision({...valid,provider_candidate_id:"wrong"},c,p,[ev]),"validateDecision");
 reject("empty_evidence_ids",()=>validateDecision({...valid,evidence_ids:[]},c,p,[ev]),"validateDecision");
 reject("unknown_evidence_id",()=>validateDecision({...valid,evidence_ids:["missing"]},c,p,[ev]),"validateDecision");
 const cross={...ev,evidence_id:"cross",provider_candidate_id:"other"};reject("cross_provider_evidence",()=>validateDecision({...valid,evidence_ids:["cross"]},c,p,[cross]),"validateDecision");
 reject("non_get_method",()=>validateDecision({...valid,method:"POST" as any},c,p,[ev]),"validateDecision");
 reject("non_https_base",()=>validateDecision({...valid,base_url:"http://api.example.com"},c,p,[ev]),"validateDecision");
 reject("ip_literal_base",()=>validateDecision({...valid,base_url:"https://127.0.0.1"},c,p,[ev]),"validateDecision");
 reject("undocumented_host",()=>validateDecision({...valid,base_url:"https://evil.example"},c,p,[ev]),"validateDecision");
 reject("undocumented_path",()=>validateDecision({...valid,path_template:"/evil/{id}"},c,p,[ev]),"validateDecision");
 reject("unbound_path_placeholder",()=>validateDecision({...valid,path_bindings:{}},c,p,[ev]),"validateDecision");
 reject("invalid_input_source",()=>validateDecision({...valid,path_bindings:{id:"$input.unknown"}},c,p,[ev]),"validateDecision");
 reject("invented_path_parameter",()=>validateDecision({...valid,path_template:"/items/{secret}",path_bindings:{secret:"$input.id"}},c,p,[ev]),"validateDecision");
 reject("invented_query_parameter",()=>validateDecision({...valid,query_bindings:{secret:"$input.id"}},c,p,[ev]),"validateDecision");
 reject("ungrounded_query_literal",()=>validateDecision({...valid,query_bindings:{format:"xml"}},c,p,[ev]),"validateDecision");
 reject("missing_required_output",()=>validateDecision({...valid,outputs:{code:{op:"FIELD",path:"code"}}},c,p,[ev]),"validateDecision");
 reject("extra_canonical_output",()=>validateDecision({...valid,outputs:{...valid.outputs,extra:{op:"FIELD",path:"code"}}},c,p,[ev]),"validateDecision");
 reject("unsupported_dsl_operator",()=>validateDecision({...valid,outputs:{...valid.outputs,name:{op:"EVAL",path:"name"} as any}},c,p,[ev]),"validateDecision");
 reject("unknown_projection_input",()=>validateDecision({...valid,outputs:{...valid.outputs,name:{op:"INPUT",name:"unknown"}}},c,p,[ev]),"validateDecision");
 reject("ungrounded_field",()=>validateDecision({...valid,outputs:{...valid.outputs,name:{op:"FIELD",path:"invented"}}},c,p,[ev]),"validateDecision");
 reject("expression_extra_field",()=>validateDecision({...valid,outputs:{...valid.outputs,name:{op:"FIELD",path:"name",script:"x"} as any}},c,p,[ev]),"validateDecision");
 reject("ungrounded_lookup_map",()=>validateDecision({...valid,outputs:{...valid.outputs,name:{op:"LOOKUP",map_path:"unknownMap",key:{op:"INPUT",name:"id"},value_path:"name"}}},c,p,[ev]),"validateDecision");
 reject("ungrounded_lookup_value",()=>validateDecision({...valid,outputs:{...valid.outputs,name:{op:"LOOKUP",map_path:"records",key:{op:"INPUT",name:"id"},value_path:"unknown"}}},c,p,[ev]),"validateDecision");
 reject("ungrounded_find_array",()=>validateDecision({...valid,outputs:{...valid.outputs,name:{op:"FIND",array_path:"unknownRows",where_path:"id",equals:{op:"INPUT",name:"id"},value_path:"label"}}},c,p,[ev]),"validateDecision");
 reject("path_segment_limit",()=>validateDecision({...valid,outputs:{...valid.outputs,name:{op:"FIELD",path:Array.from({length:13},()=>"name").join(".")}}},c,p,[ev]),"validateDecision");
 reject("find_scan_bound",()=>executeExpr({op:"FIND",array_path:"rows",where_path:"id",equals:{op:"LITERAL",value:"A"},value_path:"label"},{rows:Array.from({length:501},()=>({id:"A",label:"x"}))},{}),"executeExpr");
 reject("credential_bearing_execution_url",()=>compileRequest({...valid,base_url:"https://user:pass@api.example.com"},{id:"A"}),"compileRequest");
 reject("replay_external_call_delta",()=>enforceReplayDeltas({catalog_fetches:0,documentation_fetches:1,compiler_calls:0}),"enforceReplayDeltas");
 const safety:SafetyEvent[]=[];reject("arbitrary_code_top_level",()=>validateDecision({...valid,script:"return 1"} as any,c,p,[ev],safety),"validateDecision");
 return {controls,safety};
}
