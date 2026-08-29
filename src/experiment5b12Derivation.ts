import {deriveExperiment5b11Source} from "./experiment5b11Derivation.js";
function r(s:string,a:string,b:string){if(!s.includes(a))throw new Error(`5b12_anchor_missing:${a.slice(0,180)}`);return s.replace(a,b)}
export function deriveExperiment5b12Source(source:string){let x=deriveExperiment5b11Source(source);
 x=r(x,'import {synthesize5b11 as synthesize4ar} from "./.generated-experiment5b11Planner.js";','import {synthesize5b12 as synthesize4ar} from "./.generated-experiment5b12Planner.js";');
 x=r(x,'const OUT="results/experiment-5b11-engine",MAX_BYTES=FOUR_A_BUDGET.max_bytes;','const OUT="results/experiment-5b12-engine",MAX_BYTES=FOUR_A_BUDGET.max_bytes;');
 x=r(x,'recovery_candidate_witness_5b10:syn?.contract?.raw?.recovery_candidate_witness_5b10??null,template_witness_5b11:syn?.contract?.raw?.template_witness_5b11??null,contract,contract_fingerprint:sha3yr(contract)','recovery_candidate_witness_5b10:(syn?.contract as any)?.recovery_candidate_witness_5b10??(syn?.contract as any)?.raw?.recovery_candidate_witness_5b10??null,template_witness_5b11:(syn?.contract as any)?.template_witness_5b11??(syn?.contract as any)?.raw?.template_witness_5b11??null,documentary_witness_5b12:(syn?.contract as any)?.documentary_witness_5b12??(syn?.contract as any)?.raw?.documentary_witness_5b12??null,contract,contract_fingerprint:sha3yr(contract)');
 x=x.replaceAll('experiment:"5B11-ENGINE"','experiment:"5B12-ENGINE"').replaceAll('purpose:"development_evidence_faithful_documented_request_template_compilation_engine"','purpose:"development_pre_binding_documented_request_template_extraction_engine"');
 x=x.replaceAll('./experiment5b11Derivation.ts','./experiment5b12Derivation.ts');
 return x}
