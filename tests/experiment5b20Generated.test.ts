import {readFileSync} from "node:fs";
import ts from "typescript";
import {describe,expect,it} from "vitest";
import {deriveExperiment5b20PlannerSource} from "../src/experiment5b20PlannerDerivation.js";
import {deriveExperiment5b20Source} from "../src/experiment5b20Derivation.js";
function diagnostics(src:string){return ts.transpileModule(src,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext},reportDiagnostics:true}).diagnostics||[]}

describe("Experiment 5B20 generated strict-local engine",()=>{
 const plannerBase=readFileSync("src/experiment5b6Planner.ts","utf8"),planner=deriveExperiment5b20PlannerSource(plannerBase),engineBase=readFileSync("src/experiment4ar.ts","utf8"),engine=deriveExperiment5b20Source(engineBase);
 it("generates syntactically valid planner and engine",()=>{expect(diagnostics(planner)).toHaveLength(0);expect(diagnostics(engine)).toHaveLength(0);expect(engine).toContain("results/experiment-5b20-engine");expect(engine).toContain("loadFiveB20Workload")});
 it("qualifies requests before unchanged 5B14 global ranking",()=>{const q=planner.indexOf("qualifyRequestHypotheses5B20(qualificationArgs5b20)"),rank=planner.indexOf("rankRequestBeam5B14(c,qualifiedPlannerHypotheses5b20");expect(q).toBeGreaterThan(-1);expect(rank).toBeGreaterThan(q);expect(planner).not.toContain("rankRequestBeam5B14(c,plannerHypotheses5b11")});
 it("requires qualification witnesses for beam and live-probed requests",()=>{expect(planner).toContain("beamEntriesWithoutQualificationWitness5b20");expect(planner).toContain("probedRequestsWithoutQualificationWitness5b20");expect(planner).toContain("evidence_qualification_witness_5b20")});
 it("keeps frozen retrieval and 4+4 acquisition behavior",()=>{expect(engine).toContain("broadRetrievalCalls5b18=0");expect(engine).toContain("equivalenceRerankerCalls5b18=0");expect(engine).toContain("ordinaryFetches<FIVE_B18_ORDINARY_FETCH_LIMIT");expect(engine).toContain("reservedFetches<FIVE_B18_RESERVED_RECOVERY_LIMIT");expect(engine).toContain("totalFetches>=FIVE_B18_TOTAL_FETCH_LIMIT")});
 it("still requires two live build checks and changed-input replay before persistence",()=>{const first=engine.indexOf("first=await safeJson(buildUrl,ledger)"),second=engine.indexOf("second=await safeJson(buildUrl,ledger)"),replay=engine.indexOf("compile4ar(contract,c.replay)"),persist=engine.indexOf("recipes.push(recipe)");expect(first).toBeGreaterThan(-1);expect(second).toBeGreaterThan(first);expect(replay).toBeGreaterThan(second);expect(persist).toBeGreaterThan(replay)});
});
