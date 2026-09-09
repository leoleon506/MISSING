import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  distributedMoneyEnabled: vi.fn(() => true),
  initializeDistributedMoney: vi.fn(async () => ({})),
  distributedPayment: vi.fn(),
  claimDistributedRecovery: vi.fn(),
  settleDistributedPayment: vi.fn(),
  failDistributedPayment: vi.fn(),
  releaseRecoverableDistributedLease: vi.fn(async () => ({ released: true })),
  x402SettlementProof: vi.fn(),
  recordX402Settlement: vi.fn(() => ({ recorded: true, event: {} })),
  x402PaymentResponseHeader: vi.fn(() => "payment-response"),
}));

vi.mock("../src/runtime/distributedMoney.js", () => ({
  CURRENT_DISTRIBUTED_RECOVERY_PROTOCOL_VERSION: 1,
  distributedMoneyDatabaseUrl: vi.fn(() => null),
  distributedMoneyEnabled: mocks.distributedMoneyEnabled,
  initializeDistributedMoney: mocks.initializeDistributedMoney,
  distributedPayment: mocks.distributedPayment,
  claimDistributedRecovery: mocks.claimDistributedRecovery,
  settleDistributedPayment: mocks.settleDistributedPayment,
  failDistributedPayment: mocks.failDistributedPayment,
}));

vi.mock("../src/runtime/recoverableLease.js", () => ({
  releaseRecoverableDistributedLease: mocks.releaseRecoverableDistributedLease,
}));

vi.mock("../src/runtime/x402Reconciliation.js", () => ({
  x402SettlementProof: mocks.x402SettlementProof,
}));

vi.mock("../src/runtime/x402Ledger.js", () => ({
  recordX402Settlement: mocks.recordX402Settlement,
}));

vi.mock("../src/runtime/x402.js", () => ({
  x402PaymentResponseHeader: mocks.x402PaymentResponseHeader,
}));

vi.mock("../src/runtime/recipes.js", () => ({
  VERIFIED_RECIPES: [{
    capability: "canadian_holiday_metadata_by_id",
    provider: "Canada Holidays API",
    recipe_fingerprint: "fp",
  }],
}));

import {
  configureSettlingRecoveryCandidateListerForTest,
  recoverKnownSettlingX402Payment,
  runSettlingRecoveryCycleOnce,
  stopSettlingX402RecoveryWorker,
} from "../src/runtime/settlingRecoveryWorker.js";

const record = {
  payment_hash: "payment-1",
  request_hash: "request-1",
  execution_id: "execution-1",
  capability: "canadian_holiday_metadata_by_id",
  state: "settling",
  created_at: "2026-09-09T00:00:00.000Z",
  updated_at: "2026-09-09T00:00:01.000Z",
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
  resolution_json: JSON.stringify({
    status: "resolved",
    capability: "canadian_holiday_metadata_by_id",
    provider: "Canada Holidays API",
    recipe_fingerprint: "fp",
    output: { holiday: { id: 1 } },
    attempts: [],
  }),
  network: "eip155:8453",
  provider_recipe_fingerprint: "fp",
  provider_recovery_mode: "read_only",
  provider_idempotency_key: null,
  settlement_intent_id: "intent-1",
  lease_token: null,
  lease_fence: 1,
  lease_expires_at: null,
  recovery_protocol_version: 1,
} as const;

beforeEach(() => {
  process.env.MISSING_DISTRIBUTED_MONEY_ENABLED = "1";
  process.env.MISSING_X402_ASSET = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
  process.env.MISSING_X402_PAY_TO = "0xe483b6Ac4aCE45eB37508E2049fdC98872893B7D";
  delete process.env.MISSING_X402_SETTLING_RECOVERY_ENABLED;

  mocks.distributedMoneyEnabled.mockReturnValue(true);
  mocks.initializeDistributedMoney.mockResolvedValue({});
  mocks.distributedPayment.mockReset();
  mocks.claimDistributedRecovery.mockReset();
  mocks.settleDistributedPayment.mockReset();
  mocks.failDistributedPayment.mockReset();
  mocks.releaseRecoverableDistributedLease.mockClear();
  mocks.x402SettlementProof.mockReset();
  mocks.recordX402Settlement.mockClear();
  mocks.x402PaymentResponseHeader.mockClear();

  configureSettlingRecoveryCandidateListerForTest(async () => [record.payment_hash]);
});

afterEach(async () => {
  delete process.env.MISSING_DISTRIBUTED_MONEY_ENABLED;
  delete process.env.MISSING_X402_ASSET;
  delete process.env.MISSING_X402_PAY_TO;
  delete process.env.MISSING_X402_SETTLING_RECOVERY_ENABLED;
  configureSettlingRecoveryCandidateListerForTest();
  await stopSettlingX402RecoveryWorker();
});

describe("RAL2 autonomous known-settlement recovery", () => {
  it("keeps a transient proof pending, then settles the same durable transaction on a later cycle", async () => {
    mocks.distributedPayment.mockResolvedValue(record);
    mocks.claimDistributedRecovery.mockResolvedValue({
      claimed: true,
      record: { ...record, lease_token: "lease", lease_fence: 2 },
      leaseFence: 2,
    });
    mocks.x402SettlementProof
      .mockResolvedValueOnce({ state: "pending", reason: "receipt_block_ahead_of_head" })
      .mockResolvedValueOnce({ state: "verified", confirmations: 12, required_confirmations: 12 });
    mocks.settleDistributedPayment.mockResolvedValue({ changed: true, record: { ...record, state: "settled" } });

    const first = await runSettlingRecoveryCycleOnce();
    expect(first).toMatchObject({ scanned: 1, claimed: 1, pending: 1, settled: 0 });
    expect(mocks.releaseRecoverableDistributedLease).toHaveBeenCalledTimes(1);
    expect(mocks.settleDistributedPayment).not.toHaveBeenCalled();

    const second = await runSettlingRecoveryCycleOnce();
    expect(second).toMatchObject({ scanned: 1, claimed: 1, pending: 0, settled: 1 });
    expect(mocks.x402SettlementProof).toHaveBeenCalledTimes(2);
    expect(mocks.settleDistributedPayment).toHaveBeenCalledTimes(1);
    expect(mocks.recordX402Settlement).toHaveBeenCalledTimes(1);
  });

  it("does nothing when another recovery owner wins the durable lease", async () => {
    mocks.distributedPayment.mockResolvedValue(record);
    mocks.claimDistributedRecovery.mockResolvedValue({ claimed: false, record: null, leaseFence: null });

    await expect(recoverKnownSettlingX402Payment(record.payment_hash)).resolves.toBe("skipped");
    expect(mocks.x402SettlementProof).not.toHaveBeenCalled();
    expect(mocks.settleDistributedPayment).not.toHaveBeenCalled();
  });

  it("fails closed when canonical proof definitively rejects the known transaction", async () => {
    mocks.distributedPayment.mockResolvedValue(record);
    mocks.claimDistributedRecovery.mockResolvedValue({
      claimed: true,
      record: { ...record, lease_token: "lease", lease_fence: 2 },
      leaseFence: 2,
    });
    mocks.x402SettlementProof.mockResolvedValue({ state: "failed", reason: "amount_mismatch" });
    mocks.failDistributedPayment.mockResolvedValue({ changed: true, record: { ...record, state: "failed" } });

    await expect(recoverKnownSettlingX402Payment(record.payment_hash)).resolves.toBe("failed");
    expect(mocks.failDistributedPayment).toHaveBeenCalledWith(expect.objectContaining({
      paymentHash: record.payment_hash,
      executionId: record.execution_id,
      from: "settling",
      reason: "settlement_proof_amount_mismatch",
      leaseFence: 2,
    }));
    expect(mocks.settleDistributedPayment).not.toHaveBeenCalled();
  });
});
