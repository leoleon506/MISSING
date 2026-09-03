import { Pool } from "pg";
import { distributedMoneyDatabaseUrl, distributedMoneyEnabled } from "./distributedMoney.js";
import { VERIFIED_RECIPES } from "./recipes.js";
import { recordX402Settlement, x402Events } from "./x402Ledger.js";

export interface X402TelemetryReconciliationResult {
  scanned: number;
  eligible: number;
  already_recorded: number;
  recorded: number;
  skipped: number;
  error: string | null;
}

type SettledRow = {
  payment_hash: string;
  transaction_reference: string | null;
  capability: string;
  network: string | null;
  customer_price_microusd: string | number | null;
  provider_cost_microusd: string | number | null;
  provider_recipe_fingerprint: string | null;
};

function integer(value: string | number | null): number | null {
  if (value === null) return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function poolConfig() {
  const raw = distributedMoneyDatabaseUrl();
  if (!raw) return null;
  const url = new URL(raw);
  const explicitSslmode = process.env.MISSING_POSTGRES_SSLMODE?.trim();
  if (explicitSslmode) url.searchParams.set("sslmode", explicitSslmode);
  const timeout = Number(process.env.MISSING_POSTGRES_TIMEOUT_MS ?? 10000);
  const safeTimeout = Number.isSafeInteger(timeout) && timeout > 0 ? timeout : 10000;
  return {
    connectionString: url.toString(),
    max: 1,
    connectionTimeoutMillis: safeTimeout,
    query_timeout: safeTimeout,
    statement_timeout: safeTimeout,
    application_name: "missing-x402-telemetry-reconciliation",
  };
}

/**
 * Reconstruct advisory x402/economics telemetry from the authoritative Postgres
 * payment ledger. This never mutates money state and is idempotent by payment_hash.
 * It exists for settlements that were finalized by an operator/recovery path which
 * correctly updated missing_x402_payments but did not append the local telemetry.
 */
export async function reconcileSettledX402Telemetry(): Promise<X402TelemetryReconciliationResult> {
  const empty: X402TelemetryReconciliationResult = {
    scanned: 0,
    eligible: 0,
    already_recorded: 0,
    recorded: 0,
    skipped: 0,
    error: null,
  };
  if (!distributedMoneyEnabled()) return empty;
  const config = poolConfig();
  if (!config) return { ...empty, error: "postgres_not_configured" };

  const pool = new Pool(config);
  try {
    const result = await pool.query<SettledRow>(`
      SELECT payment_hash, transaction_reference, capability, network,
             customer_price_microusd, provider_cost_microusd,
             provider_recipe_fingerprint
      FROM missing_x402_payments
      WHERE state='settled'
      ORDER BY created_at ASC
    `);
    const existing = new Set(x402Events().map(event => event.payment_hash));
    const summary = { ...empty, scanned: result.rows.length };

    for (const row of result.rows) {
      if (existing.has(row.payment_hash)) {
        summary.already_recorded += 1;
        continue;
      }
      const customerPrice = integer(row.customer_price_microusd);
      const providerCost = integer(row.provider_cost_microusd);
      const recipe = row.provider_recipe_fingerprint
        ? VERIFIED_RECIPES.find(item => item.recipe_fingerprint === row.provider_recipe_fingerprint) ?? null
        : null;
      if (!row.transaction_reference || customerPrice === null || customerPrice < 0 || providerCost === null || providerCost < 0 || !recipe) {
        summary.skipped += 1;
        continue;
      }
      summary.eligible += 1;
      const recorded = recordX402Settlement({
        paymentHash: row.payment_hash,
        transactionReference: row.transaction_reference,
        network: row.network ?? undefined,
        capability: row.capability,
        recipe,
        customerPriceMicrousd: customerPrice,
        realizedProviderCostMicrousd: providerCost,
      });
      if (recorded.recorded) {
        summary.recorded += 1;
        existing.add(row.payment_hash);
      } else {
        summary.skipped += 1;
      }
    }
    return summary;
  } catch (error) {
    return { ...empty, error: error instanceof Error ? error.message : String(error) };
  } finally {
    await pool.end().catch(() => undefined);
  }
}
