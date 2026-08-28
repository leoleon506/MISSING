import type {DocEvidence,MicroContract} from "./experiment3wCore.js";
import type {RecoveryLedger} from "./experiment3yrCore.js";
import type {Provider4A} from "./experiment4aContract.js";
import type {ProjectionPlan} from "./experiment4arCore.js";
import type {P1ProbeProof} from "./experiment4ap1Model.js";
import {validate4s,compile4s,project4s,validateProjected4s,scope4s} from "./experiment4sContract.js";
import {verifyFrozenRequestProof4U} from "./experiment4uNativeOperation.js";

export function validate4u(raw:any,provider:Provider4A,evidence:DocEvidence[],ledger:RecoveryLedger,probeProof:P1ProbeProof|null){
  if(raw?.decision!=="COMPILE")return validate4s(raw,provider,evidence,ledger,probeProof);
  let frozenRequestProofValidationSuccesses4u=0,frozenRequestProofMutationRejects4u=0;
  if(!probeProof||probeProof.record.disposition!=="success")return {errors:["4u_missing_successful_probe_proof"],contract:null as any,projection:null as any,probe_proof:null,frozenRequestProofValidationSuccesses4u,frozenRequestProofMutationRejects4u};
  if(!verifyFrozenRequestProof4U(probeProof.hypothesis,raw?.frozen_request_proof_4u)){frozenRequestProofMutationRejects4u++;ledger.record("guard","endpoint_mutations",false,{id:probeProof.hypothesis.id,reason:"4u_frozen_request_proof_mutated"});return {errors:["4u_frozen_request_proof_mutated"],contract:null as any,projection:null as any,probe_proof:null,frozenRequestProofValidationSuccesses4u,frozenRequestProofMutationRejects4u}}
  frozenRequestProofValidationSuccesses4u++;
  const id=probeProof.hypothesis.id,synthetic:P1ProbeProof={...probeProof,hypothesis:{...probeProof.hypothesis,evidence_ids:[...probeProof.hypothesis.evidence_ids,`${provider.candidate_id}-lc4u`]}};
  const checked=validate4s({...raw,reason:`4S_LINKED_CONTRACT_GROUNDED:${id}`},provider,evidence,ledger,synthetic),mapped=(checked.errors||[]).map((e:string)=>e.replace(/^4s_/,"4u_"));
  return {...checked,errors:mapped,probe_proof:mapped.length?null:probeProof,frozenRequestProofValidationSuccesses4u,frozenRequestProofMutationRejects4u};
}
export function compile4u(contract:MicroContract,input:Record<string,unknown>){return compile4s(contract,input)}
export function project4u(plan:ProjectionPlan,body:any,input:Record<string,unknown>){return project4s(plan,body,input)}
export function validateProjected4u(caseId:string,input:Record<string,any>,out:Record<string,any>){return validateProjected4s(caseId,input,out)}
export function scope4u(start:string,target:string){return scope4s(start,target)}
