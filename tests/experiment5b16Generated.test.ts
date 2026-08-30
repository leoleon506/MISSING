import {readFileSync} from "node:fs";
import ts from "typescript";
import {describe,expect,it} from "vitest";
import {deriveExperiment5b16Source} from "../src/experiment5b16Derivation.js";
function diagnostics(src:string){return ts.transpileModule(src,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext},reportDiagnostics:true}).diagnostics||[]}

describe("Experiment 5B16 generated redundancy engine",()=>{
 const source=readFileSync("src/experiment4ar.ts","utf8"),generated=deriveExperiment5b16Source(source);
 it("is syntactically valid and uses the frozen tail resolver",()=>{expect(diagnostics(generated)).toHaveLength(0);expect(generated).toContain("results/experiment-5b16-engine");expect(generated).toContain("resolveFrozenTail5b16(frozen5b16,catalog,c.case_id)");expect(generated).toContain("frozenCatalogUrl=frozen5b16.public_apis_snapshot.raw_url")});
 it("does not rerank or broad-retrieve providers in the treatment loop",()=>{expect(generated).not.toContain("const r=await rerank(config,c,broad,rerankEvidence)");expect(generated).not.toContain("recoveredBroadRetrieveR2(c as any,catalog)");expect(generated).toContain("broadRetrievalCalls5b16:0");expect(generated).toContain("newProviderSelectionCalls5b16:0")});
 it("enforces first-eight tail order, independent domain, double live verification and changed-input replay before persistence",()=>{expect(generated).toContain("Number(s.selected_position)>8");expect(generated).toContain("independentProviderDomain5b16(primary.primary_provider_start_url,effectiveStart)");expect(generated).toContain("first=await safeJson(buildUrl,ledger)");expect(generated).toContain("second=await safeJson(buildUrl,ledger)");expect(generated).toContain("compile4ar(contract,c.replay)");expect(generated).toContain("status:\"replay_failed\"");expect(generated).toContain("status:\"qualified_alternate\"");expect(generated.indexOf("status:\"replay_failed\"")).toBeLessThan(generated.indexOf("status:\"qualified_alternate\""))});
});
