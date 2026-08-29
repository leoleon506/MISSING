import {describe,expect,it} from "vitest";
import {readFile} from "node:fs/promises";
import ts from "typescript";
import {deriveExperiment5b10Source} from "../src/experiment5b10Derivation.js";
import {deriveExperiment5b10PlannerSource} from "../src/experiment5b10PlannerDerivation.js";

function finalSource(s:string){return s.replace("async function rerank(async function rerank(","async function rerank(")}
describe("Experiment 5B10 generated benchmark integrity",()=>{
 it("produces syntactically valid generated benchmark and planner TypeScript",async()=>{const core=await readFile(new URL("../src/experiment4ar.ts",import.meta.url),"utf8"),planner=await readFile(new URL("../src/experiment5b6Planner.ts",import.meta.url),"utf8"),outs=[finalSource(deriveExperiment5b10Source(core)),deriveExperiment5b10PlannerSource(planner)];for(const [i,out] of outs.entries()){const result=ts.transpileModule(out,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022},reportDiagnostics:true,fileName:`generated-5b10-${i}.ts`}),errors=(result.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error).map(d=>ts.flattenDiagnosticMessageText(d.messageText,"\n"));expect(errors).toEqual([])}});
 it("uses one actual top-two beam and direct recovery membership instrumentation",async()=>{const planner=deriveExperiment5b10PlannerSource(await readFile(new URL("../src/experiment5b6Planner.ts",import.meta.url),"utf8"));expect(planner).toContain("const beam=dedup.slice(0,2)");expect(planner).toContain("recoveryDerivedIds5b10.has(h.id)");expect(planner).toContain("recoveryDerivedBeamEntries5b10++");expect(planner).toContain("ranking_bonus:false");expect(planner).not.toContain("recoveryDerivedHypothesesEnteredBeam5b9++")});
});
