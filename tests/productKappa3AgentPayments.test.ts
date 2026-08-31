import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { configureAgentRankLedger, resetAgentRankForTest } from "../src/runtime/agentRank.js";
import { handleAgentPaidResolution } from "../src/runtime/agentPayments.js";
import { configureEconomicsLedger, economicsSummary, truncateEconomicsLedger } from "../src/runtime/economics.js";
import { resetRuntimeHealth } from "../src/runtime/executor.js";
import { recipesForCapability } from "../src/runtime/recipes.js";
import { configureX402Fetch } from "../src/runtime/x402.js";
import { configureX402Ledger, truncateX402Ledger, x402Snapshot } from "../src/runtime/x402Ledger.js";

let tempDir: string | null = null;

function setup() {
  tempDir = mkdtempSync(join(tmpdir(), "missing-kappa3-"));
  configureAgentRankLedger(null);
  configureEconomicsLedger(join(tempDir, "economics.jsonl"));
  configureX402Ledger(join(tempDir, "x402.jsonl"));
  truncateEconomicsLedger();
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
    payload: { signature: "0xdeadbeef", authorization: { from: "0xpayer" } },
  }), "utf8").toString("base64url");
}

afterEach(() => {
  vi.unstubAllGlobals();
  configureX402Fetch();
  for (const key of [
    "MISSING_AGENT_PAYMENTS_ENABLED", "MISSING_X402_ENABLED", "MISSING_X402_NETWORK",
    "MISSING_X402_ASSET", "MISSING_X402_PAY_TO", "MISSING_X402_FACILITATOR_URL",
    "MISSING_X402_FACILITATOR_BEARER", "MISSING_ECONOMICS_ENFORCEMENT_ENABLED",
    "MISSING_MIN_MARGIN_MICROUSD", "MISSING_ECONOMICS_JSON",
  ]) delete process.env[key];
  configureAgentRankLedger(null);
  configureEconomicsLedger(null);
  configureX402Ledger(null);
  resetAgentRankForTest();
  resetRuntimeHealth();
  if (tempDir) rmSync(tempDir, { recursive: true, force: true });
  tempDir = null;
});

describe("Product Kappa.3 autonomous x402 agent payments", () => {
  it("returns a standards-shaped 402 challenge at the MISSING micro-price", async () => {
    setup();
    const result = await handleAgentPaidResolution({
      request: { capability: "country_alpha_metadata", input: { country_code: "NZ" } },
      resourceUrl: "https://missing.test/v1/agent/resolve",
    });
    expect(result.status).toBe(402);
    expect(result.headers?.["PAYMENT-REQUIRED"]).toBeTruthy();
    const decoded = JSON.parse(Buffer.from(result.headers!["PAYMENT-REQUIRED"], "base64url").toString("utf8"));
    expect(decoded.x402Version).toBe(2);
    expect(decoded.accepts[0].amount).toBe("5000");
    expect(decoded.accepts[0].network).toBe("eip155:84532");
  });

  it("verifies, executes, settles, and records MISSING profit only after settlement", async () => {
    setup();
    const facilitator = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith("/verify")) return new Response(JSON.stringify({ isValid: true, payer: "0xpayer" }), { status: 200 });
      if (url.endsWith("/settle")) return new Response(JSON.stringify({ success: true, payer: "0xpayer", transaction: `0x${"a".repeat(64)}`, network: "eip155:84532" }), { status: 200 });
      throw new Error(`Unexpected facilitator URL ${url}`);
    });
    configureX402Fetch(facilitator as typeof fetch);
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("warnely.com/api/v1/countries/NZ")) return new Response(JSON.stringify({ country: { name: "New Zealand", region: "Oceania" } }), { status: 200 });
      throw new Error(`Unexpected provider URL ${url}`);
    }));

    const result = await handleAgentPaidResolution({
      request: { capability: "country_alpha_metadata", input: { country_code: "NZ" } },
      paymentSignature: paymentSignature(),
      resourceUrl: "https://missing.test/v1/agent/resolve",
    });

    expect(result.status).toBe(200);
    expect(result.headers?.["PAYMENT-RESPONSE"]).toBeTruthy();
    expect(facilitator).toHaveBeenCalledTimes(2);
    expect(x402Snapshot()).toMatchObject({ settled_resolutions: 1, customer_revenue_microusd: 5000, provider_cost_microusd: 1000, gross_margin_microusd: 4000 });
    expect(economicsSummary().gross_margin_microusd).toBe(4000);
  });

  it("does not settle or recognize revenue when provider execution fails", async () => {
    setup();
    const facilitator = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith("/verify")) return new Response(JSON.stringify({ isValid: true, payer: "0xpayer" }), { status: 200 });
      throw new Error("settle must not be called");
    });
    configureX402Fetch(facilitator as typeof fetch);
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("provider down"); }));

    const result = await handleAgentPaidResolution({
      request: { capability: "country_alpha_metadata", input: { country_code: "NZ" } },
      paymentSignature: paymentSignature(),
      resourceUrl: "https://missing.test/v1/agent/resolve",
    });

    expect(result.status).toBe(502);
    expect(facilitator).toHaveBeenCalledTimes(1);
    expect(x402Snapshot().customer_revenue_microusd).toBe(0);
    expect(economicsSummary().resolutions).toBe(0);
  });
});
