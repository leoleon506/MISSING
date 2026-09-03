import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { configureDemandLedger } from "../src/runtime/demandLedger.js";
import { recordDemand, resetDemand } from "../src/runtime/discovery.js";
import { runThetaOrchestrator } from "../src/runtime/orchestrator.js";
import { configureSupplyBlockLedger, truncateSupplyBlockLedger } from "../src/runtime/supplyBlockLedger.js";
import type { ProviderDiscoveryCandidate } from "../src/runtime/providerDiscovery.js";

let dir = "";

function abortableHungFetch(_input: string | URL | Request, init?: RequestInit): Promise<Response> {
  return new Promise((_resolve, reject) => {
    const signal = init?.signal;
    if (!signal) {
      reject(new Error("dependency fetch did not receive an abort signal"));
      return;
    }
    const abort = () => reject(signal.reason instanceof Error ? signal.reason : new Error("dependency request aborted"));
    if (signal.aborted) abort();
    else signal.addEventListener("abort", abort, { once: true });
  });
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "missing-acquisition-deadline-"));
  configureDemandLedger(join(dir, "demand.jsonl"));
  configureSupplyBlockLedger(join(dir, "supply-blocks.jsonl"));
  resetDemand({ truncateLedger: true });
  truncateSupplyBlockLedger();
  process.env.MISSING_ACQUISITION_DEPENDENCY_TIMEOUT_MS = "150";
});

afterEach(() => {
  delete process.env.MISSING_ACQUISITION_DEPENDENCY_TIMEOUT_MS;
  configureDemandLedger(undefined);
  configureSupplyBlockLedger(undefined);
  resetDemand();
  rmSync(dir, { recursive: true, force: true });
});

describe("RAL2 autonomous acquisition dependency deadlines", () => {
  it("turns a hung provider-directory request into a structured backoff instead of hanging the control plane", async () => {
    recordDemand("Get bounded directory data", "bounded_directory_data", "mcp");

    const started = Date.now();
    const result = await runThetaOrchestrator({
      timeoutMs: 1_000,
      dependencyFetchFn: abortableHungFetch,
    });
    const elapsed = Date.now() - started;

    expect(elapsed).toBeLessThan(1_500);
    expect(result.status).toBe("no_candidates");
    expect(result.reason).toContain("Acquisition dependency timed out");
    expect(result.trace).toContainEqual(expect.objectContaining({ stage: "discovery", status: "error" }));
    expect(result.trace).toContainEqual(expect.objectContaining({ stage: "opportunity", status: "backoff_recorded" }));
  });

  it("bounds a hung OpenAPI spec request and returns rejected with backoff", async () => {
    const intent = "Get bounded OpenAPI data";
    recordDemand(intent, "bounded_openapi_data", "mcp");
    const lead: ProviderDiscoveryCandidate = {
      source: "apis_guru",
      directory_id: "bounded.example:1.0",
      provider: "Bounded Example API",
      title: "Bounded OpenAPI data",
      description: "Get bounded OpenAPI data",
      spec_url: "https://bounded.example/openapi.json",
      directory_url: null,
      openapi_version: "3.0.0",
      score: 1,
      matched_terms: ["bounded", "openapi"],
      demand_intent: intent,
      normalized_intent: "get bounded openapi data",
    };

    const started = Date.now();
    const result = await runThetaOrchestrator({
      timeoutMs: 1_000,
      discoverFn: async () => [lead],
      dependencyFetchFn: abortableHungFetch,
    });
    const elapsed = Date.now() - started;

    expect(elapsed).toBeLessThan(1_500);
    expect(result.status).toBe("rejected");
    expect(result.reason).toContain("Acquisition dependency timed out");
    expect(result.trace).toContainEqual(expect.objectContaining({ stage: "compile", status: "error", provider: "Bounded Example API" }));
    expect(result.trace).toContainEqual(expect.objectContaining({ stage: "opportunity", status: "backoff_recorded" }));
  });
});
