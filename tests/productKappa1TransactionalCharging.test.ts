import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { configureAgentRankLedger, resetAgentRankForTest } from "../src/runtime/agentRank.js";
import {
  chargingSnapshot,
  configureChargingLedger,
  quoteCapability,
  resolveCapabilityCharged,
  truncateChargingLedger,
} from "../src/runtime/charging.js";
import { configureEconomicsLedger, economicsSummary, truncateEconomicsLedger } from "../src/runtime/economics.js";
import { resetRuntimeHealth } from "../src/runtime/executor.js";
import { recipesForCapability } from "../src/runtime/recipes.js";

let tempDir: string | null = null;

function setup() {
  tempDir = mkdtempSync(join(tmpdir(), "missing-kappa1-"));
  configureChargingLedger(join(tempDir, "charges.jsonl"));
  configureEconomicsLedger(join(tempDir, "economics.jsonl"));
  truncateChargingLedger();
  truncateEconomicsLedger();
  configureAgentRankLedger(null);
  resetAgentRankForTest();
  resetRuntimeHealth();
  const recipes = recipesForCapability("country_alpha_metadata");
  const warnely = recipes.find(recipe => recipe.provider === "Warnely")!;
  const countries = recipes.find(recipe => recipe.provider === "countries.dev")!;
  process.env.MISSING_ECONOMICS_JSON = JSON.stringify({
    recipes: {
      [warnely.recipe_fingerprint]: { provider_cost_microusd: 1000, customer_price_microusd: 5000 },
      [countries.recipe_fingerprint]: { provider_cost_microusd: 3000, customer_price_microusd: 5000 },
    },
  });
  process.env.MISSING_ECONOMICS_ENFORCEMENT_ENABLED = "1";
  process.env.MISSING_MIN_MARGIN_MICROUSD = "1000";
  process.env.MISSING_TRANSACTIONAL_CHARGING_ENABLED = "1";
}

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.MISSING_ECONOMICS_JSON;
  delete process.env.MISSING_ECONOMICS_ENFORCEMENT_ENABLED;
  delete process.env.MISSING_MIN_MARGIN_MICROUSD;
  delete process.env.MISSING_TRANSACTIONAL_CHARGING_ENABLED;
  delete process.env.MISSING_AGENTRANK_EXPLORATION_ENABLED;
  configureChargingLedger(null);
  configureEconomicsLedger(null);
  configureAgentRankLedger(null);
  resetAgentRankForTest();
  resetRuntimeHealth();
  if (tempDir) rmSync(tempDir, { recursive: true, force: true });
  tempDir = null;
});

describe("Product Kappa.1 transactional charging", () => {
  it("quotes one stable customer price across eligible failover providers", () => {
    setup();
    expect(quoteCapability("country_alpha_metadata")).toEqual({
      status: "quoted",
      capability: "country_alpha_metadata",
      customer_price_microusd: 5000,
      currency: "USD",
      eligible_provider_count: 2,
      minimum_margin_microusd: 1000,
    });
  });

  it("commits a successful resolution exactly once for an idempotency key", async () => {
    setup();
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("warnely.com/api/v1/countries/NZ")) {
        return new Response(JSON.stringify({ country: { name: "New Zealand", region: "Oceania" } }), { status: 200 });
      }
      throw new Error(`Unexpected URL ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const first = await resolveCapabilityCharged({
      idempotencyKey: "agent-request-123",
      capability: "country_alpha_metadata",
      input: { country_code: "NZ" },
    });
    expect(first.status).toBe("resolved");
    expect(first.charge_state).toBe("committed");
    expect(first.customer_price_microusd).toBe(5000);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const second = await resolveCapabilityCharged({
      idempotencyKey: "agent-request-123",
      capability: "country_alpha_metadata",
      input: { country_code: "NZ" },
    });
    expect(second.status).toBe("already_committed");
    expect(second.transaction_id).toBe(first.transaction_id);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    expect(chargingSnapshot()).toMatchObject({
      transactions: 1,
      committed: 1,
      voided: 0,
      customer_revenue_microusd: 5000,
      provider_cost_microusd: 1000,
      gross_margin_microusd: 4000,
    });
    expect(economicsSummary()).toMatchObject({
      resolutions: 1,
      priced_resolutions: 1,
      customer_revenue_microusd: 5000,
      gross_margin_microusd: 4000,
    });
  });

  it("voids a failed execution and does not meter revenue", async () => {
    setup();
    vi.stubGlobal("fetch", vi.fn(async () => new Response("down", { status: 503 })));

    const result = await resolveCapabilityCharged({
      idempotencyKey: "agent-request-fail",
      capability: "country_alpha_metadata",
      input: { country_code: "NZ" },
    });
    expect(result.charge_state).toBe("voided");
    expect(chargingSnapshot()).toMatchObject({ transactions: 1, committed: 0, voided: 1, customer_revenue_microusd: 0 });
    expect(economicsSummary().resolutions).toBe(0);
  });

  it("refuses a charged quote when eligible providers disagree on customer price", () => {
    setup();
    const recipes = recipesForCapability("country_alpha_metadata");
    const warnely = recipes.find(recipe => recipe.provider === "Warnely")!;
    const countries = recipes.find(recipe => recipe.provider === "countries.dev")!;
    process.env.MISSING_ECONOMICS_JSON = JSON.stringify({
      recipes: {
        [warnely.recipe_fingerprint]: { provider_cost_microusd: 1000, customer_price_microusd: 5000 },
        [countries.recipe_fingerprint]: { provider_cost_microusd: 1000, customer_price_microusd: 6000 },
      },
    });

    expect(quoteCapability("country_alpha_metadata")).toMatchObject({ status: "pricing_conflict" });
  });
});
