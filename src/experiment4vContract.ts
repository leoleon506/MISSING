import type {DocEvidence,MicroContract} from "./experiment3wCore.js";
import type {RecoveryLedger} from "./experiment3yrCore.js";
import type {Provider4A} from "./experiment4aContract.js";
import type {ProjectionPlan} from "./experiment4arCore.js";
import type {P1ProbeProof} from "./experiment4ap1Model.js";
import {validate4u,compile4u,project4u,validateProjected4u,scope4u} from "./experiment4uContract.js";
import {verifySchemaRoleWitness4V} from "./experiment4vSchemaWitness.js";

export function validate4v(raw:any,provider:Provider4A,evidence:DocEvidence[],ledger:RecoveryLedger,probeProof:P1ProbeProof|null){const checked:any=validate4u(raw,provider,evidence,ledger,probeProof);if(raw?.decision!=="COMPILE"||!probeProof)return {...checked,schemaRoleWitnessValidationSuccesses4v:0,schemaRoleWitnessMutationRejects4v:0};const witness=raw?.schema_role_witness_4v;if(!witness)return {...checked,schemaRoleWitnessValidationSuccesses4v:0,schemaRoleWitnessMutationRejects4v:0};if(!verifySchemaRoleWitness4V(witness,probeProof)){ledger.record("guard","ungrounded_projection_fields",false,{reason:"4v_schema_witness_mutated"});return {...checked,errors:[...(checked.errors||[]),"4v_schema_witness_mutated"],projection:null,probe_proof:null,schemaRoleWitnessValidationSuccesses4v:0,schemaRoleWitnessMutationRejects4v:1}}const allowed=new Set((witness.mappings||[]).map((m:any)=>`${m.output_role}:${m.observed_path}`)),errors=(checked.errors||[]).filter((e:string)=>{const m=/^4u_ungrounded_output:([^:]+):(.+)$/.exec(e);return !(m&&allowed.has(`${m[1]}:${m[2]}`))});return {...checked,errors,projection:errors.length?null:(raw.projection as ProjectionPlan),probe_proof:errors.length?null:probeProof,schemaRoleWitnessValidationSuccesses4v:errors.length?0:1,schemaRoleWitnessMutationRejects4v:0}}
export function compile4v(contract:MicroContract,input:Record<string,unknown>){return compile4u(contract,input)}
export function project4v(plan:ProjectionPlan,body:any,input:Record<string,unknown>){return project4u(plan,body,input)}
export function validateProjected4v(caseId:string,input:Record<string,any>,out:Record<string,any>){return validateProjected4u(caseId,input,out)}
export function scope4v(start:string,target:string){return scope4u(start,target)}
