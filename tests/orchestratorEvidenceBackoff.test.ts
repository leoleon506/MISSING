import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { configureDemandLedger } from "../src/runtime/demandLedger.js";
import { recordDemand, resetDemand } from "../src/runtime/discovery.js";
import { runThetaOrchestrator } from "../src/runtime/orchestrator.js";
import { configureSupplyBlockLedger, truncateSupplyBlockLedger } from "../src/runtime/supplyBlockLedger.js";
import type { ProviderDiscoveryCandidate } from "../src/runtime/providerDiscovery.js";

const dirs: string[] = [];

afterEach(() => {
  configureDemandLedger(undefined);
  configureSupplyBlockLedger(undefined);
  resetDemand();
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function lead(intent: string, normalized: string): ProviderDiscoveryCandidate {
  return {
    source: "apis_guru",
    directory_id: "example.test:1.0",
    provider: "Example Evidence API",
    title: "Example Evidence API",
    description: "Synthetic provider lead for orchestrator scheduling regression",
    spec_url: "https://example.test/openapi.json",
    directory_url: "https://example.test/directory",
    openapi_version: "3.0.0",
    score: 1,
    matched_terms: ["example"],
    demand_intent: intent,
    normalized_intent: normalized,
  };
}

describe("Theta orchestrator evidence backoff", () => {
  it("backs off needs_evidence so the next cycle can select a different unresolved demand", async () => {
    const dir = mkdtempSync(join(tmpdir(), "missing-evidence-backoff-"));
    dirs.push(dir);
    configureDemandLedger(join(dir, "demand.jsonl"));
    configureSupplyBlockLedger(join(dir, "supply-blocks.jsonl"));
    resetDemand({ truncateLedger: true });
    truncateSupplyBlockLedger();
    process.env.MISSING_SUPPLY_BLOCK_BACKOFF_MS = "86400000";

    recordDemand("First evidence-starved capability", "first_evidence_capability", "mcp");
    recordDemand("First evidence-starved capability", "first_evidence_capability", "mcp");
    recordDemand("Second independent capability", "second_independent_capability", "mcp");

    const discoverFn = async (opportunity: any) => [lead(opportunity.intent, opportunity.normalized_intent)];
    const compileFn = async () => ({
      status: "needs_verification_inputs" as const,
      candidate: {
        candidate_id: "theta2_evidence_candidate",
      },
      reason: "Theta requires two independent replay inputs grounded in evidence",
    } as any);

    const first = await runThetaOrchestrator({ discoverFn, compileFn });
    expect(first.status).toBe("needs_evidence");
    expect(first.opportunity?.requested_capability).toBe("first_evidence_capability");
    expect(first.trace.some(step => step.status === "backoff_recorded")).toBe(true);
    expect(first.reason).toContain("Retry after");

    const second = await runThetaOrchestrator({ discoverFn, compileFn });
    expect(second.opportunity?.requested_capability).toBe("second_independent_capability");
    expect(second.status).toBe("needs_evidence");
  });
});
