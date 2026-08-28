import type {DocEvidence} from "./experiment3wCore.js";
import type {RecoveryLedger} from "./experiment3yrCore.js";
import type {Provider4A} from "./experiment4aContract.js";
import type {P1ProbeProof} from "./experiment4ap1Model.js";
import {compile4h,project4h,scope4h,validate4h,validateProjected4h} from "./experiment4hContract.js";
export function validate4i(raw:any,provider:Provider4A,evidence:DocEvidence[],ledger:RecoveryLedger,probeProof:P1ProbeProof|null){const clone=raw&&typeof raw==="object"?JSON.parse(JSON.stringify(raw)):raw;if(clone?.reason&&typeof clone.reason==="string")clone.reason=clone.reason.replace(/^4I_STRUCTURAL_IDENTIFIER_ROLE:/,"4H_TASK_OPERATION_ALIGNMENT:");const r:any=validate4h(clone,provider,evidence,ledger,probeProof);if(r?.contract?.reason&&typeof r.contract.reason==="string")r.contract.reason=r.contract.reason.replace(/^4H_TASK_OPERATION_ALIGNMENT:/,"4I_STRUCTURAL_IDENTIFIER_ROLE:");return r}
export const compile4i=compile4h,project4i=project4h,scope4i=scope4h,validateProjected4i=validateProjected4h;
