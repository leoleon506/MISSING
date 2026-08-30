import {deriveExperiment5b13Source} from "./experiment5b13Derivation.js";
function r(s:string,a:string,b:string){if(!s.includes(a))throw new Error(`5b14_anchor_missing:${a.slice(0,180)}`);return s.replace(a,b)}
export function deriveExperiment5b14Source(source:string){let x=deriveExperiment5b13Source(source);
 x=r(x,'import {synthesize5b13 as synthesize4ar} from "./.generated-experiment5b13Planner.js";','import {synthesize5b14 as synthesize4ar} from "./.generated-experiment5b14Planner.js";');
 x=r(x,'const OUT="results/experiment-5b13-engine",MAX_BYTES=FOUR_A_BUDGET.max_bytes;','const OUT="results/experiment-5b14-engine",MAX_BYTES=FOUR_A_BUDGET.max_bytes;');
 x=r(x,'const recipe:any={family:c.family,case_id:c.case_id,provider_candidate_id:p.candidate_id','const plannerOutput5b14=[...synthesisEvidence].reverse().find((e:any)=>e.case_id===p.case_id&&e.provider_candidate_id===p.candidate_id&&e.parsed_json?.decision==="COMPILE")?.parsed_json??null,recipe:any={family:c.family,case_id:c.case_id,provider_candidate_id:p.candidate_id');
 x=r(x,'documentary_witness_5b12:(syn?.contract as any)?.documentary_witness_5b12??(syn?.contract as any)?.raw?.documentary_witness_5b12??null,contract,contract_fingerprint:sha3yr(contract)','documentary_witness_5b12:plannerOutput5b14?.documentary_witness_5b12??(syn?.contract as any)?.documentary_witness_5b12??(syn?.contract as any)?.raw?.documentary_witness_5b12??null,request_utility_5b14:plannerOutput5b14?.request_utility_5b14??(syn?.contract as any)?.request_utility_5b14??(syn?.contract as any)?.raw?.request_utility_5b14??null,contract,contract_fingerprint:sha3yr(contract)');
 x=x.replaceAll('experiment:"5B13-ENGINE"','experiment:"5B14-ENGINE"').replaceAll('purpose:"development_request_local_documentary_semantic_utility_engine"','purpose:"development_symmetric_request_local_operation_compatibility_engine"');
 x=x.replaceAll('./experiment5b13Derivation.ts','./experiment5b14Derivation.ts');
 return x}
