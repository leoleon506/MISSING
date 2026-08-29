import {describe,expect,it} from "vitest";
import ts from "typescript";
import {readFileSync} from "node:fs";
import {deriveExperiment5b13PlannerSource} from "../src/experiment5b13PlannerDerivation.js";
import {deriveExperiment5b13Source} from "../src/experiment5b13Derivation.js";
function diagnostics(src:string){return ts.transpileModule(src,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext},reportDiagnostics:true}).diagnostics||[]}
describe("Experiment 5B13 generated benchmark integrity",()=>{
 it("produces syntactically valid generated planner TypeScript",()=>{const src=readFileSync("src/experiment5b6Planner.ts","utf8"),generated=deriveExperiment5b13PlannerSource(src);expect(diagnostics(generated)).toHaveLength(0);expect(generated).toContain("synthesize5b13");expect(generated).toContain("rankRequestBeam5B13");expect(generated).toContain("request_utility_5b13")});
 it("produces syntactically valid generated engine TypeScript",()=>{const src=readFileSync("src/experiment4ar.ts","utf8"),generated=deriveExperiment5b13Source(src);expect(diagnostics(generated)).toHaveLength(0);expect(generated).toContain("experiment-5b13-engine");expect(generated).toContain(".generated-experiment5b13Planner.js")});
});
