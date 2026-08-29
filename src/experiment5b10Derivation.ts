import {deriveExperiment5b9Source} from "./experiment5b9Derivation.js";

function r(s:string,a:string,b:string){if(!s.includes(a))throw new Error(`5b10_anchor_missing:${a.slice(0,180)}`);return s.replace(a,b)}

export function deriveExperiment5b10Source(source:string){let x=deriveExperiment5b9Source(source);
 x=r(x,'import {synthesize5b9 as synthesize4ar} from "./.generated-experiment5b9Planner.js";','import {synthesize5b10 as synthesize4ar} from "./.generated-experiment5b10Planner.js";');
 x=r(x,'const OUT="results/experiment-5b9-engine",MAX_BYTES=FOUR_A_BUDGET.max_bytes;','const OUT="results/experiment-5b10-engine",MAX_BYTES=FOUR_A_BUDGET.max_bytes;');
 x=r(x,'syn=await synthesize(config,p,cr.evidence,ledger,synthesisEvidence);if(cr.recovery?.became_executable&&syn.contract?.decision==="COMPILE")recoveryMetrics5b9.recoveryDerivedHypothesesEnteredBeam5b9++;','syn=await synthesize(config,p,cr.evidence,ledger,synthesisEvidence,cr.recovery?.lineages||[]);');
 x=r(x,'query_semantic_gate_witness_5b8:syn.query_semantic_gate_witness_5b8??null,recovery_lineage_5b9:cr.recovery?.became_executable?cr.recovery.lineages:[],recovery_surface_witness_5b9:cr.recovery?.became_executable?cr.recovery.summary:null,contract,contract_fingerprint:sha3yr(contract)','query_semantic_gate_witness_5b8:syn.query_semantic_gate_witness_5b8??null,recovery_lineage_5b9:cr.recovery?.lineages||[],recovery_surface_witness_5b9:cr.recovery?.summary||null,recovery_candidate_witness_5b10:syn?.contract?.raw?.recovery_candidate_witness_5b10??null,contract,contract_fingerprint:sha3yr(contract)');
 x=x.replaceAll('experiment:"5B9-ENGINE"','experiment:"5B10-ENGINE"').replaceAll('purpose:"development_verified_selected_provider_acquisition_recovery_engine"','purpose:"development_recovery_aware_synthesis_graph_single_beam_engine"').replaceAll('base_sha:"0abd49ebb2e4c081e1f92f0fb178b49091c7499e"','base_sha:"dcadf26c927de338afc6be479e9378080336076a"');
 x=x.replaceAll('./experiment5b9Derivation.ts','./experiment5b10Derivation.ts');
 return x;
}
