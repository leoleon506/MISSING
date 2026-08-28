import type {Config} from "./config/index.js";
import type {RecoveryLedger} from "./experiment3yrCore.js";
import type {DocEvidence} from "./experiment3wCore.js";
import type {Provider4A} from "./experiment4aContract.js";
import {synthesize4i} from "./experiment4iPlanner.js";
export async function synthesize4j(config:Config,provider:Provider4A,evidence:DocEvidence[],ledger:RecoveryLedger){const r:any=await synthesize4i(config,provider,evidence,ledger);if(r?.parsed_json?.reason&&typeof r.parsed_json.reason==="string")r.parsed_json.reason=r.parsed_json.reason.replace(/^4I_STRUCTURAL_IDENTIFIER_ROLE:/,"4J_CONTEXTUAL_IDENTIFIER_ROLE:");return r}
