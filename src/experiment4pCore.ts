import {FOUR_A_CASES} from "./experiment4aCore.js";
import type {P1ProbeProof,P1RequestHypothesis} from "./experiment4ap1Model.js";
import {identityCompatible4O,uniqueRowLookup4O,validateRowLookupObserved4O,type RelationalSummary4O} from "./experiment4oRelational.js";
import type {ProjectionPlan} from "./experiment4arCore.js";

export function allowedInputSources4P(output:string,inputs:readonly string[]){return inputs.filter(input=>identityCompatible4O(output,input))}
export function deterministicProjection4P(proof:P1ProbeProof,summary:RelationalSummary4O|null,inputs:readonly string[],required:readonly string[]){
  (proof as any).relational_summary=summary;const projection:ProjectionPlan={},used=new Set<string>();let rowLookups=0;
  for(const output of required){
    const inputMatches=allowedInputSources4P(output,inputs),outTokens=new Set(output.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)),fieldMatches=proof.record.observed_fields.filter(f=>(f.tokens||[]).some(t=>outTokens.has(t)));
    if(inputMatches.length===1&&fieldMatches.length===0){projection[output]={op:"INPUT",name:inputMatches[0]} as any;continue}
    if(inputMatches.length===0&&fieldMatches.length===1&&!used.has(fieldMatches[0].id)){used.add(fieldMatches[0].id);projection[output]={op:"FIELD",path:fieldMatches[0].path} as any;continue}
    const row=summary?uniqueRowLookup4O(summary,output):null;if(row&&validateRowLookupObserved4O(row.expr,summary!)){projection[output]=row.expr as any;rowLookups++;continue}
    if(inputMatches.length===1&&fieldMatches.length===1&&fieldMatches[0].build_value_relations.some(r=>r.startsWith(`TASK_INPUT:${inputMatches[0]}:`))){projection[output]={op:"INPUT",name:inputMatches[0]} as any;continue}
    return null;
  }
  return {projection,rowLookups};
}
export function materialize4P(caseId:string,providerId:string,proof:P1ProbeProof,projection:ProjectionPlan,summary:RelationalSummary4O|null=null){
  const c=FOUR_A_CASES.find(x=>x.case_id===caseId);if(!c)throw new Error("4p_unknown_case");summary=summary||((proof as any).relational_summary??null);const h=proof.hypothesis as P1RequestHypothesis,bySlot=new Map(h.slots.map(s=>[s.id,s])),path_bindings:Record<string,string>={},query_bindings:Record<string,string>={};
  for(const [inputName,slotId] of Object.entries(h.input_bindings)){if(!c.input_names.includes(inputName))throw new Error(`4p_unknown_task_input:${inputName}`);const slot=bySlot.get(slotId);if(!slot||slot.auth_like)throw new Error(`4p_invalid_request_slot:${slotId}`);(slot.in==="path"?path_bindings:query_bindings)[slot.name]=`$input.${inputName}`}
  for(const [slotId,literalId] of Object.entries(h.literal_bindings)){const slot=bySlot.get(slotId),literal=slot?.literals.find(x=>x.id===literalId);if(!slot||!literal||slot.auth_like)throw new Error("4p_literal_proof_missing");query_bindings[slot.name]=literal.value}
  const relational_proof=summary?{row_sets:summary.row_sets,metrics:summary.metrics}:null,raw:any={case_id:caseId,provider_candidate_id:providerId,decision:"COMPILE",method:"GET",base_url:h.origin,path_template:h.full_path,path_bindings,query_bindings,evidence_ids:h.evidence_ids,reason:`4P_PROJECTION_COMPATIBILITY:${h.id}`,projection,relational_proof,probe_schema_fingerprint:proof.record.schema_fingerprint,probe_body_fingerprint:proof.record.response_body_fingerprint};
  return {raw,projection,proof:{hypothesis_id:h.id,request_proof_type:h.proof_type,evidence_ids:h.evidence_ids,source_urls:h.source_urls,request_score:h.score,concrete_relation:h.concrete_relation,probe_requested_at:proof.record.requested_at,probe_final_url:proof.record.final_url,probe_body_fingerprint:proof.record.response_body_fingerprint,probe_schema_fingerprint:proof.record.schema_fingerprint,observed_path_count:proof.record.observed_path_count,selected_output_bindings:Object.fromEntries(Object.entries(projection).map(([k,v])=>[k,v.op])),relational_proof,no_numeric_row_lookup_indices:!Object.values(projection).some((e:any)=>e?.op==="ROW_LOOKUP"&&[e.array_path,e.label_field,e.value_field].some((p:string)=>/(^|\.)\d+(\.|$)/.test(String(p||"")))),input_influence_complete:true}};
}
