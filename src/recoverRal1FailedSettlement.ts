import { Pool } from "pg";
import { distributedMoneyDatabaseUrl } from "./runtime/distributedMoney.js";
import { x402SettlementProof } from "./runtime/x402Reconciliation.js";

const ALLOWED_FAILURE_REASON = "settlement_proof_network_mismatch";

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

async function main() {
  if (process.env.NODE_ENV !== "production") throw new Error("RAL1 settlement recovery requires NODE_ENV=production");
  if (process.env.MISSING_RAL1_RECOVER_FAILED_SETTLEMENT !== "1") {
    throw new Error("RAL1 settlement recovery requires MISSING_RAL1_RECOVER_FAILED_SETTLEMENT=1");
  }

  const transaction = requiredEnv("MISSING_RAL1_RECOVERY_TRANSACTION").toLowerCase();
  if (!/^0x[0-9a-f]{64}$/.test(transaction)) throw new Error("MISSING_RAL1_RECOVERY_TRANSACTION must be a 32-byte transaction hash");

  const databaseUrl = distributedMoneyDatabaseUrl();
  if (!databaseUrl) throw new Error("MISSING_POSTGRES_URL or DATABASE_URL is required");
  const asset = requiredEnv("MISSING_X402_ASSET");
  const payTo = requiredEnv("MISSING_X402_PAY_TO");
  const configuredNetwork = requiredEnv("MISSING_X402_NETWORK");

  const pool = new Pool({
    connectionString: databaseUrl,
    max: 1,
    connectionTimeoutMillis: 10_000,
    query_timeout: 10_000,
    statement_timeout: 10_000,
    application_name: "missing-ral1-settlement-recovery",
  });

  try {
    const found = await pool.query(`
      SELECT payment_hash, request_hash, execution_id, capability, state, reason,
             transaction_reference, network, customer_price_microusd,
             provider_cost_microusd, gross_margin_microusd,
             provider_recipe_fingerprint, resolution_json
        FROM missing_x402_payments
       WHERE lower(transaction_reference) = $1
       LIMIT 2
    `, [transaction]);

    if (found.rowCount !== 1) throw new Error(`expected exactly one durable payment for transaction; found ${found.rowCount ?? 0}`);
    const row = found.rows[0];

    if (row.state !== "failed") throw new Error(`recovery refuses non-failed state: ${row.state}`);
    if (row.reason !== ALLOWED_FAILURE_REASON) throw new Error(`recovery refuses failure reason: ${row.reason}`);
    if (!row.request_hash) throw new Error("recovery refuses legacy-unbound payment");
    if (!row.provider_recipe_fingerprint) throw new Error("recovery requires provider recipe fingerprint");
    if (!row.resolution_json) throw new Error("recovery requires stored provider resolution");
    if (!row.network || row.network !== configuredNetwork) {
      throw new Error(`stored network ${row.network ?? "null"} does not match configured network ${configuredNetwork}`);
    }

    const amount = Number(row.customer_price_microusd);
    const providerCost = row.provider_cost_microusd === null ? null : Number(row.provider_cost_microusd);
    const grossMargin = row.gross_margin_microusd === null ? null : Number(row.gross_margin_microusd);
    if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error("invalid stored customer price");
    if (providerCost === null || !Number.isSafeInteger(providerCost) || providerCost < 0) throw new Error("recovery requires known non-negative provider cost");
    if (!Number.isSafeInteger(grossMargin) || grossMargin <= 0 || amount - providerCost !== grossMargin) {
      throw new Error("recovery requires internally consistent positive realized margin");
    }

    const proof = await x402SettlementProof({
      transaction,
      network: row.network,
      asset,
      payTo,
      amount: String(amount),
    });

    if (proof.state !== "verified") {
      console.log(JSON.stringify({ recovered: false, transaction, proof }, null, 2));
      process.exitCode = 2;
      return;
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const updated = await client.query(`
        UPDATE missing_x402_payments
           SET state = 'settled',
               reason = NULL,
               updated_at = NOW(),
               response_status = 200,
               lease_token = NULL,
               lease_expires_at = NULL
         WHERE payment_hash = $1
           AND execution_id = $2
           AND state = 'failed'
           AND reason = $3
           AND lower(transaction_reference) = $4
         RETURNING payment_hash, request_hash, execution_id, capability, state,
                   transaction_reference, network, customer_price_microusd,
                   provider_cost_microusd, gross_margin_microusd,
                   provider_recipe_fingerprint, updated_at
      `, [row.payment_hash, row.execution_id, ALLOWED_FAILURE_REASON, transaction]);
      if (updated.rowCount !== 1) throw new Error("durable payment changed during recovery; no mutation committed");
      await client.query("COMMIT");
      console.log(JSON.stringify({
        recovered: true,
        recovery_kind: "exact_onchain_reproof_after_rpc_network_misconfiguration",
        transaction,
        proof,
        payment: updated.rows[0],
      }, null, 2));
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
