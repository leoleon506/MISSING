import type {MicroContract} from "./experiment3wCore.js";
import {FOUR_A_CASES} from "./experiment4aCore.js";
import type {ProjectionPlan} from "./experiment4arCore.js";
import type {R6ROperation,R6RStageB} from "./experiment4ar6rModel.js";

export * from "./experiment4ar6rModel.js";
export {
  canonicalizeEndpointTemplateR6R,
  normalizeOpenApiServersR6R,
  specSummaryR6R,
  extractOperationInventoryR6R
} from "./experiment4ar6rEvidence.js";

export function materializeR6R(caseId:string,providerId:string,operation:R6ROperation,mapping:R6RStageB){
  const c=FOUR_A_CASES.find(value=>value.case_id===caseId);
  if(!c)throw new Error("r6r_unknown_case");
  const pathBindings:Record<string,string>={};
  const queryBindings:Record<string,string>={};

  for(const binding of mapping.path_bindings){
    const parameter=operation.path_parameters[binding.parameter_index];
    if(!parameter)throw new Error(`r6r_selected_operation_id=${operation.operation_id}|path_parameter_index_invalid`);
    if(!c.input_names.includes(binding.input_name))throw new Error(`r6r_selected_operation_id=${operation.operation_id}|path_input_invalid`);
    if(pathBindings[parameter.name]!==undefined)throw new Error(`r6r_selected_operation_id=${operation.operation_id}|duplicate_path_binding`);
    pathBindings[parameter.name]=`$input.${binding.input_name}`;
  }
  for(const parameter of operation.path_parameters){
    if(pathBindings[parameter.name]===undefined)throw new Error(`r6r_selected_operation_id=${operation.operation_id}|unbound_path:${parameter.name}`);
  }

  for(const binding of mapping.query_bindings){
    const parameter=operation.query_parameters[binding.parameter_index];
    if(!parameter)throw new Error(`r6r_selected_operation_id=${operation.operation_id}|query_parameter_index_invalid`);
    if(binding.source_kind==="OMIT"){
      if(parameter.required)throw new Error(`r6r_selected_operation_id=${operation.operation_id}|required_query_omitted:${parameter.name}`);
      continue;
    }
    if(queryBindings[parameter.name]!==undefined)throw new Error(`r6r_selected_operation_id=${operation.operation_id}|duplicate_query_binding`);
    if(binding.source_kind==="INPUT"){
      if(!binding.input_name||!c.input_names.includes(binding.input_name))throw new Error(`r6r_selected_operation_id=${operation.operation_id}|query_input_invalid`);
      queryBindings[parameter.name]=`$input.${binding.input_name}`;
    }else{
      const literal=binding.literal_index===null?undefined:parameter.literals[binding.literal_index];
      if(literal===undefined)throw new Error(`r6r_selected_operation_id=${operation.operation_id}|query_literal_index_invalid`);
      queryBindings[parameter.name]=literal;
    }
  }
  for(const parameter of operation.query_parameters){
    if(parameter.required&&queryBindings[parameter.name]===undefined){
      throw new Error(`r6r_selected_operation_id=${operation.operation_id}|required_query_unbound:${parameter.name}`);
    }
  }

  const projection:ProjectionPlan={};
  const seen=new Set<string>();
  for(const output of mapping.output_mappings){
    if(!c.required.includes(output.output_name)||seen.has(output.output_name)){
      throw new Error(`r6r_selected_operation_id=${operation.operation_id}|output_name_invalid`);
    }
    seen.add(output.output_name);
    if(output.source_kind==="INPUT"){
      if(!output.input_name||!c.input_names.includes(output.input_name)){
        throw new Error(`r6r_selected_operation_id=${operation.operation_id}|output_input_invalid`);
      }
      projection[output.output_name]={op:"INPUT",name:output.input_name} as any;
    }else{
      const path=output.response_path_index===null?undefined:operation.response_paths[output.response_path_index];
      if(!path)throw new Error(`r6r_selected_operation_id=${operation.operation_id}|response_path_index_invalid`);
      projection[output.output_name]={op:"FIELD",path} as any;
    }
  }
  for(const required of c.required){
    if(!seen.has(required))throw new Error(`r6r_selected_operation_id=${operation.operation_id}|missing_output:${required}`);
  }

  const raw:any={
    case_id:caseId,
    provider_candidate_id:providerId,
    decision:"COMPILE",
    method:"GET",
    base_url:operation.origin,
    path_template:operation.full_path,
    path_bindings:pathBindings,
    query_bindings:queryBindings,
    evidence_ids:operation.evidence_ids,
    reason:`R6R_OPERATION:${operation.operation_id}`,
    projection
  };
  return {
    raw,
    proof:{
      operation_id:operation.operation_id,
      proof_type:operation.proof_type,
      evidence_ids:operation.evidence_ids,
      source_urls:operation.source_urls,
      origin:operation.origin,
      full_path:operation.full_path,
      input_mapping:{path:pathBindings,query:queryBindings},
      output_mapping:projection
    }
  };
}

export function contractFromR6RRaw(raw:any):MicroContract{
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
