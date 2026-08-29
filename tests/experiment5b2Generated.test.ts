import {describe,expect,it} from "vitest";
import {readFile} from "node:fs/promises";
import ts from "typescript";
import {deriveExperiment5b2Source} from "../src/experiment5b2Derivation.js";

describe("Experiment 5B2 generated benchmark integrity",()=>{
 it("produces syntactically valid generated TypeScript",async()=>{const src=await readFile(new URL("../src/experiment4ar.ts",import.meta.url),"utf8"),out=deriveExperiment5b2Source(src),result=ts.transpileModule(out,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022},reportDiagnostics:true,fileName:"generated-5b2.ts"}),errors=(result.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error).map(d=>ts.flattenDiagnosticMessageText(d.messageText,"\n"));expect(errors).toEqual([])});
 it("persists semantic witness and verifies it during replay",async()=>{const src=await readFile(new URL("../src/experiment4ar.ts",import.meta.url),"utf8"),out=deriveExperiment5b2Source(src);expect(out).toContain("semantic_identity_witness_5b2");expect(out).toContain("verifySemanticIdentityReplay5B2");expect(out).toContain("5b2_replay_semantic_identity_failed");expect(out).not.toContain("verifyEntityCouplingReplay5B(recipe.entity_coupling_witness_5b")});
});
