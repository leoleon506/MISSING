import {deriveExperiment5b12Source} from "./experiment5b12Derivation.js";
function r(s:string,a:string,b:string){if(!s.includes(a))throw new Error(`5b13_anchor_missing:${a.slice(0,180)}`);return s.replace(a,b)}
export function deriveExperiment5b13Source(source:string){let x=deriveExperiment5b12Source(source);
 x=r(x,'import {synthesize5b12 as synthesize4ar} from "./.generated-experiment5b12Planner.js";','import {synthesize5b13 as synthesize4ar} from "./.generated-experiment5b13Planner.js";');
 x=r(x,'const OUT="results/experiment-5b12-engine",MAX_BYTES=FOUR_A_BUDGET.max_bytes;','const OUT="results/experiment-5b13-engine",MAX_BYTES=FOUR_A_BUDGET.max_bytes;');
 x=x.replaceAll('experiment:"5B12-ENGINE"','experiment:"5B13-ENGINE"').replaceAll('purpose:"development_pre_binding_documented_request_template_extraction_engine"','purpose:"development_request_local_documentary_semantic_utility_engine"');
 x=x.replaceAll('./experiment5b12Derivation.ts','./experiment5b13Derivation.ts');
 return x}
