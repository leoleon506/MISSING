import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  closeDistributedMoney,
  distributedMoneySnapshot,
  distributedPayment,
  initializeDistributedMoney,
  markDistributedPaymentSettling,
  markDistributedSettlementPending,
  reserveDistributedPayment,
  settleDistributedPayment,
  truncateDistributedMoney,
} from "../src/runtime/distributedMoney.js";
import { agentRequestHash } from "../src/runtime/requestBinding.js";

const integration = process.env.MISSING_KAPPA56_INTEGRATION === "1";

describe.runIf(integration)("Product Kappa.5.6 native PostgreSQL pooling", () => {
  beforeEach(async () => {
    process.env.MISSING_DISTRIBUTED_MONEY_ENABLED = "1";
    process.env.MISSING_TRANSACTIONAL_RESPONSE_CACHE_ENABLED = "0";
    await initializeDistributedMoney();
    await truncateDistributedMoney();
  });

  afterAll(() => {
    closeDistributedMoney();
  });

  it("preserves atomic cross-connection payment exclusion through pg.Pool", async () => {
    const requestHash = agentRequestHash("country_alpha_metadata", { country_code: "NZ" });
    const attempts = await Promise.all(Array.from({ length: 20 }, (_, index) => reserveDistributedPayment({
      paymentHash: "k56-one-payment",
      requestHash,
      executionId: `k56-exec-${index}`,
      capability: "country_alpha_metadata",
    })));

    expect(attempts.filter(result => result.reserved)).toHaveLength(1);
    const row = await distributedPayment("k56-one-payment");
    expect(row?.request_hash).toBe(requestHash);
    expect(row?.state).toBe("reserved");
    expect(distributedMoneySnapshot()).toMatchObject({
      backend: "postgres-native",
      ready: true,
      payments: 1,
      request_bound: 1,
      legacy_unbound: 0,
      reserved: 1,
    });
    expect(distributedMoneySnapshot().pool_total).toBeGreaterThan(0);
  });

  it("keeps the reserved to settling to settled state machine unchanged", async () => {
    const requestHash = agentRequestHash("country_alpha_metadata", { country_code: "CR" });
    const reserved = await reserveDistributedPayment({
      paymentHash: "k56-state-machine",
      requestHash,
      executionId: "k56-state-exec",
      capability: "country_alpha_metadata",
    });
    expect(reserved.reserved).toBe(true);

    const settling = await markDistributedPaymentSettling({
      paymentHash: "k56-state-machine",
      executionId: "k56-state-exec",
      customerPriceMicrousd: 5000,
      providerCostMicrousd: 1000,
      grossMarginMicrousd: 4000,
      providerAttempts: 1,
      unknownProviderCostAttempts: 0,
      resolution: { status: "resolved", recipe_fingerprint: "k56" },
      network: "eip155:84532",
    });
    expect(settling.record?.state).toBe("settling");

    const pending = await markDistributedSettlementPending({
      paymentHash: "k56-state-machine",
      executionId: "k56-state-exec",
      transactionReference: "0xk56",
      reason: "settlement_pending",
    });
    expect(pending.record?.state).toBe("settling");
    expect(pending.record?.transaction_reference).toBe("0xk56");

    const settled = await settleDistributedPayment({
      paymentHash: "k56-state-machine",
      executionId: "k56-state-exec",
      transactionReference: "0xk56",
      responseStatus: 200,
      responseHeaders: {},
      responseBody: { status: "resolved" },
    });
    expect(settled.record?.state).toBe("settled");
    expect(settled.record?.request_hash).toBe(requestHash);
  });

  it("treats payment identifiers as data rather than SQL", async () => {
    const paymentHash = "k56-'; DROP TABLE missing_x402_payments; --";
    const requestHash = agentRequestHash("country_alpha_metadata", { country_code: "US" });
    const result = await reserveDistributedPayment({
      paymentHash,
      requestHash,
      executionId: "k56-injection-exec",
      capability: "country_alpha_metadata",
    });
    expect(result.reserved).toBe(true);
    expect((await distributedPayment(paymentHash))?.payment_hash).toBe(paymentHash);

    const second = await reserveDistributedPayment({
      paymentHash: "k56-table-still-present",
      requestHash,
      executionId: "k56-table-still-present-exec",
      capability: "country_alpha_metadata",
    });
    expect(second.reserved).toBe(true);
  });
});
