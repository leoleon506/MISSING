import type {DocEvidence,MicroContract} from "./experiment3wCore.js";
import type {RecoveryLedger} from "./experiment3yrCore.js";
import type {Provider4A} from "./experiment4aContract.js";
import type {ProjectionPlan} from "./experiment4arCore.js";
import type {P1ProbeProof} from "./experiment4ap1Model.js";
import {validate4s,compile4s,project4s,validateProjected4s,scope4s} from "./experiment4sContract.js";
import {verifyFrozenRequestProof4T} from "./experiment4tNativeOperation.js";

const PREFIX="4T_NATIVE_MACHINE_READABLE_OPERATION:";
export function validate4t(raw:any,provider:Provider4A,evidence:DocEvidence[],ledger:RecoveryLedger,probeProof:P1ProbeProof|null){
  const reason=String(raw?.reason||"");if(!reason.startsWith(PREFIX))return validate4s(raw,provider,evidence,ledger,probeProof);
  const errors:string[]=[];let frozenRequestProofValidationSuccesses4t=0,frozenRequestProofMutationRejects4t=0;
  if(!probeProof||probeProof.record.disposition!=="success")return {errors:["4t_missing_successful_probe_proof"],contract:null as any,projection:null as any,probe_proof:null,frozenRequestProofValidationSuccesses4t,frozenRequestProofMutationRejects4t};
  const id=reason.slice(PREFIX.length);if(id!==probeProof.hypothesis.id)errors.push("4t_probe_hypothesis_mismatch");if(probeProof.hypothesis.proof_type!=="4t_linked_native_openapi_operation")errors.push("4t_native_proof_type_invalid");
  if(!verifyFrozenRequestProof4T(probeProof.hypothesis,raw?.frozen_request_proof)){errors.push("4t_frozen_request_proof_mutated");frozenRequestProofMutationRejects4t++;ledger.record("guard","endpoint_mutations",false,{id,reason:"frozen_request_proof_mutated"})}else frozenRequestProofValidationSuccesses4t++;
  if(errors.length)return {errors,contract:null as any,projection:null as any,probe_proof:null,frozenRequestProofValidationSuccesses4t,frozenRequestProofMutationRejects4t};
  // Reuse the complete 4S request/projection validator after frozen-proof verification.
  // The synthetic lc marker only selects 4S's already-existing "executed linked proof"
  // branch; it does not alter the executable hypothesis or any request field.
  const synthetic:P1ProbeProof={...probeProof,hypothesis:{...probeProof.hypothesis,evidence_ids:[...probeProof.hypothesis.evidence_ids,`${provider.candidate_id}-lc4t`]}};
  const checked=validate4s({...raw,reason:`4S_LINKED_CONTRACT_GROUNDED:${id}`},provider,evidence,ledger,synthetic);
  const mapped=(checked.errors||[]).map((e:string)=>e.replace(/^4s_/,"4t_"));
  return {...checked,errors:mapped,probe_proof:mapped.length?null:probeProof,frozenRequestProofValidationSuccesses4t,frozenRequestProofMutationRejects4t};
}
export function compile4t(contract:MicroContract,input:Record<string,unknown>){return compile4s(contract,input)}
export function project4t(plan:ProjectionPlan,body:any,input:Record<string,unknown>){return project4s(plan,body,input)}
export function validateProjected4t(caseId:string,input:Record<string,any>,out:Record<string,any>){return validateProjected4s(caseId,input,out)}
export function scope4t(start:string,target:string){return scope4s(start,target)}
