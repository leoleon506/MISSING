import {deriveExperiment5b12PlannerSource} from "./experiment5b12PlannerDerivation.js";
function r(s:string,a:string,b:string){if(!s.includes(a))throw new Error(`5b13_planner_anchor_missing:${a.slice(0,180)}`);return s.replace(a,b)}
export function deriveExperiment5b13PlannerSource(source:string){let x=deriveExperiment5b12PlannerSource(source);
 x='import {rankRequestBeam5B13,requestOrderingDeterminism5B13} from "./experiment5b13Utility.js";\n'+x;
 x=r(x,'requestOrderingDeterminism5B3(c,plannerHypotheses5b11,localized.evidence,utilityProofById,historicalPrimary)','requestOrderingDeterminism5B13(c,plannerHypotheses5b11,localized.evidence,utilityProofById,documentaryWitnessById,historicalPrimary)');
 x=r(x,'rankRequestBeam5B3(c,plannerHypotheses5b11,localized.evidence,utilityProofById,historicalPrimary)','rankRequestBeam5B13(c,plannerHypotheses5b11,localized.evidence,utilityProofById,documentaryWitnessById,historicalPrimary)');
 x=r(x,'materialized.raw.request_utility_rank_5b3=i+1;','materialized.raw.request_utility_rank_5b3=i+1;materialized.raw.request_utility_5b13=byId.get(h.id)||null;');
 x=r(x,'metrics.documentaryBeamEntries5b12=beam.filter((h:any)=>documentaryWitnessById.has(h.id)).length;','metrics.documentaryBeamEntries5b12=beam.filter((h:any)=>documentaryWitnessById.has(h.id)).length;metrics.documentaryBeamPosition1_5b13=beam[0]&&documentaryWitnessById.has(beam[0].id)?1:0;metrics.documentaryBeamPosition2_5b13=beam[1]&&documentaryWitnessById.has(beam[1].id)?1:0;');
 x=x.replaceAll('export async function synthesize5b12','export async function synthesize5b13').replaceAll('5b12_unknown_case','5b13_unknown_case').replaceAll('5B12_BEAM_EXHAUSTED','5B13_BEAM_EXHAUSTED');
 return x}
