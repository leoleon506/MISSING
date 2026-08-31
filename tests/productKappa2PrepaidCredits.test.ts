import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { configureAgentRankLedger, resetAgentRankForTest } from "../src/runtime/agentRank.js";
import { chargingSnapshot, configureChargingLedger, resolveCapabilityCharged, truncateChargingLedger } from "../src/runtime/charging.js";
import { configureEconomicsLedger, truncateEconomicsLedger } from "../src/runtime/economics.js";
import { resetRuntimeHealth } from "../src/runtime/executor.js";
import { configurePrepaidCreditLedger, creditAccount, creditBalance, truncatePrepaidCreditLedger } from "../src/runtime/prepaidCredits.js";
import { recipesForCapability } from "../src/runtime/recipes.js";

let tempDir: string | null = null;

function setup() {
  tempDir = mkdtempSync(join(tmpdir(), "missing-kappa2-"));
  configureAgentRankLedger(null);
  configureEconomicsLedger(join(tempDir, "economics.jsonl"));
  configureChargingLedger(join(tempDir, "charges.jsonl"));
  configurePrepaidCreditLedger(join(tempDir, "credits.jsonl"));
  truncateEconomicsLedger();
  truncateChargingLedger();
  truncatePrepaidCreditLedger();
  resetAgentRankForTest();
  resetRuntimeHealth();
  process.env.MISSING_TRANSACTIONAL_CHARGING_ENABLED = "1";
  process.env.MISSING_PREPAID_CREDITS_ENABLED = "1";
  process.env.MISSING_ECONOMICS_ENFORCEMENT_ENABLED = "1";
  process.env.MISSING_MIN_MARGIN_MICROUSD = "1000";

  const recipes = recipesForCapability("country_alpha_metadata");
  const warnely = recipes.find(recipe => recipe.provider === "Warnely")!;
  const countries = recipes.find(recipe => recipe.provider === "countries.dev")!;
  process.env.MISSING_ECONOMICS_JSON = JSON.stringify({
    recipes: {
      [warnely.recipe_fingerprint]: { provider_cost_microusd: 1000, customer_price_microusd: 5000 },
      [countries.recipe_fingerprint]: { provider_cost_microusd: 3000, customer_price_microusd: 5000 },
    },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  for (const key of [
    "MISSING_TRANSACTIONAL_CHARGING_ENABLED",
    "MISSING_PREPAID_CREDITS_ENABLED",
    "MISSING_ECONOMICS_ENFORCEMENT_ENABLED",
    "MISSING_MIN_MARGIN_MICROUSD",
    "MISSING_ECONOMICS_JSON",
  ]) delete process.env[key];
  configureAgentRankLedger(null);
  configureEconomicsLedger(null);
  configureChargingLedger(null);
  configurePrepaidCreditLedger(null);
  resetAgentRankForTest();
  resetRuntimeHealth();
  if (tempDir) rmSync(tempDir, { recursive: true, force: true });
  tempDir = null;
});

describe("Product Kappa.2 prepaid credits", () => {
  it("credits an external funding reference exactly once", () => {
    setup();
    const first = creditAccount({ accountId: "acct-1", amountMicrousd: 25_000_000, externalReference: "stripe_pi_123" });
    const duplicate = creditAccount({ accountId: "acct-1", amountMicrousd: 25_000_000, externalReference: "stripe_pi_123" });
    expect(first.credited).toBe(true);
    expect(duplicate.credited).toBe(false);
    expect(creditBalance("acct-1").available_microusd).toBe(25_000_000);
  });

  it("does not call a provider when prepaid credits are insufficient", async () => {
    setup();
    creditAccount({ accountId: "acct-low", amountMicrousd: 4000, externalReference: "fund-low" });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await resolveCapabilityCharged({
      idempotencyKey: "charge-low-1",
      accountId: "acct-low",
      capability: "country_alpha_metadata",
      input: { country_code: "NZ" },
    });

    expect(result.status).toBe("insufficient_credits");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(creditBalance("acct-low").available_microusd).toBe(4000);
    expect(chargingSnapshot().customer_revenue_microusd).toBe(0);
  });

  it("commits customer spend and MISSING gross profit exactly once", async () => {
    setup();
    creditAccount({ accountId: "acct-profit", amountMicrousd: 10_000, externalReference: "fund-profit" });
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("warnely.com/api/v1/countries/NZ")) {
        return new Response(JSON.stringify({ country: { name: "New Zealand", region: "Oceania" } }), { status: 200 });
      }
      throw new Error(`Unexpected URL ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const first = await resolveCapabilityCharged({
      idempotencyKey: "profit-1",
      accountId: "acct-profit",
      capability: "country_alpha_metadata",
      input: { country_code: "NZ" },
    });
    const retry = await resolveCapabilityCharged({
      idempotencyKey: "profit-1",
      accountId: "acct-profit",
      capability: "country_alpha_metadata",
      input: { country_code: "NZ" },
    });

    expect(first.status).toBe("resolved");
    expect(retry.status).toBe("already_committed");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(creditBalance("acct-profit")).toEqual({
      account_id: "acct-profit",
      funded_microusd: 10_000,
      committed_spend_microusd: 5000,
      reserved_microusd: 0,
      available_microusd: 5000,
    });
    const snapshot = chargingSnapshot();
    expect(snapshot.customer_revenue_microusd).toBe(5000);
    expect(snapshot.provider_cost_microusd).toBe(1000);
    expect(snapshot.gross_margin_microusd).toBe(4000);
  });

  it("releases reserved credits when all providers fail", async () => {
    setup();
    creditAccount({ accountId: "acct-release", amountMicrousd: 10_000, externalReference: "fund-release" });
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("provider down"); }));

    const result = await resolveCapabilityCharged({
      idempotencyKey: "release-1",
      accountId: "acct-release",
      capability: "country_alpha_metadata",
      input: { country_code: "NZ" },
    });

    expect(result.status).toBe("provider_error");
    expect(creditBalance("acct-release").available_microusd).toBe(10_000);
    expect(creditBalance("acct-release").reserved_microusd).toBe(0);
    expect(chargingSnapshot().customer_revenue_microusd).toBe(0);
  });
});
