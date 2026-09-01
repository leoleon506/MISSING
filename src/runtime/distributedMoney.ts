import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { TransactionalPaymentRecord } from "./transactionalMoney.js";

const execFileAsync = promisify(execFile);

export interface DistributedPaymentRecord extends TransactionalPaymentRecord {
  provider_attempts: number | null;
  unknown_provider_cost_attempts: number | null;
  resolution_json: string | null;
  network: string | null;
}

type ExecResult = { stdout: string; stderr: string };
type ExecFn = (sql: string, vars?: Record<string, string>) => Promise<ExecResult>;
let execOverride: ExecFn | null | undefined;
let initialized = false;
let snapshot = {
  enabled: false,
  ready: false,
  backend: "postgres-psql" as const,
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

export function configureDistributedMoneyExecForTest(value: ExecFn | null | undefined) {
  execOverride = value;
  initialized = false;
  snapshot = {
    enabled: distributedMoneyEnabled(),
    ready: false,
    backend: "postgres-psql",
    response_cache_enabled: process.env.MISSING_TRANSACTIONAL_RESPONSE_CACHE_ENABLED === "1",
    payments: 0,
    reserved: 0,
    settling: 0,
    settled: 0,
    failed: 0,
  };
}

function pgEnv(): NodeJS.ProcessEnv {
  const raw = distributedMoneyDatabaseUrl();
  if (!raw) throw new Error("MISSING distributed money requires MISSING_POSTGRES_URL or DATABASE_URL");
  const url = new URL(raw);
  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") throw new Error("Invalid PostgreSQL URL protocol");
  const sslmode = process.env.MISSING_POSTGRES_SSLMODE?.trim() || url.searchParams.get("sslmode") || "prefer";
  return {
    ...process.env,
    PGHOST: url.hostname,
    PGPORT: url.port || "5432",
    PGDATABASE: decodeURIComponent(url.pathname.replace(/^\//, "")),
    PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password),
    PGSSLMODE: sslmode,
  };
}

async function run(sql: string, vars: Record<string, string> = {}): Promise<ExecResult> {
  if (execOverride !== undefined) {
    if (!execOverride) throw new Error("distributed money test executor is unavailable");
    return execOverride(sql, vars);
  }
  const args = ["-X", "-qAt", "-v", "ON_ERROR_STOP=1"];
  for (const [key, value] of Object.entries(vars)) args.push("-v", `${key}=${value}`);
  args.push("-c", sql);
  const result = await execFileAsync(process.env.MISSING_PSQL_BIN?.trim() || "psql", args, {
    env: pgEnv(),
    maxBuffer: 4 * 1024 * 1024,
    timeout: Number(process.env.MISSING_POSTGRES_TIMEOUT_MS ?? 10000),
  });
  return { stdout: result.stdout, stderr: result.stderr };
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
  const n = typeof value === "string" ? Number(value) : value;
  return typeof n === "number" && Number.isSafeInteger(n) ? n : null;
}

function parseRecordLine(line: string): DistributedPaymentRecord | null {
  if (!line.trim()) return null;
  const value = JSON.parse(line) as Record<string, unknown>;
  const state = value.state;
  if (state !== "reserved" && state !== "settling" && state !== "settled" && state !== "failed") return null;
  return {
    payment_hash: String(value.payment_hash), execution_id: String(value.execution_id), capability: String(value.capability), state,
    created_at: String(value.created_at), updated_at: String(value.updated_at),
    reason: value.reason == null ? null : String(value.reason),
    transaction_reference: value.transaction_reference == null ? null : String(value.transaction_reference),
    response_status: integer(value.response_status),
    response_headers_json: value.response_headers_json == null ? null : String(value.response_headers_json),
    response_body_json: value.response_body_json == null ? null : String(value.response_body_json),
    customer_price_microusd: integer(value.customer_price_microusd), provider_cost_microusd: integer(value.provider_cost_microusd),
    gross_margin_microusd: integer(value.gross_margin_microusd), provider_attempts: integer(value.provider_attempts),
    unknown_provider_cost_attempts: integer(value.unknown_provider_cost_attempts),
    resolution_json: value.resolution_json == null ? null : String(value.resolution_json),
    network: value.network == null ? null : String(value.network),
  };
}

async function refreshSnapshot() {
  if (!distributedMoneyEnabled()) return snapshot = { ...snapshot, enabled: false, ready: false };
  const { stdout } = await run(`SELECT row_to_json(x) FROM (SELECT COUNT(*)::bigint AS payments, COUNT(*) FILTER (WHERE state='reserved')::bigint AS reserved, COUNT(*) FILTER (WHERE state='settling')::bigint AS settling, COUNT(*) FILTER (WHERE state='settled')::bigint AS settled, COUNT(*) FILTER (WHERE state='failed')::bigint AS failed FROM missing_x402_payments) x;`);
  const row = stdout.trim() ? JSON.parse(stdout.trim()) as Record<string, unknown> : {};
  snapshot = {
    enabled: true, ready: true, backend: "postgres-psql",
    response_cache_enabled: process.env.MISSING_TRANSACTIONAL_RESPONSE_CACHE_ENABLED === "1",
    payments: integer(row.payments) ?? 0, reserved: integer(row.reserved) ?? 0, settling: integer(row.settling) ?? 0,
    settled: integer(row.settled) ?? 0, failed: integer(row.failed) ?? 0,
  };
  return snapshot;
}

export async function initializeDistributedMoney() {
  if (!distributedMoneyEnabled()) return snapshot = { ...snapshot, enabled: false, ready: false };
  await run(SCHEMA_SQL);
  initialized = true;
  return refreshSnapshot();
}

async function ensureReady() { if (!initialized) await initializeDistributedMoney(); }

export async function distributedPayment(paymentHash: string): Promise<DistributedPaymentRecord | null> {
  if (!distributedMoneyEnabled()) return null;
  await ensureReady();
  const { stdout } = await run(`SELECT row_to_json(p) FROM missing_x402_payments p WHERE payment_hash=:'payment_hash';`, { payment_hash: paymentHash });
  return parseRecordLine(stdout.trim());
}

export async function reserveDistributedPayment(args: { paymentHash: string; executionId: string; capability: string }) {
  await ensureReady();
  const { stdout } = await run(`WITH ins AS (INSERT INTO missing_x402_payments(payment_hash,execution_id,capability,state) VALUES (:'payment_hash',:'execution_id',:'capability','reserved') ON CONFLICT (payment_hash) DO NOTHING RETURNING *) SELECT row_to_json(ins) FROM ins;`, {
    payment_hash: args.paymentHash, execution_id: args.executionId, capability: args.capability,
  });
  const inserted = parseRecordLine(stdout.trim());
  const prior = inserted ?? await distributedPayment(args.paymentHash);
  await refreshSnapshot();
  return { enabled: true as const, reserved: Boolean(inserted), prior };
}

export async function markDistributedPaymentSettling(args: { paymentHash: string; executionId: string; customerPriceMicrousd: number; providerCostMicrousd: number | null; grossMarginMicrousd: number | null; providerAttempts: number; unknownProviderCostAttempts: number; resolution: unknown; network: string }) {
  await ensureReady();
  const vars = {
    payment_hash: args.paymentHash, execution_id: args.executionId, customer_price: String(args.customerPriceMicrousd),
    provider_cost: args.providerCostMicrousd === null ? "" : String(args.providerCostMicrousd),
    gross_margin: args.grossMarginMicrousd === null ? "" : String(args.grossMarginMicrousd), provider_attempts: String(args.providerAttempts),
    unknown_attempts: String(args.unknownProviderCostAttempts), resolution_b64: Buffer.from(JSON.stringify(args.resolution), "utf8").toString("base64"), network: args.network,
  };
  const { stdout } = await run(`WITH upd AS (UPDATE missing_x402_payments SET state='settling',updated_at=NOW(),reason=NULL,customer_price_microusd=:'customer_price'::bigint,provider_cost_microusd=NULLIF(:'provider_cost','')::bigint,gross_margin_microusd=NULLIF(:'gross_margin','')::bigint,provider_attempts=:'provider_attempts'::int,unknown_provider_cost_attempts=:'unknown_attempts'::int,resolution_json=convert_from(decode(:'resolution_b64','base64'),'UTF8'),network=:'network' WHERE payment_hash=:'payment_hash' AND execution_id=:'execution_id' AND state='reserved' RETURNING *) SELECT row_to_json(upd) FROM upd;`, vars);
  await refreshSnapshot();
  const rec = parseRecordLine(stdout.trim());
  return { changed: Boolean(rec), record: rec };
}

export async function markDistributedSettlementPending(args: { paymentHash: string; executionId: string; transactionReference: string; reason: string }) {
  await ensureReady();
  const { stdout } = await run(`WITH upd AS (UPDATE missing_x402_payments SET updated_at=NOW(),reason=:'reason',transaction_reference=:'transaction_reference' WHERE payment_hash=:'payment_hash' AND execution_id=:'execution_id' AND state='settling' RETURNING *) SELECT row_to_json(upd) FROM upd;`, { payment_hash: args.paymentHash, execution_id: args.executionId, reason: args.reason, transaction_reference: args.transactionReference });
  await refreshSnapshot(); const rec = parseRecordLine(stdout.trim()); return { changed: Boolean(rec), record: rec };
}

export async function failDistributedPayment(args: { paymentHash: string; executionId: string; reason: string; from?: "reserved" | "settling" }) {
  await ensureReady();
  const { stdout } = await run(`WITH upd AS (UPDATE missing_x402_payments SET state='failed',updated_at=NOW(),reason=:'reason' WHERE payment_hash=:'payment_hash' AND execution_id=:'execution_id' AND state=:'from_state' RETURNING *) SELECT row_to_json(upd) FROM upd;`, { payment_hash: args.paymentHash, execution_id: args.executionId, reason: args.reason, from_state: args.from ?? "reserved" });
  await refreshSnapshot(); const rec = parseRecordLine(stdout.trim()); return { changed: Boolean(rec), record: rec };
}

export async function settleDistributedPayment(args: { paymentHash: string; executionId: string; transactionReference: string; responseStatus: number; responseHeaders: Record<string, string>; responseBody: unknown }) {
  await ensureReady();
  const cache = process.env.MISSING_TRANSACTIONAL_RESPONSE_CACHE_ENABLED === "1";
  const vars = {
    payment_hash: args.paymentHash, execution_id: args.executionId, transaction_reference: args.transactionReference, response_status: String(args.responseStatus),
    headers_b64: cache ? Buffer.from(JSON.stringify(args.responseHeaders), "utf8").toString("base64") : "",
    body_b64: cache ? Buffer.from(JSON.stringify(args.responseBody), "utf8").toString("base64") : "",
  };
  const { stdout } = await run(`WITH upd AS (UPDATE missing_x402_payments SET state='settled',updated_at=NOW(),reason=NULL,transaction_reference=:'transaction_reference',response_status=:'response_status'::int,response_headers_json=CASE WHEN :'headers_b64'='' THEN NULL ELSE convert_from(decode(:'headers_b64','base64'),'UTF8') END,response_body_json=CASE WHEN :'body_b64'='' THEN NULL ELSE convert_from(decode(:'body_b64','base64'),'UTF8') END WHERE payment_hash=:'payment_hash' AND execution_id=:'execution_id' AND state='settling' RETURNING *) SELECT row_to_json(upd) FROM upd;`, vars);
  await refreshSnapshot(); const rec = parseRecordLine(stdout.trim()); return { changed: Boolean(rec), record: rec };
}

export function cachedDistributedResponse(value: DistributedPaymentRecord) {
  if (value.state !== "settled" || value.response_status === null || !value.response_body_json) return null;
  try { return { status: value.response_status, headers: value.response_headers_json ? JSON.parse(value.response_headers_json) as Record<string, string> : {}, body: JSON.parse(value.response_body_json) as unknown }; } catch { return null; }
}

export function distributedMoneySnapshot() { return { ...snapshot, enabled: distributedMoneyEnabled(), response_cache_enabled: process.env.MISSING_TRANSACTIONAL_RESPONSE_CACHE_ENABLED === "1" }; }
export async function truncateDistributedMoney() { if (!distributedMoneyEnabled()) return; await ensureReady(); await run("DELETE FROM missing_x402_payments;"); await refreshSnapshot(); }
export function closeDistributedMoney() { initialized = false; }
