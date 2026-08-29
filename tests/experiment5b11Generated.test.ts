import {describe,expect,it} from "vitest";
import ts from "typescript";
import {readFileSync} from "node:fs";
import {deriveExperiment5b11PlannerSource} from "../src/experiment5b11PlannerDerivation.js";
import {deriveExperiment5b11Source} from "../src/experiment5b11Derivation.js";
function diagnostics(src:string){return ts.transpileModule(src,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext},reportDiagnostics:true}).diagnostics||[]}
describe("Experiment 5B11 generated benchmark integrity",()=>{
 it("produces syntactically valid generated planner TypeScript",()=>{const src=readFileSync("src/experiment5b6Planner.ts","utf8"),generated=deriveExperiment5b11PlannerSource(src);expect(diagnostics(generated)).toHaveLength(0);expect(generated).toContain("synthesize5b11");expect(generated).toContain("evidenceFaithfulTemplateFilter5B11")});
 it("produces syntactically valid generated engine TypeScript",()=>{const src=readFileSync("src/experiment4ar.ts","utf8"),generated=deriveExperiment5b11Source(src);expect(diagnostics(generated)).toHaveLength(0);expect(generated).toContain("experiment-5b11-engine");expect(generated).toContain(".generated-experiment5b11Planner.js")});
});
