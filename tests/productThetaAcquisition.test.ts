import { createServer, type Server } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  acquireVerifiedSupplyCandidate,
  candidateFingerprint,
  rankSupplyOpportunities,
  verifySupplyCandidate,
  type SupplyCandidate,
} from "../src/runtime/acquisition.js";
import { recordDemand, resetDemand } from "../src/runtime/discovery.js";
import { resolveCapability } from "../src/runtime/executor.js";
import { recipesForCapability, reloadPromotedRecipesFromLedger, resetPromotedRecipesForTest } from "../src/runtime/recipes.js";
import { configureSupplyLedger, truncateSupplyLedger } from "../src/runtime/supplyLedger.js";

let server: Server;
let baseUrl = "";
const tempDir = mkdtempSync(join(tmpdir(), "missing-theta-"));
const ledgerPath = join(tempDir, "supply.jsonl");

beforeAll(async () => {
  configureSupplyLedger(ledgerPath);
  server = createServer((req, res) => {
    const match = /^\/vat\/([^/]+)$/.exec(req.url ?? "");
    if (!match) {
      res.writeHead(404, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "not_found" }));
      return;
    }
    const vat = decodeURIComponent(match[1]);
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ valid: vat.startsWith("FI"), country: "FI", normalized: vat.replace(/\s/g, "") }));
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Expected TCP address");
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterEach(() => {
  resetDemand();
  resetPromotedRecipesForTest();
  truncateSupplyLedger();
});

afterAll(async () => {
  configureSupplyLedger(null);
  rmSync(tempDir, { recursive: true, force: true });
  await new Promise<void>(resolve => server.close(() => resolve()));
});

function candidate(overrides: Partial<SupplyCandidate> = {}): SupplyCandidate {
  return {
    candidate_id: "theta_finnish_vat_fixture",
    demand_intent: "Validate this Finnish VAT number",
    capability: "finnish_vat_validation",
    family: "compliance",
    provider: "Theta fixture",
    evidence_url: `${baseUrl}/docs`,
    method: "GET",
    base_url: baseUrl,
    path_template: "/vat/{vat_number}",
    path_bindings: { vat_number: "$input.vat_number" },
    query_bindings: {},
    projection: {
      vat_number: { op: "INPUT", name: "vat_number" },
      valid: { op: "FIELD", path: "valid" },
      country: { op: "FIELD", path: "country" },
    },
    required: ["vat_number", "valid", "country"],
    verification_inputs: [{ vat_number: "FI12345678" }, { vat_number: "FI87654321" }],
    ...overrides,
  };
}

describe("MISSING Product Theta demand-to-supply acquisition", () => {
  it("ranks repeated unresolved demand ahead of one-off demand", () => {
    recordDemand("Validate this Finnish VAT number", null, "a2a");
    recordDemand("Validate this Finnish VAT number", null, "mcp");
    recordDemand("Find a fictional registry record", null, "a2a");

    const opportunities = rankSupplyOpportunities();
    expect(opportunities[0]?.normalized_intent).toBe("validate this finnish vat number");
    expect(opportunities[0]?.observations).toBe(2);
    expect(opportunities[0]?.source_diversity).toBe(2);
    expect(opportunities[0]?.priority_score).toBeGreaterThan(opportunities[1]?.priority_score ?? 0);
  });

  it("compiles a deterministic recipe fingerprint", () => {
    const a = candidate();
    const b = candidate({ path_bindings: { vat_number: "$input.vat_number" }, query_bindings: {} });
    expect(candidateFingerprint(a)).toBe(candidateFingerprint(b));
    expect(candidateFingerprint(a)).toMatch(/^[a-f0-9]{64}$/);
  });

  it("requires at least two live replay inputs", async () => {
    await expect(verifySupplyCandidate(candidate({ verification_inputs: [{ vat_number: "FI12345678" }] })))
      .rejects.toThrow("At least two verification_inputs");
  });

  it("rejects a candidate when any live replay fails and never registers it", async () => {
    const bad = candidate({ candidate_id: "theta_bad_fixture", path_template: "/missing/{vat_number}" });
    const result = await acquireVerifiedSupplyCandidate(bad);
    expect(result.status).toBe("rejected");
    expect(result.verification.status).toBe("rejected");
    expect(result.promotion.promoted).toBe(false);
    expect(recipesForCapability("finnish_vat_validation")).toHaveLength(0);
  });

  it("promotes only after all replays succeed and makes the capability executable", async () => {
    const result = await acquireVerifiedSupplyCandidate(candidate());
    expect(result.status).toBe("promoted");
    expect(result.verification.status).toBe("verified");
    expect(result.verification.runs).toHaveLength(2);
    expect(result.verification.runs.every(run => run.attempt.ok)).toBe(true);
    expect(recipesForCapability("finnish_vat_validation")).toHaveLength(1);

    const execution = await resolveCapability("finnish_vat_validation", { vat_number: "FI11223344" });
    expect(execution.status).toBe("resolved");
    if (execution.status === "resolved") {
      expect(execution.output).toEqual({ vat_number: "FI11223344", valid: true, country: "FI" });
    }
  });

  it("rehydrates a promoted recipe from the durable supply ledger", async () => {
    const result = await acquireVerifiedSupplyCandidate(candidate());
    expect(result.status).toBe("promoted");
    const fingerprint = result.verification.recipe_fingerprint;

    resetPromotedRecipesForTest();
    expect(recipesForCapability("finnish_vat_validation")).toHaveLength(0);
    reloadPromotedRecipesFromLedger();

    const restored = recipesForCapability("finnish_vat_validation");
    expect(restored).toHaveLength(1);
    expect(restored[0]?.recipe_fingerprint).toBe(fingerprint);
    expect(restored[0]?.verification.source).toBe("product_live");
  });
});
