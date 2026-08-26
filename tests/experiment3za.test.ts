import {describe,expect,it} from "vitest";
import {providerSeedAudit,selfReferenceBugPresent,urlLiterals} from "../src/experiment3zaCore.js";

describe("3Z-A forensic integrity audit",()=>{
 it("finds URL literals without self-referential provider regexes",()=>{expect(urlLiterals('const x="https://example.com/api"')).toEqual(["https://example.com/api"]);});
 it("accepts candidate-derived provider wiring",()=>{const runner='const broad=recoveredBroadRetrieveR2(c as any,catalog); const selected=resolveSelected(r.selection,broad as any); const p={start_url:s.link};',core='export const Z_CASES=[{case_id:"x"}]; export type IntegrationProviderZ={start_url:string};',planner='const system="generic";';expect(providerSeedAudit(runner,core,planner).clean).toBe(true);});
 it("confirms the old auditor pattern is self-referential",()=>{const src='const runnerSource=await readFile(new URL(import.meta.url),"utf8"); const forbiddenSource=/pokeapi|nbp\\.pl/i.test(runnerSource);';expect(selfReferenceBugPresent(src)).toBe(true);});
});
