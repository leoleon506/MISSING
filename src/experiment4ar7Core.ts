import type {MicroContract} from "./experiment3wCore.js";
import {FOUR_A_CASES} from "./experiment4aCore.js";
import type {ProjectionPlan} from "./experiment4arCore.js";
import type {R7ProofGraph,R7SemanticSelection} from "./experiment4ar7Model.js";

export * from "./experiment4ar7Model.js";
export {buildProofGraphR7,lexicalTokensR7} from "./experiment4ar7Graph.js";

export function materializeSelectionR7(caseId:string,providerId:string,graph:R7ProofGraph,selection:R7SemanticSelection){
  const c=FOUR_A_CASES.find(value=>value.case_id===caseId);
  if(!c)throw new Error("r7_unknown_case");
  if(selection.decision!=="SELECT")throw new Error("r7_selection_not_select");
  const feasible=graph.feasible_operations.find(row=>row.operation.id===selection.operation_id);
  if(!feasible)throw new Error("r7_operation_not_mechanically_feasible");
  const operation=feasible.operation;

  const inputBindings:Record<string,string>={};
  const usedParameters=new Set<string>();
  for(const binding of selection.input_bindings){
    if(!c.input_names.includes(binding.task_input))throw new Error(`r7_invalid_task_input:${binding.task_input}`);
    if(inputBindings[binding.task_input]!==undefined)throw new Error(`r7_duplicate_task_input:${binding.task_input}`);
    if(!feasible.candidate_parameters_by_input[binding.task_input]?.includes(binding.parameter_id))throw new Error(`r7_parameter_not_candidate:${binding.task_input}`);
    const slot=operation.parameter_slots.find(value=>value.id===binding.parameter_id);
    if(!slot||slot.auth_like)throw new Error(`r7_parameter_invalid:${binding.parameter_id}`);
    if(usedParameters.has(slot.id))throw new Error(`r7_parameter_reused:${slot.name}`);
    usedParameters.add(slot.id);
    inputBindings[binding.task_input]=slot.id;
  }
  for(const input of c.input_names)if(!inputBindings[input])throw new Error(`r7_missing_input_influence:${input}`);

  const literalBindings=new Map<string,string>();
  for(const binding of selection.literal_bindings){
    const slot=operation.parameter_slots.find(value=>value.id===binding.parameter_id);
    if(!slot||slot.auth_like||slot.in!=="query")throw new Error(`r7_literal_parameter_invalid:${binding.parameter_id}`);
    const literal=slot.literals.find(value=>value.id===binding.literal_id);
    if(!literal)throw new Error(`r7_literal_not_proven:${binding.literal_id}`);
    if(usedParameters.has(slot.id))throw new Error(`r7_parameter_double_bound:${slot.name}`);
    literalBindings.set(slot.id,literal.id);
  }
  for(const [parameterId,literalId] of Object.entries(feasible.deterministic_literal_bindings)){
    if(!usedParameters.has(parameterId)&&!literalBindings.has(parameterId))literalBindings.set(parameterId,literalId);
  }

  for(const slot of operation.parameter_slots.filter(value=>value.required)){
    if(slot.auth_like)throw new Error(`r7_required_auth_parameter:${slot.name}`);
    if(!usedParameters.has(slot.id)&&!literalBindings.has(slot.id))throw new Error(`r7_required_parameter_unbound:${slot.name}`);
  }

  const projection:ProjectionPlan={};
  const outputSeen=new Set<string>();
  const usedFieldSources=new Set<string>();
  for(const binding of selection.output_bindings){
    if(!c.required.includes(binding.task_output))throw new Error(`r7_invalid_task_output:${binding.task_output}`);
    if(outputSeen.has(binding.task_output))throw new Error(`r7_duplicate_task_output:${binding.task_output}`);
    outputSeen.add(binding.task_output);
    if(!feasible.candidate_sources_by_output[binding.task_output]?.includes(binding.source_id))throw new Error(`r7_output_source_not_candidate:${binding.task_output}`);
    if(binding.source_id.startsWith("TASK_INPUT:")){
      const input=binding.source_id.slice("TASK_INPUT:".length);
      if(!c.input_names.includes(input))throw new Error(`r7_output_input_invalid:${input}`);
      projection[binding.task_output]={op:"INPUT",name:input} as any;
    }else{
      const field=operation.response_slots.find(value=>value.id===binding.source_id);
      if(!field)throw new Error(`r7_response_field_invalid:${binding.source_id}`);
      if(usedFieldSources.has(field.id))throw new Error(`r7_response_field_reused:${field.path}`);
      usedFieldSources.add(field.id);
      projection[binding.task_output]={op:"FIELD",path:field.path} as any;
    }
  }
  for(const output of c.required)if(!outputSeen.has(output))throw new Error(`r7_missing_output:${output}`);

  const path_bindings:Record<string,string>={},query_bindings:Record<string,string>={};
  for(const [taskInput,parameterId] of Object.entries(inputBindings)){
    const slot=operation.parameter_slots.find(value=>value.id===parameterId)!;
    const target=slot.in==="path"?path_bindings:query_bindings;
    target[slot.name]=`$input.${taskInput}`;
  }
  for(const [parameterId,literalId] of literalBindings){
    const slot=operation.parameter_slots.find(value=>value.id===parameterId)!;
    const literal=slot.literals.find(value=>value.id===literalId)!;
    query_bindings[slot.name]=literal.value;
  }

  const raw:any={
    case_id:caseId,
    provider_candidate_id:providerId,
    decision:"COMPILE",
    method:"GET",
    base_url:operation.origin,
    path_template:operation.full_path,
    path_bindings,
    query_bindings,
    evidence_ids:operation.evidence_ids,
    reason:`R7_OPERATION:${operation.id}`,
    projection
  };
  return {
    raw,
    proof:{
      graph_fingerprint:graph.fingerprint,
      operation_id:operation.id,
      operation_feasible:true,
      feasibility_reasons:feasible.reasons,
      proof_type:operation.proof_type,
      response_join:operation.response_join,
      evidence_ids:operation.evidence_ids,
      source_urls:operation.source_urls,
      origin:operation.origin,
      full_path:operation.full_path,
      input_bindings:inputBindings,
      literal_bindings:Object.fromEntries(literalBindings),
      output_bindings:Object.fromEntries(selection.output_bindings.map(value=>[value.task_output,value.source_id])),
      no_numeric_indices:true,
      input_influence_complete:true
    }
  };
}

export function contractFromR7Raw(raw:any):MicroContract{
  return {
    case_id:raw.case_id,
    provider_candidate_id:raw.provider_candidate_id,
    decision:raw.decision,
    method:raw.method,
    base_url:raw.base_url,
    path_template:raw.path_template,
    path_bindings:raw.path_bindings,
    query_bindings:raw.query_bindings,
    evidence_ids:raw.evidence_ids,
    reason:raw.reason
  };
}
