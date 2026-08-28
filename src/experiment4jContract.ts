import type {DocEvidence} from "./experiment3wCore.js";
import type {RecoveryLedger} from "./experiment3yrCore.js";
import type {Provider4A} from "./experiment4aContract.js";
import type {P1ProbeProof} from "./experiment4ap1Model.js";
import {compile4i,project4i,scope4i,validate4i,validateProjected4i} from "./experiment4iContract.js";
export function validate4j(raw:any,provider:Provider4A,evidence:DocEvidence[],ledger:RecoveryLedger,probeProof:P1ProbeProof|null){const clone=raw&&typeof raw==="object"?JSON.parse(JSON.stringify(raw)):raw;if(clone?.reason&&typeof clone.reason==="string")clone.reason=clone.reason.replace(/^4J_VARIABLE_ROLE_ENTITY_COMPATIBILITY:/,"4I_STRUCTURAL_IDENTIFIER_ROLE:");const r:any=validate4i(clone,provider,evidence,ledger,probeProof);if(r?.contract?.reason&&typeof r.contract.reason==="string")r.contract.reason=r.contract.reason.replace(/^4I_STRUCTURAL_IDENTIFIER_ROLE:/,"4J_VARIABLE_ROLE_ENTITY_COMPATIBILITY:");return r}
export const compile4j=compile4i,project4j=project4i,scope4j=scope4i,validateProjected4j=validateProjected4i;
