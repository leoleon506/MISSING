import { afterEach, describe, expect, it } from "vitest";
import {
  cachedDistributedResponse,
  configureDistributedMoneyExecForTest,
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

type Row = Record<string, any>;

function fakePostgres() {
  const rows = new Map<string, Row>();
  return {
    rows,
    exec: async (sql: string, vars: Record<string, string> = {}) => {
      if (sql.includes("CREATE TABLE IF NOT EXISTS")) return { stdout: "", stderr: "" };
      if (sql.includes("COUNT(*)::bigint AS payments")) {
        const all = [...rows.values()];
        const count = (state: string) => all.filter(row => row.state === state).length;
        return { stdout: JSON.stringify({
          payments: all.length,
          request_bound: all.filter(row => row.request_hash != null).length,
          legacy_unbound: all.filter(row => row.request_hash == null).length,
          reserved: count("reserved"), settling: count("settling"), settled: count("settled"), failed: count("failed"),
        }) + "\n", stderr: "" };
      }
      if (sql.startsWith("DELETE FROM")) {
        rows.clear();
        return { stdout: "", stderr: "" };
      }
      if (sql.includes("SELECT row_to_json(p)")) {
        const row = rows.get(vars.payment_hash);
        return { stdout: row ? JSON.stringify(row) + "\n" : "", stderr: "" };
      }
      if (sql.includes("INSERT INTO missing_x402_payments")) {
        if (rows.has(vars.payment_hash)) return { stdout: "", stderr: "" };
        const now = new Date().toISOString();
        const row: Row = {
          payment_hash: vars.payment_hash,
          request_hash: vars.request_hash,
          execution_id: vars.execution_id,
          capability: vars.capability,
          state: "reserved",
          created_at: now,
          updated_at: now,
          reason: null,
          transaction_reference: null,
          response_status: null,
          response_headers_json: null,
          response_body_json: null,
          customer_price_microusd: null,
          provider_cost_microusd: null,
          gross_margin_microusd: null,
          provider_attempts: null,
          unknown_provider_cost_attempts: null,
          resolution_json: null,
          network: null,
        };
        rows.set(vars.payment_hash, row);
        return { stdout: JSON.stringify(row) + "\n", stderr: "" };
      }
      const row = rows.get(vars.payment_hash);
      if (!row || row.execution_id !== vars.execution_id) return { stdout: "", stderr: "" };
      if (sql.includes("SET state='settling'")) {
        if (row.state !== "reserved") return { stdout: "", stderr: "" };
        row.state = "settling";
        row.customer_price_microusd = Number(vars.customer_price);
        row.provider_cost_microusd = vars.provider_cost === "" ? null : Number(vars.provider_cost);
        row.gross_margin_microusd = vars.gross_margin === "" ? null : Number(vars.gross_margin);
        row.provider_attempts = Number(vars.provider_attempts);
        row.unknown_provider_cost_attempts = Number(vars.unknown_attempts);
        row.resolution_json = Buffer.from(vars.resolution_b64, "base64").toString("utf8");
        row.network = vars.network;
        return { stdout: JSON.stringify(row) + "\n", stderr: "" };
      }
      if (sql.includes("reason=:'reason',transaction_reference")) {
        if (row.state !== "settling") return { stdout: "", stderr: "" };
        row.reason = vars.reason;
        row.transaction_reference = vars.transaction_reference;
        return { stdout: JSON.stringify(row) + "\n", stderr: "" };
      }
      if (sql.includes("SET state='settled'")) {
        if (row.state !== "settling") return { stdout: "", stderr: "" };
        row.state = "settled";
        row.reason = null;
        row.transaction_reference = vars.transaction_reference;
        row.response_status = Number(vars.response_status);
        row.response_headers_json = vars.headers_b64 ? Buffer.from(vars.headers_b64, "base64").toString("utf8") : null;
        row.response_body_json = vars.body_b64 ? Buffer.from(vars.body_b64, "base64").toString("utf8") : null;
        return { stdout: JSON.stringify(row) + "\n", stderr: "" };
      }
      throw new Error(`Unhandled fake SQL: ${sql}`);
    },
  };
}

afterEach(() => {
  delete process.env.MISSING_DISTRIBUTED_MONEY_ENABLED;
  delete process.env.MISSING_TRANSACTIONAL_RESPONSE_CACHE_ENABLED;
  configureDistributedMoneyExecForTest(undefined);
});

describe("Product Kappa.5.1 distributed money", () => {
  it("allows only one reservation for a payment hash and preserves the winner request binding", async () => {
    process.env.MISSING_DISTRIBUTED_MONEY_ENABLED = "1";
    const fake = fakePostgres();
    configureDistributedMoneyExecForTest(fake.exec);
    await initializeDistributedMoney();
    const nz = agentRequestHash("country_alpha_metadata", { country_code: "NZ" });
    const us = agentRequestHash("country_alpha_metadata", { country_code: "US" });

    const first = await reserveDistributedPayment({ paymentHash: "same-payment", requestHash: nz, executionId: "exec-a", capability: "country_alpha_metadata" });
    const second = await reserveDistributedPayment({ paymentHash: "same-payment", requestHash: us, executionId: "exec-b", capability: "country_alpha_metadata" });

    expect(first.reserved).toBe(true);
    expect(second.reserved).toBe(false);
    expect(second.prior?.execution_id).toBe("exec-a");
    expect(second.prior?.request_hash).toBe(nz);
    expect((await distributedPayment("same-payment"))?.execution_id).toBe("exec-a");
    expect(distributedMoneySnapshot()).toMatchObject({ ready: true, payments: 1, request_bound: 1, legacy_unbound: 0, reserved: 1 });
  });

  it("persists request binding with settling economics, pending transaction and cached settled response", async () => {
    process.env.MISSING_DISTRIBUTED_MONEY_ENABLED = "1";
    process.env.MISSING_TRANSACTIONAL_RESPONSE_CACHE_ENABLED = "1";
    const fake = fakePostgres();
    configureDistributedMoneyExecForTest(fake.exec);
    await initializeDistributedMoney();
    await truncateDistributedMoney();
    const requestHash = agentRequestHash("country_alpha_metadata", { country_code: "NZ" });
    await reserveDistributedPayment({ paymentHash: "p1", requestHash, executionId: "e1", capability: "country_alpha_metadata" });

    const settling = await markDistributedPaymentSettling({
      paymentHash: "p1",
      executionId: "e1",
      customerPriceMicrousd: 5000,
      providerCostMicrousd: 1000,
      grossMarginMicrousd: 4000,
      providerAttempts: 1,
      unknownProviderCostAttempts: 0,
      resolution: { status: "resolved", recipe_fingerprint: "fp" },
      network: "eip155:84532",
    });
    expect(settling.changed).toBe(true);
    expect(settling.record?.request_hash).toBe(requestHash);

    const pending = await markDistributedSettlementPending({ paymentHash: "p1", executionId: "e1", transactionReference: "0xtx", reason: "settlement_pending" });
    expect(pending.record?.state).toBe("settling");
    expect(pending.record?.transaction_reference).toBe("0xtx");

    const committed = await settleDistributedPayment({
      paymentHash: "p1",
      executionId: "e1",
      transactionReference: "0xtx",
      responseStatus: 200,
      responseHeaders: { "PAYMENT-RESPONSE": "ok" },
      responseBody: { status: "resolved" },
    });
    expect(committed.changed).toBe(true);
    expect(committed.record?.request_hash).toBe(requestHash);
    expect(cachedDistributedResponse(committed.record!)).toEqual({ status: 200, headers: { "PAYMENT-RESPONSE": "ok" }, body: { status: "resolved" } });
    expect(distributedMoneySnapshot()).toMatchObject({ payments: 1, request_bound: 1, legacy_unbound: 0, settling: 0, settled: 1 });
  });
});
