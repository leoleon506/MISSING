import { Pool, type PoolConfig } from "pg";
import { distributedMoneyDatabaseUrl } from "./distributedMoney.js";

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function releasePoolConfig(): PoolConfig {
  const raw = distributedMoneyDatabaseUrl();
  if (!raw) throw new Error("MISSING distributed money requires MISSING_POSTGRES_URL or DATABASE_URL");
  const url = new URL(raw);
  const explicitSslmode = process.env.MISSING_POSTGRES_SSLMODE?.trim();
  if (explicitSslmode) url.searchParams.set("sslmode", explicitSslmode);
  const timeout = positiveInteger(process.env.MISSING_POSTGRES_TIMEOUT_MS, 10_000);
  return {
    connectionString: url.toString(),
    max: 1,
    idleTimeoutMillis: 1_000,
    connectionTimeoutMillis: timeout,
    query_timeout: timeout,
    statement_timeout: timeout,
    application_name: "missing-recoverable-lease-release",
  };
}

/**
 * Relinquish one active durable lease without changing the payment state.
 *
 * The update is fenced by payment, execution, lease token, and generation. A
 * stale owner therefore cannot clear a successor's lease. The distributed-money
 * heartbeat observes the cleared/stolen token on its next tick and self-stops.
 */
export async function releaseRecoverableDistributedLease(args: {
  paymentHash: string;
  executionId: string;
  leaseToken: string;
  leaseFence: number;
}) {
  const pool = new Pool(releasePoolConfig());
  try {
    const result = await pool.query<{ state: string; lease_fence: string | number }>(`
      UPDATE missing_x402_payments
      SET lease_token = NULL,
          lease_expires_at = NULL,
          updated_at = NOW()
      WHERE payment_hash = $1
        AND execution_id = $2
        AND lease_token = $3
        AND lease_fence = $4::bigint
        AND state IN ('reserved','executing','provider_done','settling')
      RETURNING state, lease_fence
    `, [args.paymentHash, args.executionId, args.leaseToken, String(args.leaseFence)]);
    const row = result.rows[0];
    return {
      released: Boolean(row),
      state: row?.state ?? null,
      leaseFence: row ? Number(row.lease_fence) : null,
    };
  } finally {
    await pool.end();
  }
}
