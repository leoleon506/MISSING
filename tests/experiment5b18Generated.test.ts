import {readFileSync} from "node:fs";
import ts from "typescript";
import {describe,expect,it} from "vitest";
import {deriveExperiment5b18Source} from "../src/experiment5b18Derivation.js";
function diagnostics(src:string){return ts.transpileModule(src,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext},reportDiagnostics:true}).diagnostics||[]}

describe("Experiment 5B18 generated reserved-budget engine",()=>{
 const source=readFileSync("src/experiment4ar.ts","utf8"),generated=deriveExperiment5b18Source(source);
 it("is syntactically valid and uses frozen identity resolution",()=>{expect(diagnostics(generated)).toHaveLength(0);expect(generated).toContain("results/experiment-5b18-engine");expect(generated).toContain("resolveFrozenCandidates5b18(frozen5b18,catalog)");expect(generated).toContain("frozenCandidatesForCase5b18(resolved5b18,c.case_id)")});
 it("does not execute provider retrieval or equivalence reranking",()=>{expect(generated).not.toContain("const r=await rerank(config,c,broad,rerankEvidence)");expect(generated).not.toContain("callCapabilityEquivalenceReranker5b17");expect(generated).toContain("broadRetrievalCalls5b18=0");expect(generated).toContain("equivalenceRerankerCalls5b18=0")});
 it("enforces ordinary and reserved phases with fixed limits",()=>{expect(generated).toContain("ordinaryFetches<FIVE_B18_ORDINARY_FETCH_LIMIT");expect(generated).toContain("reservedFetches<FIVE_B18_RESERVED_RECOVERY_LIMIT");expect(generated).toContain("totalFetches>=FIVE_B18_TOTAL_FETCH_LIMIT");const ordinary=generated.indexOf("while(queue.length&&ordinaryFetches<FIVE_B18_ORDINARY_FETCH_LIMIT)"),surface=generated.indexOf("surfaceBeforeReserved=surface"),reserved=generated.indexOf("while(reservedEligible&&!surface.executable_hypotheses&&reservedFetches<FIVE_B18_RESERVED_RECOVERY_LIMIT)");expect(ordinary).toBeGreaterThan(-1);expect(surface).toBeGreaterThan(ordinary);expect(reserved).toBeGreaterThan(surface)});
 it("requires two live build checks and changed-input replay before persistence",()=>{const first=generated.indexOf("first=await safeJson(buildUrl,ledger)"),second=generated.indexOf("second=await safeJson(buildUrl,ledger)"),replay=generated.indexOf("compile4ar(contract,c.replay)"),persist=generated.indexOf("recipes.push(recipe)");expect(first).toBeGreaterThan(-1);expect(second).toBeGreaterThan(first);expect(replay).toBeGreaterThan(second);expect(persist).toBeGreaterThan(replay)});
});
