import {deriveExperiment5b13Source} from "./experiment5b13Derivation.js";
function r(s:string,a:string,b:string){if(!s.includes(a))throw new Error(`5b14_anchor_missing:${a.slice(0,180)}`);return s.replace(a,b)}
export function deriveExperiment5b14Source(source:string){let x=deriveExperiment5b13Source(source);
 x=r(x,'import {synthesize5b13 as synthesize4ar} from "./.generated-experiment5b13Planner.js";','import {synthesize5b14 as synthesize4ar} from "./.generated-experiment5b14Planner.js";');
 x=r(x,'const OUT="results/experiment-5b13-engine",MAX_BYTES=FOUR_A_BUDGET.max_bytes;','const OUT="results/experiment-5b14-engine",MAX_BYTES=FOUR_A_BUDGET.max_bytes;');
 x=x.replaceAll('experiment:"5B13-ENGINE"','experiment:"5B14-ENGINE"').replaceAll('purpose:"development_request_local_documentary_semantic_utility_engine"','purpose:"development_symmetric_request_local_operation_compatibility_engine"');
 x=x.replaceAll('./experiment5b13Derivation.ts','./experiment5b14Derivation.ts');
 return x}
