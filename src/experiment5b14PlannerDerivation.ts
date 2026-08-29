import {deriveExperiment5b13PlannerSource} from "./experiment5b13PlannerDerivation.js";
function r(s:string,a:string,b:string){if(!s.includes(a))throw new Error(`5b14_planner_anchor_missing:${a.slice(0,180)}`);return s.replace(a,b)}
export function deriveExperiment5b14PlannerSource(source:string){let x=deriveExperiment5b13PlannerSource(source);
 x='import {rankRequestBeam5B14,requestOrderingDeterminism5B14} from "./experiment5b14Utility.js";\n'+x;
 x=r(x,'requestOrderingDeterminism5B13(c,plannerHypotheses5b11,localized.evidence,utilityProofById,documentaryWitnessById,historicalPrimary)','requestOrderingDeterminism5B14(c,plannerHypotheses5b11,localized.evidence,utilityProofById,documentaryWitnessById,historicalPrimary)');
 x=r(x,'rankRequestBeam5B13(c,plannerHypotheses5b11,localized.evidence,utilityProofById,documentaryWitnessById,historicalPrimary)','rankRequestBeam5B14(c,plannerHypotheses5b11,localized.evidence,utilityProofById,documentaryWitnessById,historicalPrimary)');
 x=r(x,'materialized.raw.request_utility_5b13=byId.get(h.id)||null;','materialized.raw.request_utility_5b13=byId.get(h.id)||null;materialized.raw.request_utility_5b14=byId.get(h.id)||null;');
 x=x.replaceAll('export async function synthesize5b13','export async function synthesize5b14').replaceAll('5b13_unknown_case','5b14_unknown_case').replaceAll('5B13_BEAM_EXHAUSTED','5B14_BEAM_EXHAUSTED');
 return x}
