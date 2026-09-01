import type { TransactionalPaymentRecord } from "./transactionalMoney.js";

export interface DistributedPaymentRecord extends TransactionalPaymentRecord {
  provider_attempts: number | null;
  unknown_provider_cost_attempts: number | null;
  resolution_json: string | null;
  network: string | null;
}

type QueryResult = { rows: Record<string, unknown>[]; rowCount?: number | null };
type PoolLike = {
  query(sql: string, params?: unknown[]): Promise<QueryResult>;
  end?: () => Promise<void>;
};

let pool: PoolLike | null = null;
let poolOverride: PoolLike | null | undefined;
let initialized = false;
let snapshot = {
  enabled: false,
  ready: false,
  backend: "postgres" as const,
  response_cache_enabled: false,
  payments: 0,
  reserved: 0,
  settling: 0,
  settled: 0,
  failed: 0,
};

export function distributedMoneyEnabled(): boolean {
  return process.env.MISSING_DISTRIBUTED_MONEY_ENABLED === "1";
}

export function distributedMoneyDatabaseUrl(): string | null {
  const value = process.env.MISSING_POSTGRES_URL?.trim() || process.env.DATABASE_URL?.trim();
  return value || null;
}

export function configureDistributedMoneyPoolForTest(value: PoolLike | null | undefined) {
  poolOverride = value;
  pool = null;
  initialized = false;
  snapshot = {
    enabled: distributedMoneyEnabled(),
    ready: false,
    backend: "postgres",
    response_cache_enabled: process.env.MISSING_TRANSACTIONAL_RESPONSE_CACHE_ENABLED === "1",
    payments: 0,
    reserved: 0,
    settling: 0,
    settled: 0,
    failed: 0,
  };
}

async function createPool(): Promise<PoolLike> {
  if (poolOverride !== undefined) {
    if (!poolOverride) throw new Error("distributed money test pool is unavailable");
    return poolOverride;
  }
  const connectionString = distributedMoneyDatabaseUrl();
  if (!connectionString) throw new Error("MISSING distributed money requires MISSING_POSTGRES_URL or DATABASE_URL");
  const moduleName = "pg";
  const pg = await import(moduleName) as any;
  const Pool = pg.Pool ?? pg.default?.Pool;
  if (!Pool) throw new Error("pg Pool export is unavailable");
  const max = Number(process.env.MISSING_POSTGRES_POOL_MAX ?? 10);
  if (!Number.isInteger(max) || max < 1 || max > 100) throw new Error("Invalid MISSING_POSTGRES_POOL_MAX");
  return new Pool({
    connectionString,
    max,
    ssl: process.env.MISSING_POSTGRES_SSL === "1" ? { rejectUnauthorized: false } : undefined,
  }) as PoolLike;
}

async function getPool(): Promise<PoolLike> {
  if (pool) return pool;
  pool = await createPool();
  return pool;
}

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS missing_x402_payments (
  payment_hash TEXT PRIMARY KEY,
  execution_id TEXT NOT NULL UNIQUE,
  capability TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('reserved','settling','settled','failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reason TEXT,
  transaction_reference TEXT UNIQUE,
  response_status INTEGER,
  response_headers_json TEXT,
  response_body_json TEXT,
  customer_price_microusd BIGINT,
  provider_cost_microusd BIGINT,
  gross_margin_microusd BIGINT,
  provider_attempts INTEGER,
  unknown_provider_cost_attempts INTEGER,
  resolution_json TEXT,
  network TEXT
);
CREATE INDEX IF NOT EXISTS idx_missing_x402_state_updated
  ON missing_x402_payments(state, updated_at);
`;

function integer(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = typeof value === "bigint" ? Number(value) : typeof value === "string" ? Number(value) : value;
  return typeof n === "number" && Number.isSafeInteger(n) ? n : null;
}

function record(value: Record<string, unknown> | undefined): DistributedPaymentRecord | null {
  if (!value) return null;
  const state = value.state;
  if (state !== "reserved" && state !== "settling" && state !== "settled" && state !== "failed") return null;
  return {
    payment_hash: String(value.payment_hash),
    execution_id: String(value.execution_id),
    capability: String(value.capability),
    state,
    created_at: value.created_at instanceof Date ? value.created_at.toISOString() : String(value.created_at),
    updated_at: value.updated_at instanceof Date ? value.updated_at.toISOString() : String(value.updated_at),
    reason: value.reason === null || value.reason === undefined ? null : String(value.reason),
    transaction_reference: value.transaction_reference === null || value.transaction_reference === undefined ? null : String(value.transaction_reference),
    response_status: integer(value.response_status),
    response_headers_json: value.response_headers_json === null || value.response_headers_json === undefined ? null : String(value.response_headers_json),
    response_body_json: value.response_body_json === null || value.response_body_json === undefined ? null : String(value.response_body_json),
    customer_price_microusd: integer(value.customer_price_microusd),
    provider_cost_microusd: integer(value.provider_cost_microusd),
    gross_margin_microusd: integer(value.gross_margin_microusd),
    provider_attempts: integer(value.provider_attempts),
    unknown_provider_cost_attempts: integer(value.unknown_provider_cost_attempts),
    resolution_json: value.resolution_json === null || value.resolution_json === undefined ? null : String(value.resolution_json),
    network: value.network === null || value.network === undefined ? null : String(value.network),
  };
}

async function refreshSnapshot() {
  if (!distributedMoneyEnabled()) {
    snapshot = { ...snapshot, enabled: false, ready: false };
    return snapshot;
  }
  const p = await getPool();
  const result = await p.query(`
    SELECT
      COUNT(*)::bigint AS payments,
      COUNT(*) FILTER (WHERE state='reserved')::bigint AS reserved,
      COUNT(*) FILTER (WHERE state='settling')::bigint AS settling,
      COUNT(*) FILTER (WHERE state='settled')::bigint AS settled,
      COUNT(*) FILTER (WHERE state='failed')::bigint AS failed
    FROM missing_x402_payments
  `);
  const row = result.rows[0] ?? {};
  snapshot = {
    enabled: true,
    ready: true,
    backend: "postgres",
    response_cache_enabled: process.env.MISSING_TRANSACTIONAL_RESPONSE_CACHE_ENABLED === "1",
    payments: integer(row.payments) ?? 0,
    reserved: integer(row.reserved) ?? 0,
    settling: integer(row.settling) ?? 0,
    settled: integer(row.settled) ?? 0,
    failed: integer(row.failed) ?? 0,
  };
  return snapshot;
}

export async function initializeDistributedMoney() {
  if (!distributedMoneyEnabled()) {
    snapshot = { ...snapshot, enabled: false, ready: false };
    return snapshot;
  }
  const p = await getPool();
  await p.query(SCHEMA_SQL);
  initialized = true;
  return refreshSnapshot();
}

async function readyPool(): Promise<PoolLike> {
  if (!initialized) await initializeDistributedMoney();
  return getPool();
}

export async function distributedPayment(paymentHash: string): Promise<DistributedPaymentRecord | null> {
  if (!distributedMoneyEnabled()) return null;
  const p = await readyPool();
  const result = await p.query("SELECT * FROM missing_x402_payments WHERE payment_hash=$1", [paymentHash]);
  return record(result.rows[0]);
}

export async function reserveDistributedPayment(args: { paymentHash: string; executionId: string; capability: string }) {
  const p = await readyPool();
  const result = await p.query(`
    INSERT INTO missing_x402_payments(payment_hash, execution_id, capability, state)
    VALUES ($1,$2,$3,'reserved')
    ON CONFLICT (payment_hash) DO NOTHING
    RETURNING *
  `, [args.paymentHash, args.executionId, args.capability]);
  const inserted = record(result.rows[0]);
  const prior = inserted ?? await distributedPayment(args.paymentHash);
  await refreshSnapshot();
  return { enabled: true as const, reserved: Boolean(inserted), prior };
}

export async function markDistributedPaymentSettling(args: {
  paymentHash: string;
  executionId: string;
  customerPriceMicrousd: number;
  providerCostMicrousd: number | null;
  grossMarginMicrousd: number | null;
  providerAttempts: number;
  unknownProviderCostAttempts: number;
  resolution: unknown;
  network: string;
}) {
  const p = await readyPool();
  const result = await p.query(`
    UPDATE missing_x402_payments
       SET state='settling', updated_at=NOW(), reason=NULL,
           customer_price_microusd=$3, provider_cost_microusd=$4, gross_margin_microusd=$5,
           provider_attempts=$6, unknown_provider_cost_attempts=$7, resolution_json=$8, network=$9
     WHERE payment_hash=$1 AND execution_id=$2 AND state='reserved'
     RETURNING *
  `, [
    args.paymentHash,
    args.executionId,
    args.customerPriceMicrousd,
    args.providerCostMicrousd,
    args.grossMarginMicrousd,
    args.providerAttempts,
    args.unknownProviderCostAttempts,
    JSON.stringify(args.resolution),
    args.network,
  ]);
  await refreshSnapshot();
  return { changed: result.rows.length === 1, record: record(result.rows[0]) };
}

export async function markDistributedSettlementPending(args: {
  paymentHash: string;
  executionId: string;
  transactionReference: string;
  reason: string;
}) {
  const p = await readyPool();
  const result = await p.query(`
    UPDATE missing_x402_payments
       SET updated_at=NOW(), reason=$3, transaction_reference=$4
     WHERE payment_hash=$1 AND execution_id=$2 AND state='settling'
     RETURNING *
  `, [args.paymentHash, args.executionId, args.reason, args.transactionReference]);
  await refreshSnapshot();
  return { changed: result.rows.length === 1, record: record(result.rows[0]) };
}

export async function failDistributedPayment(args: {
  paymentHash: string;
  executionId: string;
  reason: string;
  from?: "reserved" | "settling";
}) {
  const p = await readyPool();
  const from = args.from ?? "reserved";
  const result = await p.query(`
    UPDATE missing_x402_payments
       SET state='failed', updated_at=NOW(), reason=$3
     WHERE payment_hash=$1 AND execution_id=$2 AND state=$4
     RETURNING *
  `, [args.paymentHash, args.executionId, args.reason, from]);
  await refreshSnapshot();
  return { changed: result.rows.length === 1, record: record(result.rows[0]) };
}

export async function settleDistributedPayment(args: {
  paymentHash: string;
  executionId: string;
  transactionReference: string;
  responseStatus: number;
  responseHeaders: Record<string, string>;
  responseBody: unknown;
}) {
  const p = await readyPool();
  const cache = process.env.MISSING_TRANSACTIONAL_RESPONSE_CACHE_ENABLED === "1";
  const result = await p.query(`
    UPDATE missing_x402_payments
       SET state='settled', updated_at=NOW(), reason=NULL, transaction_reference=$3,
           response_status=$4, response_headers_json=$5, response_body_json=$6
     WHERE payment_hash=$1 AND execution_id=$2 AND state='settling'
     RETURNING *
  `, [
    args.paymentHash,
    args.executionId,
    args.transactionReference,
    args.responseStatus,
    cache ? JSON.stringify(args.responseHeaders) : null,
    cache ? JSON.stringify(args.responseBody) : null,
  ]);
  await refreshSnapshot();
  return { changed: result.rows.length === 1, record: record(result.rows[0]) };
}

export function cachedDistributedResponse(value: DistributedPaymentRecord) {
  if (value.state !== "settled" || value.response_status === null || !value.response_body_json) return null;
  try {
    return {
      status: value.response_status,
      headers: value.response_headers_json ? JSON.parse(value.response_headers_json) as Record<string, string> : {},
      body: JSON.parse(value.response_body_json) as unknown,
    };
  } catch {
    return null;
  }
}

export function distributedMoneySnapshot() {
  return {
    ...snapshot,
    enabled: distributedMoneyEnabled(),
    response_cache_enabled: process.env.MISSING_TRANSACTIONAL_RESPONSE_CACHE_ENABLED === "1",
  };
}

export async function truncateDistributedMoney() {
  if (!distributedMoneyEnabled()) return;
  const p = await readyPool();
  await p.query("DELETE FROM missing_x402_payments");
  await refreshSnapshot();
}

export async function closeDistributedMoney() {
  if (pool && poolOverride === undefined && pool.end) await pool.end();
  pool = null;
  initialized = false;
}
