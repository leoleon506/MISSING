import {describe,expect,it} from "vitest";
import {readFile} from "node:fs/promises";
import ts from "typescript";
import {deriveExperiment5b7Source} from "../src/experiment5b7Derivation.js";
import {deriveExperiment5b7PlannerSource} from "../src/experiment5b7PlannerDerivation.js";

describe("Experiment 5B7 generated benchmark integrity",()=>{
 it("produces syntactically valid generated benchmark and planner TypeScript",async()=>{const core=await readFile(new URL("../src/experiment4ar.ts",import.meta.url),"utf8"),planner=await readFile(new URL("../src/experiment5b6Planner.ts",import.meta.url),"utf8"),outs=[deriveExperiment5b7Source(core),deriveExperiment5b7PlannerSource(planner)];for(const [i,out] of outs.entries()){const result=ts.transpileModule(out,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022},reportDiagnostics:true,fileName:`generated-5b7-${i}.ts`}),errors=(result.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error).map(d=>ts.flattenDiagnosticMessageText(d.messageText,"\n"));expect(errors).toEqual([])}});
 it("replaces only the query source in the derived planner and persists gate witness",async()=>{const planner=await readFile(new URL("../src/experiment5b6Planner.ts",import.meta.url),"utf8"),out=deriveExperiment5b7PlannerSource(planner);expect(out).toContain('from "./experiment5b7Gate.js"');expect(out).toContain("buildGatedQueryHypotheses5B7(baseEvidence,provider)");expect(out).toContain("querySemanticGateDeterminism5B7(baseEvidence,provider)");expect(out).toContain("query_semantic_gate_witness_5b7");expect(out).toContain("dedup.slice(0,2)")});
 it("preserves strict semantic replay in generated benchmark",async()=>{const src=await readFile(new URL("../src/experiment4ar.ts",import.meta.url),"utf8"),out=deriveExperiment5b7Source(src);expect(out).toContain('from "./.generated-experiment5b7Planner.js"');expect(out).toContain("query_semantic_gate_witness_5b7");expect(out).toContain("verifySemanticIdentityReplay5B2");expect(out).toContain("results/experiment-5b7-engine")});
});
