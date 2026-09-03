import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { configureDemandLedger, readDemandEvents } from "../src/runtime/demandLedger.js";
import { demandVerificationInputs, recordDemand, resetDemand } from "../src/runtime/discovery.js";
import { runThetaOrchestrator } from "../src/runtime/orchestrator.js";
import { configureSupplyBlockLedger, truncateSupplyBlockLedger } from "../src/runtime/supplyBlockLedger.js";
import type { ProviderDiscoveryCandidate } from "../src/runtime/providerDiscovery.js";
import type { SupplyCandidate } from "../src/runtime/acquisition.js";

const intent = "Resolve a caller-evidence country code";
const capability = "ral2_caller_evidence_country";

const lead: ProviderDiscoveryCandidate = {
  source: "apis_guru",
  directory_id: "example.test:1.0",
  provider: "Example Provider",
  title: "Country lookup",
  description: "Resolve country information by code",
  spec_url: "https://example.test/openapi.json",
  directory_url: null,
  openapi_version: "3.0.0",
  score: 1,
  matched_terms: ["country", "code"],
  demand_intent: intent,
  normalized_intent: "resolve a caller evidence country code",
};

const openApiSpec = {
  openapi: "3.0.0",
  servers: [{ url: "https://example.test" }],
  paths: {
    "/country/{code}": {
      get: {
        operationId: "getCountryByCode",
        summary: "Get country by code",
        parameters: [{ name: "code", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": {
            description: "ok",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["name"],
                  properties: { name: { type: "string" }, code: { type: "string" } },
                },
              },
            },
          },
        },
      },
    },
  },
};

let dir = "";
let originalFetch: typeof globalThis.fetch;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "missing-ral2-caller-evidence-"));
  configureDemandLedger(join(dir, "demand.jsonl"));
  configureSupplyBlockLedger(join(dir, "supply-blocks.jsonl"));
  resetDemand({ truncateLedger: true });
  truncateSupplyBlockLedger();
  originalFetch = globalThis.fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  configureDemandLedger(undefined);
  configureSupplyBlockLedger(undefined);
  resetDemand();
  rmSync(dir, { recursive: true, force: true });
});

describe("RAL2 caller input evidence", () => {
  it("persists two distinct external caller inputs and feeds them into autonomous compilation", async () => {
    recordDemand(intent, capability, "mcp", { code: "CR" });
    recordDemand(intent, capability, "mcp", { code: "JP" });

    expect(demandVerificationInputs(lead.normalized_intent, capability, 2)).toEqual([{ code: "CR" }, { code: "JP" }]);
    expect(readDemandEvents().map(event => event.example_input)).toEqual([{ code: "CR" }, { code: "JP" }]);

    globalThis.fetch = async input => {
      expect(String(input)).toBe(lead.spec_url);
      return new Response(JSON.stringify(openApiSpec), { status: 200, headers: { "content-type": "application/json" } });
    };

    const captured: SupplyCandidate[] = [];
    const result = await runThetaOrchestrator({
      discoverFn: async opportunity => {
        expect(opportunity.requested_capability).toBe(capability);
        return [lead];
      },
      acquireFn: (async (candidate: SupplyCandidate) => {
        captured.push(candidate);
        return {
          status: "promoted",
          verification: { recipe_fingerprint: "caller-evidence-fingerprint", reason: null },
          promotion: { reason: null },
        } as any;
      }) as any,
    });

    expect(result.status).toBe("promoted");
    expect(result.recipe_fingerprint).toBe("caller-evidence-fingerprint");
    expect(result.trace).toContainEqual(expect.objectContaining({ stage: "opportunity", status: "caller_evidence_ready", detail: "2" }));
    expect(captured).toHaveLength(1);
    expect(captured[0]!.capability).toBe(capability);
    expect(captured[0]!.verification_inputs).toEqual([{ code: "CR" }, { code: "JP" }]);
  });

  it("rejects sensitive caller input instead of persisting it", () => {
    expect(() => recordDemand(intent, capability, "mcp", { api_key: "do-not-store" })).toThrow(/example_input/);
    expect(readDemandEvents()).toEqual([]);
  });
});
