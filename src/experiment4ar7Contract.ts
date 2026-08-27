import {isIP} from "node:net";
import type {DocEvidence,MicroContract} from "./experiment3wCore.js";
import {compileMicroRequest} from "./experiment3wCore.js";
import type {RecoveryLedger} from "./experiment3yrCore.js";
import type {Provider4A} from "./experiment4aContract.js";
import {FOUR_A_CASES,semanticValidate4a} from "./experiment4aCore.js";
import type {ProjectionPlan} from "./experiment4arCore.js";
import {executeProgram} from "./experiment3xCore.js";
import {scope4ar4} from "./experiment4ar4Contract.js";
import {buildProofGraphR7} from "./experiment4ar7Graph.js";
import {contractFromR7Raw} from "./experiment4ar7Core.js";

const BY_ID=Object.fromEntries(FOUR_A_CASES.map(value=>[value.case_id,value]));
const inputKey=(value:string)=>value.startsWith("$input.")?value.slice(7):null;

export function validate4ar7(raw:any,provider:Provider4A,evidence:DocEvidence[],ledger:RecoveryLedger){
  const c=BY_ID[provider.case_id],errors:string[]=[];
  if(!c)return {errors:["unknown_case"],contract:null as any,projection:null as any,operation_proof:null};
  if(!raw||typeof raw!=="object"||Array.isArray(raw))return {errors:["contract_not_object"],contract:null as any,projection:null as any,operation_proof:null};
  if(raw.case_id!==provider.case_id)errors.push("case_id_mismatch");
  if(raw.provider_candidate_id!==provider.candidate_id)errors.push("provider_id_mismatch");
  if(raw.decision==="REJECT")return {errors,contract:contractFromR7Raw(raw),projection:null,operation_proof:null};
  if(raw.decision!=="COMPILE")return {errors:[...errors,"decision_invalid"],contract:null,projection:null,operation_proof:null};

  const graph=buildProofGraphR7(evidence,provider.case_id);
  const operationId=String(raw.reason||"").startsWith("R7_OPERATION:")?String(raw.reason).slice("R7_OPERATION:".length):"";
  const feasible=graph.feasible_operations.find(row=>row.operation.id===operationId);
  if(!feasible){
    errors.push("r7_operation_not_mechanically_feasible");
    ledger.record("guard","endpoint_mutations",false,{operationId});
    return {errors,contract:null,projection:null,operation_proof:null};
  }
  const operation=feasible.operation;

  if(raw.method!=="GET"){
    errors.push("method_not_get");
    ledger.record("guard","non_get",false,raw.method);
  }
  try{
    const url=new URL(String(raw.base_url||""));
    if(url.protocol!=="https:"){
      errors.push("base_non_https");
      ledger.record("guard","non_https",false,url.toString());
    }
    if(url.username||url.password)errors.push("credential_bearing_base");
    if(isIP(url.hostname)){
      errors.push("base_ip_literal");
      ledger.record("guard","private_hosts",false,url.hostname);
    }
    if(url.origin!==operation.origin){
      errors.push("r7_origin_not_proven");
      ledger.record("guard","endpoint_mutations",false,{got:url.origin,expected:operation.origin});
    }
  }catch{errors.push("invalid_base_url");}
  if(raw.path_template!==operation.full_path){
    errors.push("r7_path_not_proven");
    ledger.record("guard","endpoint_mutations",false,{got:raw.path_template,expected:operation.full_path});
  }

  const evidenceById=new Map(evidence.map(value=>[value.evidence_id,value]));
  for(const id of operation.evidence_ids){
    const item=evidenceById.get(id);
    if(!item||item.provider_candidate_id!==provider.candidate_id||item.state!=="ok")errors.push(`r7_invalid_proof_evidence:${id}`);
  }

  const pathBindings=raw.path_bindings&&typeof raw.path_bindings==="object"&&!Array.isArray(raw.path_bindings)?raw.path_bindings:{};
  const queryBindings=raw.query_bindings&&typeof raw.query_bindings==="object"&&!Array.isArray(raw.query_bindings)?raw.query_bindings:{};
  const usedInputs=new Set<string>();

  for(const [name,value0] of Object.entries(pathBindings)){
    const slot=operation.parameter_slots.find(item=>item.in==="path"&&item.name===name);
    if(!slot){
      errors.push(`r7_undocumented_path_parameter:${name}`);
      ledger.record("guard","invented_parameters",false,name);
      continue;
    }
    const key=inputKey(String(value0));
    if(!key||!c.input_names.includes(key)){
      errors.push(`r7_invalid_path_input:${name}`);
      ledger.record("guard","invented_parameters",false,{name,value:value0});
    }else usedInputs.add(key);
  }

  for(const [name,value0] of Object.entries(queryBindings)){
    const slot=operation.parameter_slots.find(item=>item.in==="query"&&item.name===name);
    if(!slot){
      errors.push(`r7_undocumented_query_parameter:${name}`);
      ledger.record("guard","invented_parameters",false,name);
      continue;
    }
    if(slot.auth_like){
      errors.push(`r7_auth_parameter_forbidden:${name}`);
      ledger.record("guard","invented_parameters",false,name);
      continue;
    }
    const value=String(value0),key=inputKey(value);
    if(key){
      if(!c.input_names.includes(key)){
        errors.push(`r7_invalid_query_input:${name}`);
        ledger.record("guard","invented_parameters",false,{name,value});
      }else usedInputs.add(key);
    }else if(!slot.literals.some(literal=>literal.value===value)){
      errors.push(`r7_unproven_query_literal:${name}`);
      ledger.record("guard","invented_parameters",false,{name,value});
    }
  }

  for(const input of c.input_names){
    if(!usedInputs.has(input)){
      errors.push(`r7_missing_input_influence:${input}`);
      ledger.record("guard","invented_parameters",false,{missing_input:input});
    }
  }
  for(const slot of operation.parameter_slots.filter(value=>value.required)){
    const bound=slot.in==="path"?pathBindings[slot.name]!==undefined:queryBindings[slot.name]!==undefined;
    if(!bound)errors.push(`r7_required_parameter_unbound:${slot.name}`);
  }

  const plan=raw.projection as ProjectionPlan;
  if(!plan||typeof plan!=="object"||Array.isArray(plan))errors.push("projection_plan_invalid");
  else{
    const keys=Object.keys(plan).sort(),required=[...c.required].sort();
    if(keys.length!==required.length||keys.some((key,index)=>key!==required[index]))errors.push("projection_keys_mismatch");
    const usedFields=new Set<string>();
    for(const output of c.required){
      const value:any=(plan as any)[output];
      if(!value){errors.push(`projection_missing:${output}`);continue;}
      if(value.op==="INPUT"){
        if(!c.input_names.includes(value.name)){
          errors.push(`projection_input_invalid:${output}`);
          ledger.record("guard","ungrounded_projection_fields",false,value.name);
        }
      }else if(value.op==="FIELD"){
        if(!operation.response_slots.some(field=>field.path===value.path)){
          errors.push(`r7_response_path_not_proven:${output}:${value.path}`);
          ledger.record("guard","ungrounded_projection_fields",false,value.path);
        }else if(usedFields.has(value.path)){
          errors.push(`r7_response_path_reused:${value.path}`);
        }else usedFields.add(value.path);
      }else{
        errors.push(`r7_projection_op_forbidden:${output}`);
        ledger.record("guard","ungrounded_projection_fields",false,value.op);
      }
    }
  }

  if(errors.length)errors.push(`r7_selected_operation_id=${operation.id}`);
  const contract:MicroContract=contractFromR7Raw(raw);
  return {
    errors,
    contract,
    projection:errors.length?null:plan,
    operation_proof:{
      graph_fingerprint:graph.fingerprint,
      operation_id:operation.id,
      mechanically_feasible:true,
      no_numeric_indices:true,
      input_influence_complete:c.input_names.every(input=>usedInputs.has(input)),
      proof_type:operation.proof_type,
      response_join:operation.response_join,
      evidence_ids:operation.evidence_ids,
      source_urls:operation.source_urls,
      origin:operation.origin,
      full_path:operation.full_path
    }
  };
}

export function compile4ar7(contract:MicroContract,input:Record<string,unknown>){return compileMicroRequest(contract,input);}
export function project4ar7(plan:ProjectionPlan,body:any,input:Record<string,unknown>){return executeProgram(plan,body,input) as Record<string,any>;}
export function validateProjected4ar7(caseId:string,input:Record<string,any>,out:Record<string,any>){return semanticValidate4a(caseId,input,out);}
export function scope4ar7(start:string,target:string){return scope4ar4(start,target);}
