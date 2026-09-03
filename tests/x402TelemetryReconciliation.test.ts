import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { configureEconomicsLedger } from "../src/runtime/economics.js";
import { configureX402Ledger, x402Events, x402Snapshot } from "../src/runtime/x402Ledger.js";
import {
  configureSettledX402TelemetryRowsForTest,
  reconcileSettledX402Telemetry,
} from "../src/runtime/x402TelemetryReconciliation.js";

const FINGERPRINT = "2397865423586696accd6acb37c134ff1d9b60c107807a8f34449646e51f89e3";
let dir: string | null = null;

afterEach(() => {
  configureSettledX402TelemetryRowsForTest();
  configureX402Ledger(undefined);
  configureEconomicsLedger(undefined);
  delete process.env.MISSING_ECONOMICS_JSON;
  if (dir) rmSync(dir, { recursive: true, force: true });
  dir = null;
});

describe("RAL1 post-GO x402 telemetry reconciliation", () => {
  it("backfills settled rows once and never duplicates a payment hash", async () => {
    dir = mkdtempSync(join(tmpdir(), "missing-x402-telemetry-"));
    configureX402Ledger(join(dir, "x402.jsonl"));
    configureEconomicsLedger(join(dir, "economics.jsonl"));
    process.env.MISSING_ECONOMICS_JSON = JSON.stringify({
      recipes: {
        [FINGERPRINT]: { provider_cost_microusd: 0, customer_price_microusd: 10000 },
      },
    });

    configureSettledX402TelemetryRowsForTest(async () => [
      {
        payment_hash: "payment-a",
        transaction_reference: `0x${"a".repeat(64)}`,
        capability: "country_alpha_metadata",
        network: "eip155:8453",
        customer_price_microusd: 10000,
        provider_cost_microusd: 0,
        provider_recipe_fingerprint: FINGERPRINT,
      },
      {
        payment_hash: "payment-b",
        transaction_reference: `0x${"b".repeat(64)}`,
        capability: "country_alpha_metadata",
        network: "eip155:8453",
        customer_price_microusd: "10000",
        provider_cost_microusd: "0",
        provider_recipe_fingerprint: FINGERPRINT,
      },
    ]);

    await expect(reconcileSettledX402Telemetry()).resolves.toMatchObject({
      scanned: 2,
      eligible: 2,
      already_recorded: 0,
      recorded: 2,
      skipped: 0,
      error: null,
    });
    expect(x402Events().map(event => event.payment_hash)).toEqual(["payment-a", "payment-b"]);
    expect(x402Snapshot()).toMatchObject({
      settled_resolutions: 2,
      realized_margin_resolutions: 2,
      customer_revenue_microusd: 20000,
      known_provider_cost_microusd: 0,
      known_gross_margin_microusd: 20000,
    });

    await expect(reconcileSettledX402Telemetry()).resolves.toMatchObject({
      scanned: 2,
      eligible: 0,
      already_recorded: 2,
      recorded: 0,
      skipped: 0,
      error: null,
    });
    expect(x402Events()).toHaveLength(2);
  });

  it("skips incomplete rows instead of inventing accounting evidence", async () => {
    dir = mkdtempSync(join(tmpdir(), "missing-x402-telemetry-"));
    configureX402Ledger(join(dir, "x402.jsonl"));
    configureEconomicsLedger(null);
    configureSettledX402TelemetryRowsForTest(async () => [{
      payment_hash: "payment-incomplete",
      transaction_reference: null,
      capability: "country_alpha_metadata",
      network: "eip155:8453",
      customer_price_microusd: 10000,
      provider_cost_microusd: 0,
      provider_recipe_fingerprint: FINGERPRINT,
    }]);

    await expect(reconcileSettledX402Telemetry()).resolves.toMatchObject({
      scanned: 1,
      eligible: 0,
      recorded: 0,
      skipped: 1,
      error: null,
    });
    expect(x402Events()).toHaveLength(0);
  });
});
