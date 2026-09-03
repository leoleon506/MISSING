import { Pool } from "pg";
import { readDemandEvents } from "./runtime/demandLedger.js";
import { distributedMoneyDatabaseUrl, distributedMoneyEnabled } from "./runtime/distributedMoney.js";
import { evaluateRealAgentPaidClosedLoop, type RealAgentLoopPaymentEvidence } from "./runtime/realAgentLoopEvidence.js";
import { readSupplyLedgerEvents } from "./runtime/supplyLedger.js";

const KNOWN_NON_VALUE_NETWORKS = new Set([
  "eip155:84532", // Base Sepolia
  "eip155:11155111", // Ethereum Sepolia
  "eip155:4801", // World Sepolia
  "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1", // Solana Devnet CAIP identifier used by x402/CDP
  "solana:devnet",
]);

function money(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const parsed = typeof value === "string" ? Number(value) : value;
  return typeof parsed === "number" && Number.isSafeInteger(parsed) ? parsed : null;
}

export function realAgentLoopValueNetworks(): string[] {
  const raw = process.env.MISSING_REAL_AGENT_LOOP_VALUE_NETWORKS?.trim();
  if (!raw) throw new Error("live proof requires MISSING_REAL_AGENT_LOOP_VALUE_NETWORKS with at least one explicitly approved value-bearing CAIP-2 network");
  const networks = [...new Set(raw.split(",").map(item => item.trim()).filter(Boolean))];
  if (!networks.length) throw new Error("MISSING_REAL_AGENT_LOOP_VALUE_NETWORKS cannot be empty");
  for (const network of networks) {
    if (!network.includes(":")) throw new Error(`Invalid CAIP-2 value network: ${network}`);
    if (KNOWN_NON_VALUE_NETWORKS.has(network)) throw new Error(`Commercial live proof refuses known test/dev network: ${network}`);
  }
  return networks;
}

async function readSettledPayments(): Promise<RealAgentLoopPaymentEvidence[]> {
  const databaseUrl = distributedMoneyDatabaseUrl();
  if (!databaseUrl) throw new Error("live proof requires MISSING_POSTGRES_URL or DATABASE_URL");
  const timeout = 10_000;
  const pool = new Pool({
    connectionString: databaseUrl,
    max: 1,
    connectionTimeoutMillis: timeout,
    query_timeout: timeout,
    statement_timeout: timeout,
    application_name: "missing-real-agent-loop-live-proof",
  });
  try {
    const result = await pool.query(`
      SELECT payment_hash, request_hash, execution_id, capability, state,
             created_at, updated_at, transaction_reference, network,
             customer_price_microusd, provider_cost_microusd, gross_margin_microusd,
             provider_recipe_fingerprint
        FROM missing_x402_payments
       WHERE state = 'settled'
         AND request_hash IS NOT NULL
         AND transaction_reference IS NOT NULL
         AND provider_recipe_fingerprint IS NOT NULL
       ORDER BY updated_at ASC
       LIMIT 5000
    `);
    return result.rows.map(row => ({
      payment_hash: String(row.payment_hash),
      request_hash: row.request_hash == null ? null : String(row.request_hash),
      execution_id: String(row.execution_id),
      capability: String(row.capability),
      state: String(row.state),
      created_at: new Date(row.created_at).toISOString(),
      updated_at: new Date(row.updated_at).toISOString(),
      transaction_reference: row.transaction_reference == null ? null : String(row.transaction_reference),
      network: row.network == null ? null : String(row.network),
      customer_price_microusd: money(row.customer_price_microusd),
      provider_cost_microusd: money(row.provider_cost_microusd),
      gross_margin_microusd: money(row.gross_margin_microusd),
      provider_recipe_fingerprint: row.provider_recipe_fingerprint == null ? null : String(row.provider_recipe_fingerprint),
    }));
  } finally {
    await pool.end();
  }
}

async function main() {
  if (process.env.GITHUB_ACTIONS === "true" || process.env.CI === "true") {
    throw new Error("GO_REAL_AGENT_PAID_CLOSED_LOOP cannot be emitted from CI");
  }
  if (process.env.NODE_ENV !== "production") throw new Error("live proof requires NODE_ENV=production");
  if (process.env.MISSING_REAL_AGENT_LOOP_LIVE_PROOF !== "1") {
    throw new Error("live proof requires explicit MISSING_REAL_AGENT_LOOP_LIVE_PROOF=1");
  }
  if (!distributedMoneyEnabled()) throw new Error("live proof requires shared PostgreSQL money authority");

  const valueNetworks = realAgentLoopValueNetworks();
  const demands = readDemandEvents();
  const promotions = readSupplyLedgerEvents();
  const payments = await readSettledPayments();
  const evaluation = evaluateRealAgentPaidClosedLoop({ demands, promotions, payments, valueNetworks });
  const evidence = {
    result: evaluation.qualified ? "GO_REAL_AGENT_PAID_CLOSED_LOOP" : "NO_GO_REAL_AGENT_PAID_CLOSED_LOOP",
    proof_boundary: "production_demand_supply_ledgers_shared_postgres_and_value_network",
    live_go_allowed: true,
    generated_at: new Date().toISOString(),
    value_networks: valueNetworks,
    counts: {
      demand_events: demands.length,
      promotion_events: promotions.length,
      settled_payment_rows: payments.length,
    },
    ...evaluation,
  };
  console.log(JSON.stringify(evidence, null, 2));
  if (!evaluation.qualified) process.exitCode = 2;
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
