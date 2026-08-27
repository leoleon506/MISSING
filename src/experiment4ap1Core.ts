import type {MicroContract} from "./experiment3wCore.js";
import {FOUR_A_CASES} from "./experiment4aCore.js";
import type {ProjectionPlan} from "./experiment4arCore.js";
import type {P1ProbeProof,P1SemanticSelection} from "./experiment4ap1Model.js";

export * from "./experiment4ap1Model.js";
export {buildRequestHypothesesP1,compileRequestHypothesisP1,lexicalTokensP1} from "./experiment4ap1Request.js";
export {probeHypothesisP1} from "./experiment4ap1Probe.js";

export function materializeSelectionP1(caseId:string,providerId:string,proof:P1ProbeProof,selection:P1SemanticSelection){
  const c=FOUR_A_CASES.find(row=>row.case_id===caseId);if(!c)throw new Error("p1_unknown_case");
  if(selection.decision!=="SELECT")throw new Error("p1_selection_not_select");
  if(selection.hypothesis_id!==proof.hypothesis.id)throw new Error("p1_hypothesis_mismatch");
  if(proof.record.disposition!=="success"||!proof.record.schema_fingerprint||!proof.record.response_body_fingerprint)throw new Error("p1_probe_not_successful");
  const hypothesis=proof.hypothesis,bySlot=new Map(hypothesis.slots.map(slot=>[slot.id,slot]));
  const path_bindings:Record<string,string>={},query_bindings:Record<string,string>={};
  for(const [inputName,slotId] of Object.entries(hypothesis.input_bindings)){
    if(!c.input_names.includes(inputName))throw new Error(`p1_unknown_task_input:${inputName}`);
    const slot=bySlot.get(slotId);if(!slot||slot.auth_like)throw new Error(`p1_invalid_request_slot:${slotId}`);
    const target=slot.in==="path"?path_bindings:query_bindings;target[slot.name]=`$input.${inputName}`;
  }
  for(const input of c.input_names){if(!Object.keys(hypothesis.input_bindings).includes(input))throw new Error(`p1_missing_input_influence:${input}`);}
  for(const [slotId,literalId] of Object.entries(hypothesis.literal_bindings)){
    const slot=bySlot.get(slotId);if(!slot||slot.in!=="query"||slot.auth_like)throw new Error(`p1_invalid_literal_slot:${slotId}`);
    const literal=slot.literals.find(row=>row.id===literalId);if(!literal)throw new Error(`p1_literal_not_documented:${literalId}`);
    query_bindings[slot.name]=literal.value;
  }
  for(const slot of hypothesis.slots.filter(row=>row.required)){
    const bound=slot.in==="path"?path_bindings[slot.name]!==undefined:query_bindings[slot.name]!==undefined;
    if(!bound)throw new Error(`p1_required_parameter_unbound:${slot.name}`);
  }

  const projection:ProjectionPlan={};const outputs=new Set<string>(),usedFields=new Set<string>();
  for(const binding of selection.output_bindings){
    if(!c.required.includes(binding.task_output))throw new Error(`p1_unknown_output:${binding.task_output}`);
    if(outputs.has(binding.task_output))throw new Error(`p1_duplicate_output:${binding.task_output}`);outputs.add(binding.task_output);
    if(binding.source_id.startsWith("TASK_INPUT:")){
      const input=binding.source_id.slice("TASK_INPUT:".length);if(!c.input_names.includes(input))throw new Error(`p1_invalid_echo:${input}`);
      projection[binding.task_output]={op:"INPUT",name:input} as any;
    }else{
      const field=proof.record.observed_fields.find(row=>row.id===binding.source_id);if(!field)throw new Error(`p1_field_not_observed:${binding.source_id}`);
      if(usedFields.has(field.id))throw new Error(`p1_field_reused:${field.path}`);usedFields.add(field.id);
      projection[binding.task_output]={op:"FIELD",path:field.path} as any;
    }
  }
  for(const output of c.required)if(!outputs.has(output))throw new Error(`p1_missing_output:${output}`);

  const raw:any={case_id:caseId,provider_candidate_id:providerId,decision:"COMPILE",method:"GET",base_url:hypothesis.origin,path_template:hypothesis.full_path,path_bindings,query_bindings,evidence_ids:hypothesis.evidence_ids,reason:`P1_REQUEST:${hypothesis.id}`,projection,probe_schema_fingerprint:proof.record.schema_fingerprint,probe_body_fingerprint:proof.record.response_body_fingerprint};
  return {raw,projection,proof:{hypothesis_id:hypothesis.id,request_proof_type:hypothesis.proof_type,evidence_ids:hypothesis.evidence_ids,source_urls:hypothesis.source_urls,request_score:hypothesis.score,concrete_relation:hypothesis.concrete_relation,probe_requested_at:proof.record.requested_at,probe_final_url:proof.record.final_url,probe_body_fingerprint:proof.record.response_body_fingerprint,probe_schema_fingerprint:proof.record.schema_fingerprint,observed_path_count:proof.record.observed_path_count,selected_output_bindings:Object.fromEntries(selection.output_bindings.map(row=>[row.task_output,row.source_id])),no_numeric_indices:true,input_influence_complete:true}};
}

export function contractFromP1Raw(raw:any):MicroContract{
  return {case_id:raw.case_id,provider_candidate_id:raw.provider_candidate_id,decision:raw.decision,method:raw.method,base_url:raw.base_url,path_template:raw.path_template,path_bindings:raw.path_bindings,query_bindings:raw.query_bindings,evidence_ids:raw.evidence_ids,reason:raw.reason};
}
