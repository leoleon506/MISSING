import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  configureDistributedMoneyExecForTest,
  type DistributedPaymentRecord,
} from "../src/runtime/distributedMoney.js";
import {
  configureX402Fetch,
  verifyX402Payment,
  type X402Requirements,
} from "../src/runtime/x402.js";

const REQUIREMENTS: X402Requirements = {
  scheme: "exact",
  network: "eip155:8453",
  amount: "5000",
  asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  payTo: "0xe483b6Ac4aCE45eB37508E2049fdC98872893B7D",
  maxTimeoutSeconds: 60,
  extra: { name: "USD Coin", version: "2" },
};

function signature() {
  return Buffer.from(JSON.stringify({
    x402Version: 2,
    payload: { authorization: { validBefore: "1" }, signature: "0xdeadbeef" },
  }), "utf8").toString("base64url");
}

function recordFor(paymentHash: string, overrides: Partial<DistributedPaymentRecord> = {}): DistributedPaymentRecord {
  const now = new Date().toISOString();
  return {
    payment_hash: paymentHash,
    request_hash: "request-hash",
    execution_id: "execution-id",
    capability: "canadian_holiday_metadata_by_id",
    state: "settling",
    created_at: now,
    updated_at: now,
    reason: "settlement_proof_pending:receipt_block_ahead_of_head",
    transaction_reference: `0x${"a".repeat(64)}`,
    response_status: null,
    response_headers_json: null,
    response_body_json: null,
    customer_price_microusd: 5000,
    provider_cost_microusd: 0,
    gross_margin_microusd: 5000,
    provider_attempts: 1,
    unknown_provider_cost_attempts: 0,
    resolution_json: JSON.stringify({ status: "resolved", recipe_fingerprint: "fp" }),
    network: "eip155:8453",
    provider_recipe_fingerprint: "fp",
    provider_recovery_mode: "read_only",
    provider_idempotency_key: null,
    settlement_intent_id: "intent-id",
    lease_token: null,
    lease_fence: 1,
    lease_expires_at: null,
    recovery_protocol_version: 1,
    ...overrides,
  };
}

function fakeDistributedMoney(row: DistributedPaymentRecord | null) {
  return async (sql: string, vars: Record<string, string> = {}) => {
    if (sql.includes("SELECT row_to_json(x)")) {
      return {
        stdout: JSON.stringify({
          payments: row ? 1 : 0,
          request_bound: row?.request_hash ? 1 : 0,
          legacy_unbound: row && !row.request_hash ? 1 : 0,
          reserved: row?.state === "reserved" ? 1 : 0,
          executing: row?.state === "executing" ? 1 : 0,
          provider_done: row?.state === "provider_done" ? 1 : 0,
          settling: row?.state === "settling" ? 1 : 0,
          settled: row?.state === "settled" ? 1 : 0,
          ambiguous: row?.state === "ambiguous" ? 1 : 0,
          failed: row?.state === "failed" ? 1 : 0,
        }) + "\n",
        stderr: "",
      };
    }
    if (sql.includes("SELECT row_to_json(p)")) {
      return {
        stdout: row && vars.payment_hash === row.payment_hash ? JSON.stringify(row) + "\n" : "",
        stderr: "",
      };
    }
    return { stdout: "", stderr: "" };
  };
}

afterEach(() => {
  delete process.env.MISSING_DISTRIBUTED_MONEY_ENABLED;
  delete process.env.MISSING_X402_FACILITATOR_URL;
  configureDistributedMoneyExecForTest(undefined);
  configureX402Fetch();
  vi.restoreAllMocks();
});

describe("Product Kappa.5.13 expired authorization settlement recovery", () => {
  it("accepts the exact original signature for proof-only recovery when a transaction is already durable", async () => {
    process.env.MISSING_DISTRIBUTED_MONEY_ENABLED = "1";
    process.env.MISSING_X402_FACILITATOR_URL = "https://facilitator.test";

    const paymentSignature = signature();
    const paymentHash = createHash("sha256").update(paymentSignature, "utf8").digest("hex");
    configureDistributedMoneyExecForTest(fakeDistributedMoney(recordFor(paymentHash)));

    const facilitator = vi.fn(async () => {
      throw new Error("facilitator must not be called for a known settlement transaction");
    });
    configureX402Fetch(facilitator as typeof fetch);

    await expect(verifyX402Payment({ paymentSignature, requirements: REQUIREMENTS })).resolves.toMatchObject({
      valid: true,
      payer: null,
      paymentHash,
      recovery: "known_settlement",
    });
    expect(facilitator).not.toHaveBeenCalled();
  });

  it("does not bypass facilitator verification when settling has no known transaction", async () => {
    process.env.MISSING_DISTRIBUTED_MONEY_ENABLED = "1";
    process.env.MISSING_X402_FACILITATOR_URL = "https://facilitator.test";

    const paymentSignature = signature();
    const paymentHash = createHash("sha256").update(paymentSignature, "utf8").digest("hex");
    configureDistributedMoneyExecForTest(fakeDistributedMoney(recordFor(paymentHash, { transaction_reference: null })));

    const facilitator = vi.fn(async () => new Response(JSON.stringify({
      isValid: false,
      invalidReason: "invalid_exact_evm_payload_authorization_valid_before",
    }), { status: 200, headers: { "content-type": "application/json" } }));
    configureX402Fetch(facilitator as typeof fetch);

    await expect(verifyX402Payment({ paymentSignature, requirements: REQUIREMENTS })).resolves.toEqual({
      valid: false,
      reason: "invalid_exact_evm_payload_authorization_valid_before",
    });
    expect(facilitator).toHaveBeenCalledTimes(1);
  });

  it("does not bypass facilitator verification for any terminal or pre-settlement state", async () => {
    process.env.MISSING_DISTRIBUTED_MONEY_ENABLED = "1";
    process.env.MISSING_X402_FACILITATOR_URL = "https://facilitator.test";

    const paymentSignature = signature();
    const paymentHash = createHash("sha256").update(paymentSignature, "utf8").digest("hex");
    configureDistributedMoneyExecForTest(fakeDistributedMoney(recordFor(paymentHash, { state: "provider_done" })));

    const facilitator = vi.fn(async () => new Response(JSON.stringify({
      isValid: false,
      invalidReason: "invalid_exact_evm_payload_authorization_valid_before",
    }), { status: 200, headers: { "content-type": "application/json" } }));
    configureX402Fetch(facilitator as typeof fetch);

    await expect(verifyX402Payment({ paymentSignature, requirements: REQUIREMENTS })).resolves.toEqual({
      valid: false,
      reason: "invalid_exact_evm_payload_authorization_valid_before",
    });
    expect(facilitator).toHaveBeenCalledTimes(1);
  });
});
