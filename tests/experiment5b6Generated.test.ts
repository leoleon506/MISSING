import {describe,expect,it} from "vitest";
import {readFile} from "node:fs/promises";
import ts from "typescript";
import {deriveExperiment5b6Source} from "../src/experiment5b6Derivation.js";

describe("Experiment 5B6 generated benchmark integrity",()=>{
 it("produces syntactically valid generated TypeScript",async()=>{const src=await readFile(new URL("../src/experiment4ar.ts",import.meta.url),"utf8"),out=deriveExperiment5b6Source(src),result=ts.transpileModule(out,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022},reportDiagnostics:true,fileName:"generated-5b6.ts"}),errors=(result.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error).map(d=>ts.flattenDiagnosticMessageText(d.messageText,"\n"));expect(errors).toEqual([])});
 it("persists query lineage while preserving prior semantic replay",async()=>{const src=await readFile(new URL("../src/experiment4ar.ts",import.meta.url),"utf8"),out=deriveExperiment5b6Source(src);expect(out).toContain('from "./experiment5b6Planner.js"');expect(out).toContain('from "./experiment5b6Contract.js"');expect(out).toContain("query_operation_witness_5b6");expect(out).toContain("cross_document_alignment_witness_5b5");expect(out).toContain("verifySemanticIdentityReplay5B2");expect(out).toContain("results/experiment-5b6-engine")});
 it("keeps the two-request beam",async()=>{const text=await readFile(new URL("../src/experiment5b6Planner.ts",import.meta.url),"utf8");expect(text).toContain("dedup.slice(0,2)")});
});
