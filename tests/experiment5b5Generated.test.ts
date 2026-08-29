import {describe,expect,it} from "vitest";
import {readFile} from "node:fs/promises";
import ts from "typescript";
import {deriveExperiment5b5Source} from "../src/experiment5b5Derivation.js";

describe("Experiment 5B5 generated benchmark integrity",()=>{
 it("produces syntactically valid generated TypeScript",async()=>{const src=await readFile(new URL("../src/experiment4ar.ts",import.meta.url),"utf8"),out=deriveExperiment5b5Source(src),result=ts.transpileModule(out,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022},reportDiagnostics:true,fileName:"generated-5b5.ts"}),errors=(result.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error).map(d=>ts.flattenDiagnosticMessageText(d.messageText,"\n"));expect(errors).toEqual([])});
 it("persists alignment lineage and preserves semantic replay",async()=>{const src=await readFile(new URL("../src/experiment4ar.ts",import.meta.url),"utf8"),out=deriveExperiment5b5Source(src);expect(out).toContain('from "./experiment5b5Planner.js"');expect(out).toContain('from "./experiment5b5Contract.js"');expect(out).toContain("cross_document_alignment_witness_5b5");expect(out).toContain("structured_collection_witness_5b4");expect(out).toContain("verifySemanticIdentityReplay5B2");expect(out).toContain("results/experiment-5b5-engine")});
 it("keeps the two-request beam in the 5B5 planner",async()=>{const text=await readFile(new URL("../src/experiment5b5Planner.ts",import.meta.url),"utf8");expect(text).toContain("dedup.slice(0,2)");expect(text).not.toContain("synthesize4s(")});
});
