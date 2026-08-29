import {describe,expect,it} from "vitest";
import ts from "typescript";
import {readFileSync} from "node:fs";
import {deriveExperiment5b12PlannerSource} from "../src/experiment5b12PlannerDerivation.js";
import {deriveExperiment5b12Source} from "../src/experiment5b12Derivation.js";
function diagnostics(src:string){return ts.transpileModule(src,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext},reportDiagnostics:true}).diagnostics||[]}
describe("Experiment 5B12 generated benchmark integrity",()=>{
 it("produces syntactically valid generated planner TypeScript",()=>{const src=readFileSync("src/experiment5b6Planner.ts","utf8"),generated=deriveExperiment5b12PlannerSource(src);expect(diagnostics(generated)).toHaveLength(0);expect(generated).toContain("synthesize5b12");expect(generated).toContain("buildDocumentaryRequestHypotheses5B12");expect(generated).toContain("documentary_witness_5b12")});
 it("produces syntactically valid generated engine TypeScript",()=>{const src=readFileSync("src/experiment4ar.ts","utf8"),generated=deriveExperiment5b12Source(src);expect(diagnostics(generated)).toHaveLength(0);expect(generated).toContain("experiment-5b12-engine");expect(generated).toContain(".generated-experiment5b12Planner.js");expect(generated).toContain("documentary_witness_5b12")});
});
