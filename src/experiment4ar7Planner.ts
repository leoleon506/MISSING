import type {Config} from "./config/index.js";
import type {Provider4A} from "./experiment4aContract.js";
import type {DocEvidence} from "./experiment3wCore.js";
import {FOUR_A_CASES} from "./experiment4aCore.js";
import {buildProofGraphR7} from "./experiment4ar7Graph.js";
import {materializeSelectionR7} from "./experiment4ar7Core.js";
import type {R7Feasibility,R7ProofGraph,R7SemanticSelection} from "./experiment4ar7Model.js";

const BY_ID=Object.fromEntries(FOUR_A_CASES.map(value=>[value.case_id,value]));

function publicOperation(row:R7Feasibility){
  const operation=row.operation;
  return {
    operation_id:operation.id,
    origin:operation.origin,
    full_path:operation.full_path,
    proof_type:operation.proof_type,
    response_join:operation.response_join,
    namespace:operation.namespace,
    mechanical_score:operation.mechanical_score,
    parameters:operation.parameter_slots.map(slot=>({
      parameter_id:slot.id,
      name:slot.name,
      in:slot.in,
      required:slot.required,
      literals:slot.literals
    })),
    response_fields:operation.response_slots.map(slot=>({field_id:slot.id,path:slot.path,leaf:slot.leaf})),
    candidate_parameters_by_input:row.candidate_parameters_by_input,
    candidate_sources_by_output:row.candidate_sources_by_output,
    deterministic_input_bindings:row.deterministic_input_bindings,
    deterministic_output_bindings:row.deterministic_output_bindings,
    deterministic_literal_bindings:row.deterministic_literal_bindings,
    evidence_ids:operation.evidence_ids,
    source_urls:operation.source_urls
  };
}

function selectionSchema(graph:R7ProofGraph,inputNames:string[],required:string[]){
  const rows=graph.feasible_operations;
  const operationIds=rows.map(row=>row.operation.id);
  const parameterIds=[...new Set(rows.flatMap(row=>row.operation.parameter_slots.filter(slot=>!slot.auth_like).map(slot=>slot.id)))];
  const literalIds=[...new Set(rows.flatMap(row=>row.operation.parameter_slots.flatMap(slot=>slot.literals.map(literal=>literal.id))))];
  const sourceIds=[...new Set([
    ...rows.flatMap(row=>row.operation.response_slots.map(slot=>slot.id)),
    ...inputNames.map(input=>`TASK_INPUT:${input}`)
  ])];
  return {
    name:"missing_4ar7_semantic_selection",
    strict:true,
    schema:{
      type:"object",additionalProperties:false,
      properties:{
        decision:{type:"string",enum:["SELECT","REJECT"]},
        operation_id:{type:"string",enum:operationIds},
        input_bindings:{type:"array",minItems:inputNames.length,maxItems:inputNames.length,items:{type:"object",additionalProperties:false,properties:{task_input:{type:"string",enum:inputNames},parameter_id:{type:"string",enum:parameterIds}},required:["task_input","parameter_id"]}},
        literal_bindings:{type:"array",maxItems:Math.max(0,parameterIds.length),items:{type:"object",additionalProperties:false,properties:{parameter_id:{type:"string",enum:parameterIds},literal_id:{type:"string",enum:literalIds.length?literalIds:["NO_LITERAL_AVAILABLE"]}},required:["parameter_id","literal_id"]}},
        output_bindings:{type:"array",minItems:required.length,maxItems:required.length,items:{type:"object",additionalProperties:false,properties:{task_output:{type:"string",enum:required},source_id:{type:"string",enum:sourceIds}},required:["task_output","source_id"]}},
        reason:{type:"string"}
      },
      required:["decision","operation_id","input_bindings","literal_bindings","output_bindings","reason"]
    }
  };
}

function deterministicSelection(graph:R7ProofGraph,inputNames:string[],required:string[]):R7SemanticSelection|null{
  for(const row of graph.feasible_operations){
    if(inputNames.some(input=>!row.deterministic_input_bindings[input]))continue;
    if(required.some(output=>!row.deterministic_output_bindings[output]))continue;
    const parameterIds=Object.values(row.deterministic_input_bindings);
    if(new Set(parameterIds).size!==parameterIds.length)continue;
    const outputIds=Object.values(row.deterministic_output_bindings).filter(value=>!value.startsWith("TASK_INPUT:"));
    if(new Set(outputIds).size!==outputIds.length)continue;
    const requiredParams=row.operation.parameter_slots.filter(slot=>slot.required&&!slot.auth_like);
    const satisfied=new Set([...parameterIds,...Object.keys(row.deterministic_literal_bindings)]);
    if(requiredParams.some(slot=>!satisfied.has(slot.id)))continue;
    return {
      decision:"SELECT",
      operation_id:row.operation.id,
      input_bindings:inputNames.map(task_input=>({task_input,parameter_id:row.deterministic_input_bindings[task_input]})),
      literal_bindings:Object.entries(row.deterministic_literal_bindings).map(([parameter_id,literal_id])=>({parameter_id,literal_id})),
      output_bindings:required.map(task_output=>({task_output,source_id:row.deterministic_output_bindings[task_output]})),
      reason:"R7_DETERMINISTIC_UNAMBIGUOUS_MAPPING"
    };
  }
  return null;
}

async function callStructured(config:Config,system:string,payload:any,jsonSchema:any){
  const started=Date.now();
  const response=await fetch(`${config.baseUrl.replace(/\/$/,"")}/chat/completions`,{
    method:"POST",
    headers:{authorization:`Bearer ${config.apiKey}`,"content-type":"application/json"},
    body:JSON.stringify({
      model:config.model,
      temperature:0,
      messages:[{role:"system",content:system},{role:"user",content:JSON.stringify(payload)}],
      response_format:{type:"json_schema",json_schema:jsonSchema}
    })
  });
  const latency_ms=Date.now()-started,text=await response.text();
  let body:any=null;
  try{body=JSON.parse(text);}catch{}
  const message=body?.choices?.[0]?.message;
  return {status:response.status,ok:response.ok,latency_ms,usage:body?.usage??null,raw:message?.content??null,refusal:message?.refusal??null};
}

function parseSelection(raw:any):R7SemanticSelection{
  if(typeof raw!=="string")throw new Error("r7_planner_missing_content");
  const value=JSON.parse(raw);
  return {
    decision:value.decision,
    operation_id:String(value.operation_id),
    input_bindings:(value.input_bindings||[]).map((row:any)=>({task_input:String(row.task_input),parameter_id:String(row.parameter_id)})),
    literal_bindings:(value.literal_bindings||[]).map((row:any)=>({parameter_id:String(row.parameter_id),literal_id:String(row.literal_id)})),
    output_bindings:(value.output_bindings||[]).map((row:any)=>({task_output:String(row.task_output),source_id:String(row.source_id)})),
    reason:String(value.reason||"")
  };
}

function priorOperationId(previousError?:string){
  return String(previousError||"").match(/r7_selected_operation_id=([A-Za-z0-9_-]+)/)?.[1]||null;
}

function graphAttribution(graph:R7ProofGraph){
  return {
    proof_graph_fingerprint:graph.fingerprint,
    proof_graph_node_counts:graph.node_counts,
    proof_graph_edge_counts:graph.edge_counts,
    response_join_counts:graph.response_join_counts,
    operation_count:graph.operations.length,
    mechanically_feasible_operation_count:graph.feasibility.filter(row=>row.feasible).length,
    mechanically_infeasible_operation_count:graph.feasibility.filter(row=>!row.feasible).length,
    infeasibility_reason_counts:graph.infeasibility_reason_counts,
    feasible_operations:graph.feasible_operations.map(publicOperation),
    no_numeric_indices:true
  };
}

export async function synthesize4ar7(config:Config,provider:Provider4A,evidence:DocEvidence[],phase:"initial"|"repair",previousError?:string){
  const c=BY_ID[provider.case_id];
  if(!c)throw new Error(`r7_unknown_case:${provider.case_id}`);
  const graph=buildProofGraphR7(evidence,provider.case_id);
  const attribution=graphAttribution(graph);
  let eligible=graph.feasible_operations;
  const prior=priorOperationId(previousError);
  if(phase==="repair"){
    if(!prior)return {phase,http_status:0,http_ok:true,refusal:null,raw_content:null,parsed_json:{case_id:provider.case_id,provider_candidate_id:provider.candidate_id,decision:"REJECT",reason:"R7_REPAIR_WITHOUT_OPERATION"},parse_error:null,usage:null,latency_ms:0,...attribution,semantic_selection:null,operation_proof:null,planner_skipped:true};
    eligible=eligible.filter(row=>row.operation.id===prior);
    if(!eligible.length)return {phase,http_status:0,http_ok:true,refusal:null,raw_content:null,parsed_json:{case_id:provider.case_id,provider_candidate_id:provider.candidate_id,decision:"REJECT",reason:"R7_REPAIR_OPERATION_NOT_FEASIBLE"},parse_error:null,usage:null,latency_ms:0,...attribution,semantic_selection:null,operation_proof:null,planner_skipped:true};
  }
  if(!eligible.length){
    return {phase,http_status:0,http_ok:true,refusal:null,raw_content:null,parsed_json:{case_id:provider.case_id,provider_candidate_id:provider.candidate_id,decision:"REJECT",reason:"R7_NO_MECHANICALLY_FEASIBLE_OPERATION"},parse_error:null,usage:null,latency_ms:0,...attribution,semantic_selection:null,operation_proof:null,planner_skipped:true};
  }

  const narrowedGraph={...graph,feasible_operations:eligible};
  if(phase==="initial"){
    const deterministic=deterministicSelection(narrowedGraph,[...c.input_names],[...c.required]);
    if(deterministic){
      try{
        const materialized=materializeSelectionR7(provider.case_id,provider.candidate_id,narrowedGraph,deterministic);
        return {phase,http_status:0,http_ok:true,refusal:null,raw_content:null,parsed_json:materialized.raw,parse_error:null,usage:null,latency_ms:0,...attribution,semantic_selection:deterministic,operation_proof:materialized.proof,planner_skipped:true,deterministic_mapping:true};
      }catch{}
    }
  }

  const call=await callStructured(config,[
    "You are MISSING's semantic matcher over an already mechanically validated proof graph.",
    "Mechanical feasibility has already been decided. You may only select from the exact stable IDs supplied.",
    "Never invent or rewrite a URL, path, parameter name, response path, literal, origin, namespace, or identifier.",
    "There are no numeric positions. Choose parameter_id and source_id by their exact names and paths.",
    "Every task input must bind exactly once to a request parameter of the selected operation.",
    "Every required output must bind exactly once to a proven response field or an explicitly offered TASK_INPUT source.",
    "Use literal IDs only when the selected operation requires or clearly documents that literal.",
    "If semantic correspondence is not defensible from the supplied names, paths, case intent, and evidence metadata, REJECT."
  ].join(" "),{
    case:{case_id:provider.case_id,intent:c.intent,input_names:c.input_names,required_outputs:c.required,build_input:c.build,replay_input:c.replay},
    provider:{candidate_id:provider.candidate_id,name:provider.name},
    mechanically_feasible_operations:eligible.map(publicOperation),
    phase,
    previous_validation_error:previousError??null
  },selectionSchema(narrowedGraph,[...c.input_names],[...c.required]));

  let selection:R7SemanticSelection|null=null,parsed_json:any=null,proof:any=null,parse_error:string|null=null;
  try{
    selection=parseSelection(call.raw);
    if(selection.decision==="REJECT"){
      parsed_json={case_id:provider.case_id,provider_candidate_id:provider.candidate_id,decision:"REJECT",reason:`R7_SEMANTIC_REJECT:${selection.reason}`};
    }else{
      const materialized=materializeSelectionR7(provider.case_id,provider.candidate_id,narrowedGraph,selection);
      parsed_json=materialized.raw;
      proof=materialized.proof;
    }
  }catch(error){
    const operationId=selection?.operation_id||eligible[0]?.operation.id||"unknown";
    parse_error=`r7_selected_operation_id=${operationId}|${String(error).replace(/^Error:\s*/,"")}`;
  }
  return {phase,http_status:call.status,http_ok:call.ok,refusal:call.refusal,raw_content:call.raw,parsed_json,parse_error,usage:call.usage,latency_ms:call.latency_ms,...attribution,semantic_selection:selection,operation_proof:proof,planner_skipped:false,deterministic_mapping:false};
}
