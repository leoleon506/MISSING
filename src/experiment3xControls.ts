import {CASES,MAX_FIND_ITEMS,enforceReplayDeltas,executeExpr,validateDecision,validateRequestTemplate,type CompileDecision,type Frozen3xCase,type ProjectionExpr} from "./experiment3xCore.js";
import type {SafetyEvent} from "./experiment3wCore.js";

const nbp=CASES.find(c=>c.case_id==="currency_metadata_nbp")!;
const cf=CASES.find(c=>c.case_id==="currency_metadata_currencyfreaks")!;
const base:CompileDecision={case_id:nbp.case_id,provider_candidate_id:nbp.provider_candidate_id,decision:"COMPILE",outputs:{code:{op:"FIELD",path:"code"},name:{op:"FIELD",path:"currency"}},evidence_ids:nbp.evidence.map(e=>e.evidence_id),reason:"grounded"};
function mustReject(name:string,guard:string,fn:()=>any){try{fn();return {control:name,executed:true,rejected:false,guard,evidence:"no_rejection"};}catch(e){return {control:name,executed:true,rejected:true,guard,evidence:String(e)};}}
function badExpr(output:string,e:any){return {...base,outputs:{...base.outputs,[output]:e}};}
export function run3xControls(){const c:any[]=[];
 c.push(mustReject("wrong_case_id","validateDecision",()=>validateDecision({...base,case_id:"wrong"},nbp)));
 c.push(mustReject("wrong_provider_id","validateDecision",()=>validateDecision({...base,provider_candidate_id:"wrong"},nbp)));
 c.push(mustReject("empty_evidence_ids","validateDecision",()=>validateDecision({...base,evidence_ids:[]},nbp)));
 c.push(mustReject("unknown_evidence_id","validateDecision",()=>validateDecision({...base,evidence_ids:["missing"]},nbp)));
 c.push(mustReject("cross_provider_evidence","validateDecision",()=>validateDecision({...base,evidence_ids:[cf.evidence[0].evidence_id]},nbp)));
 c.push(mustReject("missing_required_output","validateDecision",()=>validateDecision({...base,outputs:{code:{op:"FIELD",path:"code"}}},nbp)));
 c.push(mustReject("extra_canonical_output","validateDecision",()=>validateDecision({...base,outputs:{...base.outputs,extra:{op:"FIELD",path:"code"}}},nbp)));
 c.push(mustReject("unsupported_dsl_operator","validateDecision",()=>validateDecision(badExpr("name",{op:"EVAL",code:"x"}),nbp)));
 c.push(mustReject("unknown_input_name","validateDecision",()=>validateDecision(badExpr("name",{op:"INPUT",name:"unknown"}),nbp)));
 c.push(mustReject("field_ungrounded_path","validateDecision",()=>validateDecision(badExpr("name",{op:"FIELD",path:"madeup"}),nbp)));
 const cfBase:CompileDecision={case_id:cf.case_id,provider_candidate_id:cf.provider_candidate_id,decision:"COMPILE",outputs:{code:{op:"LOOKUP",map_path:"supportedCurrenciesMap",key:{op:"INPUT",name:"currency_id"},value_path:"currencyCode"},name:{op:"LOOKUP",map_path:"supportedCurrenciesMap",key:{op:"INPUT",name:"currency_id"},value_path:"currencyName"}},evidence_ids:cf.evidence.map(e=>e.evidence_id),reason:"grounded"};
 c.push(mustReject("lookup_ungrounded_map_path","validateDecision",()=>validateDecision({...cfBase,outputs:{...cfBase.outputs,name:{op:"LOOKUP",map_path:"madeupMap",key:{op:"INPUT",name:"currency_id"},value_path:"currencyName"}}},cf)));
 c.push(mustReject("lookup_ungrounded_value_path","validateDecision",()=>validateDecision({...cfBase,outputs:{...cfBase.outputs,name:{op:"LOOKUP",map_path:"supportedCurrenciesMap",key:{op:"INPUT",name:"currency_id"},value_path:"madeup"}}},cf)));
 const findCase:Frozen3xCase={...cf,evidence:[{evidence_id:"find-e",text:"currencies code name"}]};const findBase={case_id:findCase.case_id,provider_candidate_id:findCase.provider_candidate_id,decision:"COMPILE",outputs:{code:{op:"FIND",array_path:"currencies",where_path:"code",equals:{op:"INPUT",name:"currency_id"},value_path:"code"},name:{op:"FIND",array_path:"currencies",where_path:"code",equals:{op:"INPUT",name:"currency_id"},value_path:"name"}},evidence_ids:["find-e"],reason:"x"};
 c.push(mustReject("find_ungrounded_array_path","validateDecision",()=>validateDecision({...findBase,outputs:{...findBase.outputs,name:{op:"FIND",array_path:"madeup",where_path:"code",equals:{op:"INPUT",name:"currency_id"},value_path:"name"}}},findCase)));
 c.push(mustReject("find_ungrounded_where_path","validateDecision",()=>validateDecision({...findBase,outputs:{...findBase.outputs,name:{op:"FIND",array_path:"currencies",where_path:"madeup",equals:{op:"INPUT",name:"currency_id"},value_path:"name"}}},findCase)));
 c.push(mustReject("find_ungrounded_value_path","validateDecision",()=>validateDecision({...findBase,outputs:{...findBase.outputs,name:{op:"FIND",array_path:"currencies",where_path:"code",equals:{op:"INPUT",name:"currency_id"},value_path:"madeup"}}},findCase)));
 c.push(mustReject("expression_depth_exceeded","validateDecision",()=>validateDecision(badExpr("name",{op:"LOOKUP",map_path:"currency",key:{op:"EVAL",name:"currency_id",nested:{op:"INPUT",name:"currency_id"}},value_path:"code"}),nbp)));
 c.push(mustReject("path_segment_limit_exceeded","validateDecision",()=>validateDecision(badExpr("name",{op:"FIELD",path:Array(13).fill("currency").join(".")}),nbp)));
 const huge={currencies:Array.from({length:MAX_FIND_ITEMS+1},(_,i)=>({code:String(i),name:String(i)}))};const expr:ProjectionExpr={op:"FIND",array_path:"currencies",where_path:"code",equals:{op:"LITERAL",value:"USD"},value_path:"name"};c.push(mustReject("find_scan_bound_exceeded","executeExpr",()=>executeExpr(expr,huge,{})));
 c.push(mustReject("arbitrary_url_field","validateDecision",()=>validateDecision({...base,url:"https://evil.example"},nbp)));
 c.push(mustReject("authorization_header_field","validateDecision",()=>validateDecision({...base,headers:{Authorization:"Bearer x"}},nbp)));
 c.push(mustReject("executable_code_field","validateDecision",()=>validateDecision({...base,script:"return fetch('x')"},nbp)));
 const safety:SafetyEvent[]=[];c.push(mustReject("credential_bearing_request_template","validateRequestTemplate",()=>validateRequestTemplate(nbp,{...nbp.request!,base_url:"https://user:pass@api.nbp.pl"},safety)));
 c.push(mustReject("non_https_request_template","validateRequestTemplate",()=>validateRequestTemplate(nbp,{...nbp.request!,base_url:"http://api.nbp.pl"},safety)));
 c.push(mustReject("replay_external_call_delta","enforceReplayDeltas",()=>enforceReplayDeltas({documentation_fetches:0,provider_selection_calls:0,compiler_calls:1,repairs:0,projection_inductions:0},safety)));
 if(c.length!==24)throw new Error(`control_count:${c.length}`);return {controls:c,safety};}
