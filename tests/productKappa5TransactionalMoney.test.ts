import { createHash } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { configureAgentRankLedger, resetAgentRankForTest } from "../src/runtime/agentRank.js";
import { handleAgentPaidResolution } from "../src/runtime/agentPayments.js";
import { configureEconomicsLedger } from "../src/runtime/economics.js";
import { resetRuntimeHealth } from "../src/runtime/executor.js";
import { configureProviderCostLedger, truncateProviderCostLedger } from "../src/runtime/providerCostLedger.js";
import { recipesForCapability } from "../src/runtime/recipes.js";
import {
  configureTransactionalMoney,
  reserveTransactionalPayment,
  transactionalMoneySnapshot,
  transactionalPayment,
  truncateTransactionalMoney,
} from "../src/runtime/transactionalMoney.js";
import { configureX402Fetch } from "../src/runtime/x402.js";
import { configureX402Ledger, truncateX402Ledger } from "../src/runtime/x402Ledger.js";

let tempDir: string | null = null;

function paymentSignature() {
  return Buffer.from(JSON.stringify({
    x402Version: 2,
    accepted: {
      scheme: "exact",
      network: "eip155:84532",
      asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
      amount: "5000",
      payTo: "0x209693Bc6afc0C5328bA36FaF03C514EF312287C",
      maxTimeoutSeconds: 60,
      extra: { name: "USDC", version: "2" },
    },
    payload: { signature: "0xkappa5", authorization: { from: "0xpayer" } },
  }), "utf8").toString("base64url");
}

function setup() {
  tempDir = mkdtempSync(join(tmpdir(), "missing-kappa5-"));
  configureAgentRankLedger(null);
  configureEconomicsLedger(join(tempDir, "economics.jsonl"));
  configureProviderCostLedger(join(tempDir, "provider-costs.jsonl"));
  configureX402Ledger(join(tempDir, "x402.jsonl"));
  configureTransactionalMoney(join(tempDir, "money.sqlite"));
  truncateProviderCostLedger();
  truncateX402Ledger();
  resetAgentRankForTest();
  resetRuntimeHealth();

  process.env.MISSING_AGENT_PAYMENTS_ENABLED = "1";
  process.env.MISSING_X402_ENABLED = "1";
  process.env.MISSING_X402_NETWORK = "eip155:84532";
  process.env.MISSING_X402_ASSET = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
  process.env.MISSING_X402_PAY_TO = "0x209693Bc6afc0C5328bA36FaF03C514EF312287C";
  process.env.MISSING_X402_FACILITATOR_URL = "https://facilitator.test";
  process.env.MISSING_ECONOMICS_ENFORCEMENT_ENABLED = "1";
  process.env.MISSING_MIN_MARGIN_MICROUSD = "1000";
  process.env.MISSING_TRANSACTIONAL_MONEY_ENABLED = "1";
  process.env.MISSING_TRANSACTIONAL_RESPONSE_CACHE_ENABLED = "1";

  const recipes = recipesForCapability("country_alpha_metadata");
  const warnely = recipes.find(recipe => recipe.provider === "Warnely")!;
  const countries = recipes.find(recipe => recipe.provider === "countries.dev")!;
  process.env.MISSING_ECONOMICS_JSON = JSON.stringify({
    recipes: {
      [warnely.recipe_fingerprint]: { provider_cost_microusd: 1000, customer_price_microusd: 5000 },
      [countries.recipe_fingerprint]: { provider_cost_microusd: 3000, customer_price_microusd: 5000 },
    },
  });
  truncateTransactionalMoney();
}

afterEach(() => {
  vi.unstubAllGlobals();
  configureX402Fetch();
  for (const key of [
    "MISSING_AGENT_PAYMENTS_ENABLED", "MISSING_X402_ENABLED", "MISSING_X402_NETWORK",
    "MISSING_X402_ASSET", "MISSING_X402_PAY_TO", "MISSING_X402_FACILITATOR_URL",
    "MISSING_ECONOMICS_ENFORCEMENT_ENABLED", "MISSING_MIN_MARGIN_MICROUSD",
    "MISSING_ECONOMICS_JSON", "MISSING_TRANSACTIONAL_MONEY_ENABLED",
    "MISSING_TRANSACTIONAL_RESPONSE_CACHE_ENABLED",
  ]) delete process.env[key];
  configureTransactionalMoney(null);
  configureProviderCostLedger(null);
  configureX402Ledger(null);
  configureEconomicsLedger(null);
  configureAgentRankLedger(null);
  resetAgentRankForTest();
  resetRuntimeHealth();
  if (tempDir) rmSync(tempDir, { recursive: true, force: true });
  tempDir = null;
});

describe("Product Kappa.5 transactional money core", () => {
  it("returns the persisted successful response on retry without re-verifying or re-executing", async () => {
    setup();
    const facilitator = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith("/verify")) return new Response(JSON.stringify({ isValid: true, payer: "0xpayer" }), { status: 200 });
      if (url.endsWith("/settle")) return new Response(JSON.stringify({ success: true, payer: "0xpayer", transaction: `0x${"b".repeat(64)}`, network: "eip155:84532" }), { status: 200 });
      throw new Error(`Unexpected facilitator URL ${url}`);
    });
    configureX402Fetch(facilitator as typeof fetch);

    const provider = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("warnely.com/api/v1/countries/NZ")) {
        return new Response(JSON.stringify({ country: { name: "New Zealand", region: "Oceania" } }), { status: 200 });
      }
      throw new Error(`Unexpected provider URL ${url}`);
    });
    vi.stubGlobal("fetch", provider);

    const args = {
      request: { capability: "country_alpha_metadata", input: { country_code: "NZ" } },
      paymentSignature: paymentSignature(),
      resourceUrl: "https://missing.test/v1/agent/resolve",
    };

    const first = await handleAgentPaidResolution(args);
    expect(first.status).toBe(200);
    expect(facilitator).toHaveBeenCalledTimes(2);
    expect(provider).toHaveBeenCalledTimes(1);
    expect(transactionalMoneySnapshot()).toMatchObject({ payments: 1, settled: 1, settling: 0 });

    const second = await handleAgentPaidResolution(args);
    expect(second).toEqual(first);
    expect(facilitator).toHaveBeenCalledTimes(2);
    expect(provider).toHaveBeenCalledTimes(1);
  });

  it("leaves ambiguous settlement in settling and blocks retry before facilitator/provider", async () => {
    setup();
    const facilitator = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith("/verify")) return new Response(JSON.stringify({ isValid: true, payer: "0xpayer" }), { status: 200 });
      if (url.endsWith("/settle")) throw new Error("facilitator timeout after submission");
      throw new Error(`Unexpected facilitator URL ${url}`);
    });
    configureX402Fetch(facilitator as typeof fetch);
    const provider = vi.fn(async () => new Response(JSON.stringify({ country: { name: "New Zealand", region: "Oceania" } }), { status: 200 }));
    vi.stubGlobal("fetch", provider);

    const args = {
      request: { capability: "country_alpha_metadata", input: { country_code: "NZ" } },
      paymentSignature: paymentSignature(),
      resourceUrl: "https://missing.test/v1/agent/resolve",
    };

    const first = await handleAgentPaidResolution(args);
    expect(first.status).toBe(503);
    expect(first.body).toMatchObject({ error: "payment_settlement_reconciliation_required" });
    expect(transactionalMoneySnapshot()).toMatchObject({ payments: 1, settling: 1, settled: 0 });
    expect(facilitator).toHaveBeenCalledTimes(2);
    expect(provider).toHaveBeenCalledTimes(1);

    const second = await handleAgentPaidResolution(args);
    expect(second.status).toBe(503);
    expect(second.body).toMatchObject({ error: "payment_settlement_reconciliation_required", prior_state: "settling" });
    expect(facilitator).toHaveBeenCalledTimes(2);
    expect(provider).toHaveBeenCalledTimes(1);
  });

  it("enforces one database reservation per payment hash", () => {
    setup();
    const hash = createHash("sha256").update(paymentSignature(), "utf8").digest("hex");
    const first = reserveTransactionalPayment({ paymentHash: hash, executionId: "execution-a", capability: "country_alpha_metadata" });
    const second = reserveTransactionalPayment({ paymentHash: hash, executionId: "execution-b", capability: "country_alpha_metadata" });
    expect(first.reserved).toBe(true);
    expect(second.reserved).toBe(false);
    expect(transactionalPayment(hash)?.execution_id).toBe("execution-a");
  });
});
