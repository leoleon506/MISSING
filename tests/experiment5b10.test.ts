import {readFileSync} from "node:fs";
import {describe,expect,it} from "vitest";
import {deriveExperiment5b10PlannerSource} from "../src/experiment5b10PlannerDerivation.js";
import {deriveExperiment5b10Source} from "../src/experiment5b10Derivation.js";
import {countRuntimeProviderUrlLiterals5B10,FIVE_B10_BASE_SHA,FIVE_B10_PREREG_COMMIT,fiveB10PathAllowed} from "../src/experiment5b10Harness.js";

const planner=readFileSync(new URL("../src/experiment5b6Planner.ts",import.meta.url),"utf8");
const engine=readFileSync(new URL("../src/experiment4ar.ts",import.meta.url),"utf8");

describe("Experiment 5B10 preregistered treatment",()=>{
 it("is anchored to frozen 5B9 and isolated paths",()=>{expect(FIVE_B10_BASE_SHA).toBe("dcadf26c927de338afc6be479e9378080336076a");expect(FIVE_B10_PREREG_COMMIT).toBe("9cb54b7e28e60de9427fc8a100cd449ba63e2690");expect(fiveB10PathAllowed("src/experiment5b10Decision.ts")).toBe(true);expect(fiveB10PathAllowed("src/experiment5b9Decision.ts")).toBe(false)});
 it("derives a recovery-aware final planner with one shared top-two beam",()=>{const s=deriveExperiment5b10PlannerSource(planner);expect(s).toContain("export async function synthesize5b10");expect(s).toContain("const beam=dedup.slice(0,2)");expect(s).toContain("recoveryDerivedBeamEntries5b10++");expect(s).toContain("recoveryDerivedIds5b10.has(h.id)");expect(s).toContain("ranking_bonus:false");expect(s).not.toContain("recoveryBeam=dedup");});
 it("measures beam membership directly rather than inferring it from COMPILE",()=>{const s=deriveExperiment5b10Source(engine);expect(s).toContain("synthesize(config,p,cr.evidence,ledger,synthesisEvidence,cr.recovery?.lineages||[])");expect(s).not.toContain("cr.recovery?.became_executable&&syn.contract?.decision===\"COMPILE\"");expect(s).not.toContain("recoveryDerivedHypothesesEnteredBeam5b9++")});
 it("does not introduce provider URL literals in treatment sources",()=>{for(const file of ["experiment5b10PlannerDerivation.ts","experiment5b10Derivation.ts","experiment5b10Decision.ts"]){const s=readFileSync(new URL(`../src/${file}`,import.meta.url),"utf8");expect(countRuntimeProviderUrlLiterals5B10(s)).toBe(0)}});
 it("keeps the manual runner distinct from the consumed 5B9 engine",()=>{const s=deriveExperiment5b10Source(engine);expect(s).toContain("results/experiment-5b10-engine");expect(s).toContain("development_recovery_aware_synthesis_graph_single_beam_engine")});
});
