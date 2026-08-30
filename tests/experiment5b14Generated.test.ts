import {describe,expect,it} from "vitest";
import ts from "typescript";
import {readFileSync} from "node:fs";
import {deriveExperiment5b14PlannerSource} from "../src/experiment5b14PlannerDerivation.js";
import {deriveExperiment5b14Source} from "../src/experiment5b14Derivation.js";
function diagnostics(src:string){return ts.transpileModule(src,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext},reportDiagnostics:true}).diagnostics||[]}
describe("Experiment 5B14 generated benchmark integrity",()=>{
 it("activates the 5B14 ranker in generated planner",()=>{const src=readFileSync("src/experiment5b6Planner.ts","utf8"),generated=deriveExperiment5b14PlannerSource(src);expect(diagnostics(generated)).toHaveLength(0);expect(generated).toContain("synthesize5b14");expect(generated).toContain("rankRequestBeam5B14(c,plannerHypotheses5b11,localized.evidence,utilityProofById,documentaryWitnessById,historicalPrimary)");expect(generated).toContain("requestOrderingDeterminism5B14(c,plannerHypotheses5b11,localized.evidence,utilityProofById,documentaryWitnessById,historicalPrimary)");expect(generated).not.toContain("rankRequestBeam5B13(c,plannerHypotheses5b11,localized.evidence,utilityProofById,documentaryWitnessById,historicalPrimary)");expect(generated).toContain("request_utility_5b14")});
 it("produces syntactically valid generated engine",()=>{const src=readFileSync("src/experiment4ar.ts","utf8"),generated=deriveExperiment5b14Source(src);expect(diagnostics(generated)).toHaveLength(0);expect(generated).toContain("experiment-5b14-engine");expect(generated).toContain(".generated-experiment5b14Planner.js")});
 it("persists documentary witness and 5B14 utility from pre-normalization synthesis evidence",()=>{const src=readFileSync("src/experiment4ar.ts","utf8"),generated=deriveExperiment5b14Source(src);expect(generated).toContain("plannerOutput5b14=[...synthesisEvidence].reverse().find");expect(generated).toContain("plannerOutput5b14?.documentary_witness_5b12");expect(generated).toContain("plannerOutput5b14?.request_utility_5b14");expect(generated).toContain("documentary_witness_5b12:");expect(generated).toContain("request_utility_5b14:");});
});
