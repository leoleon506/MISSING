import {describe,expect,it} from "vitest";
import {readFile} from "node:fs/promises";
import ts from "typescript";
import {deriveExperiment5b3Source} from "../src/experiment5b3Derivation.js";

describe("Experiment 5B3 generated benchmark integrity",()=>{
 it("produces syntactically valid generated TypeScript",async()=>{const src=await readFile(new URL("../src/experiment4ar.ts",import.meta.url),"utf8"),out=deriveExperiment5b3Source(src),result=ts.transpileModule(out,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022},reportDiagnostics:true,fileName:"generated-5b3.ts"}),errors=(result.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error).map(d=>ts.flattenDiagnosticMessageText(d.messageText,"\n"));expect(errors).toEqual([])});
 it("preserves 5B2 semantic replay enforcement",async()=>{const src=await readFile(new URL("../src/experiment4ar.ts",import.meta.url),"utf8"),out=deriveExperiment5b3Source(src);expect(out).toContain("verifySemanticIdentityReplay5B2");expect(out).toContain("semantic_identity_witness_5b2");expect(out).toContain("request_utility_recovered_5b3");expect(out).toContain("deterministicProviderSelection5B3")});
});
