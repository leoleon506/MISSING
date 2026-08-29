import {describe,expect,it} from "vitest";
import {readFile} from "node:fs/promises";
import ts from "typescript";
import {deriveExperiment5b4Source} from "../src/experiment5b4Derivation.js";

describe("Experiment 5B4 generated benchmark integrity",()=>{
 it("produces syntactically valid generated TypeScript",async()=>{const src=await readFile(new URL("../src/experiment4ar.ts",import.meta.url),"utf8"),out=deriveExperiment5b4Source(src),result=ts.transpileModule(out,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022},reportDiagnostics:true,fileName:"generated-5b4.ts"}),errors=(result.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error).map(d=>ts.flattenDiagnosticMessageText(d.messageText,"\n"));expect(errors).toEqual([])});
 it("persists collection lineage while preserving 5B2 semantic replay",async()=>{const src=await readFile(new URL("../src/experiment4ar.ts",import.meta.url),"utf8"),out=deriveExperiment5b4Source(src);expect(out).toContain('from "./experiment5b4Planner.js"');expect(out).toContain('from "./experiment5b4Contract.js"');expect(out).toContain("structured_collection_witness_5b4");expect(out).toContain("verifySemanticIdentityReplay5B2");expect(out).toContain("results/experiment-5b4-engine")});
});
