import {deriveExperiment5b10Source} from "./experiment5b10Derivation.js";
function r(s:string,a:string,b:string){if(!s.includes(a))throw new Error(`5b11_anchor_missing:${a.slice(0,180)}`);return s.replace(a,b)}
export function deriveExperiment5b11Source(source:string){let x=deriveExperiment5b10Source(source);
 x=r(x,'import {synthesize5b10 as synthesize4ar} from "./.generated-experiment5b10Planner.js";','import {synthesize5b11 as synthesize4ar} from "./.generated-experiment5b11Planner.js";');
 x=r(x,'const OUT="results/experiment-5b10-engine",MAX_BYTES=FOUR_A_BUDGET.max_bytes;','const OUT="results/experiment-5b11-engine",MAX_BYTES=FOUR_A_BUDGET.max_bytes;');
 x=x.replace('async function synthesize(config:any,p:Provider4A,docs:DocEvidence[],ledger:RecoveryLedger,evidence:any[]){','async function synthesize(config:any,p:Provider4A,docs:DocEvidence[],ledger:RecoveryLedger,evidence:any[],recoveryLineages5b11:any[]=[]){');
 x=x.replaceAll('synthesize4ar(config,p,docs,ledger)','synthesize4ar(config,p,docs,ledger,evidence,recoveryLineages5b11)');
 x=x.replaceAll('synthesize4ar(config,p,docs,"initial")','synthesize4ar(config,p,docs,ledger,evidence,recoveryLineages5b11)');
 x=x.replaceAll('synthesize4ar(config,p,docs,"repair",v.errors.join(","))','synthesize4ar(config,p,docs,ledger,evidence,recoveryLineages5b11)');
 x=r(x,'syn=await synthesize(config,p,cr.evidence,ledger,synthesisEvidence,cr.recovery?.lineages||[]);','syn=await synthesize(config,p,cr.evidence,ledger,synthesisEvidence,cr.recovery?.lineages||[]);');
 x=r(x,'recovery_candidate_witness_5b10:syn?.contract?.raw?.recovery_candidate_witness_5b10??null,contract,contract_fingerprint:sha3yr(contract)','recovery_candidate_witness_5b10:syn?.contract?.raw?.recovery_candidate_witness_5b10??null,template_witness_5b11:syn?.contract?.raw?.template_witness_5b11??null,contract,contract_fingerprint:sha3yr(contract)');
 x=x.replaceAll('experiment:"5B10-ENGINE"','experiment:"5B11-ENGINE"').replaceAll('purpose:"development_recovery_aware_synthesis_graph_single_beam_engine"','purpose:"development_evidence_faithful_documented_request_template_compilation_engine"');
 x=x.replaceAll('./experiment5b10Derivation.ts','./experiment5b11Derivation.ts');
 return x}
