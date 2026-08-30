import {readFileSync} from "node:fs";
import ts from "typescript";
import {describe,expect,it} from "vitest";
import {deriveExperiment5b17Source} from "../src/experiment5b17Derivation.js";
function diagnostics(src:string){return ts.transpileModule(src,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext},reportDiagnostics:true}).diagnostics||[]}

describe("Experiment 5B17 generated capability-equivalence engine",()=>{
 const source=readFileSync("src/experiment4ar.ts","utf8"),generated=deriveExperiment5b17Source(source);
 it("is syntactically valid and uses the frozen snapshot",()=>{expect(diagnostics(generated)).toHaveLength(0);expect(generated).toContain("results/experiment-5b17-engine");expect(generated).toContain("frozenCatalogUrl=frozen5b17.public_apis_snapshot.raw_url")});
 it("replaces generic provider reranking with deterministic broad retrieval plus equivalence retrieval",()=>{expect(generated).toContain("recoveredBroadRetrieveR2(c as any,catalog)");expect(generated).toContain("callCapabilityEquivalenceReranker5b17(config,c,broad,\"initial\")");expect(generated).not.toContain("const r=await rerank(config,c,broad,rerankEvidence)");expect(generated).toContain("secondaryProviderRerankerCalls5b17:rerankerCalls")});
 it("excludes the primary domain and enforces role claims before acquisition",()=>{expect(generated).toContain("independentPrimaryDomain5b17(primary.primary_provider_start_url,String(x.link))");expect(generated).toContain("validateCapabilityEquivalence5b17({case_id:c.case_id,selected:[claim]},broad,c)");const claimIndex=generated.indexOf("const claimCheck=validateCapabilityEquivalence5b17"),crawlIndex=generated.indexOf("cr=await crawl5b9");expect(claimIndex).toBeGreaterThan(-1);expect(crawlIndex).toBeGreaterThan(claimIndex)});
 it("requires double live verification and changed-input replay before alternate persistence",()=>{const first=generated.indexOf("first=await safeJson(buildUrl,ledger)"),second=generated.indexOf("second=await safeJson(buildUrl,ledger)"),replay=generated.indexOf("compile4ar(contract,c.replay)"),persist=generated.indexOf("recipes.push(recipe)");expect(first).toBeGreaterThan(-1);expect(second).toBeGreaterThan(first);expect(replay).toBeGreaterThan(second);expect(persist).toBeGreaterThan(replay)});
});
