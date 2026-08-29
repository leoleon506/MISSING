import {describe,expect,it} from "vitest";
import {readFile} from "node:fs/promises";
import ts from "typescript";
import {deriveExperiment5bSource} from "../src/experiment5bDerivation.js";

describe("Experiment 5B generated benchmark integrity",()=>{
  it("produces syntactically valid generated benchmark TypeScript",async()=>{
    const src=await readFile(new URL("../src/experiment4ar.ts",import.meta.url),"utf8");
    const out=deriveExperiment5bSource(src);
    const result=ts.transpileModule(out,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022},reportDiagnostics:true,fileName:"generated-5b.ts"});
    const errors=(result.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error).map(d=>ts.flattenDiagnosticMessageText(d.messageText,"\n"));
    expect(errors).toEqual([]);
  });
  it("keeps generated replay entity-coupled and response-witness closed-world",async()=>{
    const src=await readFile(new URL("../src/experiment4ar.ts",import.meta.url),"utf8");
    const out=deriveExperiment5bSource(src);
    expect(out).toContain("verifyEntityCouplingReplay5B");
    expect(out).toContain("verifyResponseRoleReplay5B");
    expect(out).toContain("5b_replay_entity_coupling_failed");
    expect(out).toContain("response_role_witness_5b");
    expect(out).toContain("entity_coupling_witness_5b");
  });
});
