import { Pool, type PoolConfig, type QueryResultRow } from "pg";
import type { TransactionalPaymentRecord } from "./transactionalMoney.js";

export type DistributedPaymentState = "reserved" | "executing" | "provider_done" | "settling" | "settled" | "ambiguous" | "failed";
export type ProviderRecoveryMode = "read_only" | "idempotent" | "ambiguous";
export const CURRENT_DISTRIBUTED_RECOVERY_PROTOCOL_VERSION = 1;

export interface DistributedPaymentRecord extends Omit<TransactionalPaymentRecord, "state"> {
  state: DistributedPaymentState;
  provider_attempts: number | null;
  unknown_provider_cost_attempts: number | null;
  resolution_json: string | null;
  network: string | null;
  provider_recipe_fingerprint: string | null;
  provider_recovery_mode: ProviderRecoveryMode | null;
  provider_idempotency_key: string | null;
  settlement_intent_id: string | null;
  lease_token: string | null;
  lease_fence: number;
  lease_expires_at: string | null;
  recovery_protocol_version: number | null;
}

type ExecResult = { stdout: string; stderr: string };
type ExecFn = (sql: string, vars?: Record<string, string>) => Promise<ExecResult>;
type LeaseSession = {
  token: string;
  fence: number;
  timer: ReturnType<typeof setInterval> | null;
  renewing: boolean;
  lost: boolean;
  renewals: number;
};

let execOverride: ExecFn | null | undefined;
let pool: Pool | null = null;
let initialized = false;
let initializing: Promise<void> | null = null;
const leaseSessions = new Map<string, LeaseSession>();
let snapshot = {
  enabled: false,
  ready: false,
  backend: "postgres-native" as const,
  response_cache_enabled: false,
  pool_total: 0,
  pool_idle: 0,
  pool_waiting: 0,
  payments: 0,
  request_bound: 0,
  legacy_unbound: 0,
  reserved: 0,
  executing: 0,
  provider_done: 0,
  settling: 0,
  settled: 0,
  ambiguous: 0,
  failed: 0,
};

export function distributedMoneyEnabled(): boolean {
  return process.env.MISSING_DISTRIBUTED_MONEY_ENABLED === "1";
}

export function distributedMoneyDatabaseUrl(): string | null {
  const value = process.env.MISSING_POSTGRES_URL?.trim() || process.env.DATABASE_URL?.trim();
  return value || null;
}

function positiveInteger(value: string | undefined, fallback: number, minimum = 1): number {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= minimum ? parsed : fallback;
}

export function distributedRecoveryLeaseMs(): number {
  return positiveInteger(process.env.MISSING_X402_RECOVERY_LEASE_MS, 30_000, 100);
}

export function distributedLeaseHeartbeatMs(): number {
  const leaseMs = distributedRecoveryLeaseMs();
  const configured = Number(process.env.MISSING_X402_LEASE_HEARTBEAT_MS);
  if (Number.isSafeInteger(configured) && configured >= 10 && configured < leaseMs) return configured;
  return Math.max(10, Math.floor(leaseMs / 3));
}

function stopLeaseSession(executionId: string, remove = false) {
  const session = leaseSessions.get(executionId);
  if (!session) return;
  if (session.timer) clearInterval(session.timer);
  session.timer = null;
  if (remove) leaseSessions.delete(executionId);
}

function clearLeaseSessions() {
  for (const executionId of leaseSessions.keys()) stopLeaseSession(executionId, true);
}

function registerLeaseSession(executionId: string, token: string, fence: number) {
  stopLeaseSession(executionId, true);
  leaseSessions.set(executionId, { token, fence, timer: null, renewing: false, lost: false, renewals: 0 });
}

function implicitFence(executionId: string, token: string): number | null {
  const session = leaseSessions.get(executionId);
  if (!session || session.token !== token || session.lost) return null;
  return session.fence;
}

export function distributedLeaseSessionSnapshot(executionId: string) {
  const session = leaseSessions.get(executionId);
  return session ? {
    token: session.token,
    fence: session.fence,
    active: Boolean(session.timer),
    lost: session.lost,
    renewals: session.renewals,
  } : null;
}

function closePoolSoon() {
  const current = pool;
  pool = null;
  if (current) void current.end().catch(() => undefined);
}

function emptySnapshot() {
  return {
    enabled: distributedMoneyEnabled(), ready: false, backend: "postgres-native" as const,
    response_cache_enabled: process.env.MISSING_TRANSACTIONAL_RESPONSE_CACHE_ENABLED === "1",
    pool_total: 0, pool_idle: 0, pool_waiting: 0, payments: 0, request_bound: 0, legacy_unbound: 0,
    reserved: 0, executing: 0, provider_done: 0, settling: 0, settled: 0, ambiguous: 0, failed: 0,
  };
}

export function configureDistributedMoneyExecForTest(value: ExecFn | null | undefined) {
  clearLeaseSessions();
  closePoolSoon();
  execOverride = value;
  initialized = false;
  initializing = null;
  snapshot = emptySnapshot();
}

function poolConfig(): PoolConfig {
  const raw = distributedMoneyDatabaseUrl();
  if (!raw) throw new Error("MISSING distributed money requires MISSING_POSTGRES_URL or DATABASE_URL");
  const url = new URL(raw);
  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") throw new Error("Invalid PostgreSQL URL protocol");
  const explicitSslmode = process.env.MISSING_POSTGRES_SSLMODE?.trim();
  if (explicitSslmode) url.searchParams.set("sslmode", explicitSslmode);
  const timeout = positiveInteger(process.env.MISSING_POSTGRES_TIMEOUT_MS, 10000);
  return {
    connectionString: url.toString(), max: positiveInteger(process.env.MISSING_POSTGRES_POOL_MAX, 10),
    idleTimeoutMillis: positiveInteger(process.env.MISSING_POSTGRES_IDLE_TIMEOUT_MS, 30000),
    connectionTimeoutMillis: timeout, query_timeout: timeout, statement_timeout: timeout,
    application_name: process.env.MISSING_POSTGRES_APPLICATION_NAME?.trim() || "missing-distributed-money",
  };
}

function nativePool(): Pool {
  if (pool) return pool;
  const created = new Pool(poolConfig());
  created.on("error", () => { snapshot = { ...snapshot, ready: false }; });
  pool = created;
  return created;
}

function parameterize(sql: string, vars: Record<string, string>): { text: string; values: string[] } {
  const indexes = new Map<string, number>();
  const values: string[] = [];
  const text = sql.replace(/:'([A-Za-z_][A-Za-z0-9_]*)'/g, (_match, key: string) => {
    if (!Object.prototype.hasOwnProperty.call(vars, key)) throw new Error(`Missing PostgreSQL variable: ${key}`);
    let index = indexes.get(key);
    if (!index) { values.push(vars[key]); index = values.length; indexes.set(key, index); }
    return `$${index}`;
  });
  return { text, values };
}

function stdoutFromRows(rows: QueryResultRow[]): string {
  if (rows.length === 0) return "";
  return rows.map(row => {
    const values = Object.values(row);
    const value = values.length === 1 ? values[0] : row;
    return typeof value === "string" ? value : JSON.stringify(value);
  }).join("\n") + "\n";
}

async function run(sql: string, vars: Record<string, string> = {}): Promise<ExecResult> {
  if (execOverride !== undefined) {
    if (!execOverride) throw new Error("distributed money test executor is unavailable");
    return execOverride(sql, vars);
  }
  const query = parameterize(sql, vars);
  const result = await nativePool().query(query.text, query.values) as unknown as { rows?: QueryResultRow[] } | Array<{ rows?: QueryResultRow[] }>;
  const rows = Array.isArray(result) ? result.flatMap(item => item.rows ?? []) : result.rows ?? [];
  return { stdout: stdoutFromRows(rows), stderr: "" };
}

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS missing_x402_payments (
  payment_hash TEXT PRIMARY KEY, request_hash TEXT, execution_id TEXT NOT NULL UNIQUE, capability TEXT NOT NULL,
  state TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reason TEXT, transaction_reference TEXT UNIQUE, response_status INTEGER, response_headers_json TEXT, response_body_json TEXT,
  customer_price_microusd BIGINT, provider_cost_microusd BIGINT, gross_margin_microusd BIGINT, provider_attempts INTEGER,
  unknown_provider_cost_attempts INTEGER, resolution_json TEXT, network TEXT, provider_recipe_fingerprint TEXT,
  provider_recovery_mode TEXT, provider_idempotency_key TEXT, settlement_intent_id TEXT, lease_token TEXT,
  lease_fence BIGINT NOT NULL DEFAULT 1, lease_expires_at TIMESTAMPTZ, recovery_protocol_version INTEGER
);
ALTER TABLE missing_x402_payments ADD COLUMN IF NOT EXISTS request_hash TEXT;
ALTER TABLE missing_x402_payments ADD COLUMN IF NOT EXISTS provider_recipe_fingerprint TEXT;
ALTER TABLE missing_x402_payments ADD COLUMN IF NOT EXISTS provider_recovery_mode TEXT;
ALTER TABLE missing_x402_payments ADD COLUMN IF NOT EXISTS provider_idempotency_key TEXT;
ALTER TABLE missing_x402_payments ADD COLUMN IF NOT EXISTS settlement_intent_id TEXT;
ALTER TABLE missing_x402_payments ADD COLUMN IF NOT EXISTS lease_token TEXT;
ALTER TABLE missing_x402_payments ADD COLUMN IF NOT EXISTS lease_fence BIGINT NOT NULL DEFAULT 1;
ALTER TABLE missing_x402_payments ADD COLUMN IF NOT EXISTS lease_expires_at TIMESTAMPTZ;
ALTER TABLE missing_x402_payments ADD COLUMN IF NOT EXISTS recovery_protocol_version INTEGER;
ALTER TABLE missing_x402_payments DROP CONSTRAINT IF EXISTS missing_x402_payments_state_check;
ALTER TABLE missing_x402_payments ADD CONSTRAINT missing_x402_payments_state_check CHECK (state IN ('reserved','executing','provider_done','settling','settled','ambiguous','failed'));
ALTER TABLE missing_x402_payments DROP CONSTRAINT IF EXISTS missing_x402_payments_provider_recovery_mode_check;
ALTER TABLE missing_x402_payments ADD CONSTRAINT missing_x402_payments_provider_recovery_mode_check CHECK (provider_recovery_mode IS NULL OR provider_recovery_mode IN ('read_only','idempotent','ambiguous'));
CREATE INDEX IF NOT EXISTS idx_missing_x402_state_updated ON missing_x402_payments(state, updated_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_missing_x402_settlement_intent ON missing_x402_payments(settlement_intent_id) WHERE settlement_intent_id IS NOT NULL;
`;

function integer(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = typeof value === "string" ? Number(value) : value;
  return typeof n === "number" && Number.isSafeInteger(n) ? n : null;
}

function recoveryMode(value: unknown): ProviderRecoveryMode | null {
  return value === "read_only" || value === "idempotent" || value === "ambiguous" ? value : null;
}

function parseRecordLine(line: string): DistributedPaymentRecord | null {
  if (!line.trim()) return null;
  const value = JSON.parse(line) as Record<string, unknown>;
  const state = value.state;
  if (state !== "reserved" && state !== "executing" && state !== "provider_done" && state !== "settling" && state !== "settled" && state !== "ambiguous" && state !== "failed") return null;
  return {
    payment_hash: String(value.payment_hash), request_hash: value.request_hash == null ? null : String(value.request_hash), execution_id: String(value.execution_id), capability: String(value.capability), state,
    created_at: String(value.created_at), updated_at: String(value.updated_at), reason: value.reason == null ? null : String(value.reason), transaction_reference: value.transaction_reference == null ? null : String(value.transaction_reference),
    response_status: integer(value.response_status), response_headers_json: value.response_headers_json == null ? null : String(value.response_headers_json), response_body_json: value.response_body_json == null ? null : String(value.response_body_json),
    customer_price_microusd: integer(value.customer_price_microusd), provider_cost_microusd: integer(value.provider_cost_microusd), gross_margin_microusd: integer(value.gross_margin_microusd),
    provider_attempts: integer(value.provider_attempts), unknown_provider_cost_attempts: integer(value.unknown_provider_cost_attempts), resolution_json: value.resolution_json == null ? null : String(value.resolution_json), network: value.network == null ? null : String(value.network),
    provider_recipe_fingerprint: value.provider_recipe_fingerprint == null ? null : String(value.provider_recipe_fingerprint), provider_recovery_mode: recoveryMode(value.provider_recovery_mode), provider_idempotency_key: value.provider_idempotency_key == null ? null : String(value.provider_idempotency_key),
    settlement_intent_id: value.settlement_intent_id == null ? null : String(value.settlement_intent_id), lease_token: value.lease_token == null ? null : String(value.lease_token), lease_fence: integer(value.lease_fence) ?? 1, lease_expires_at: value.lease_expires_at == null ? null : String(value.lease_expires_at),
    recovery_protocol_version: integer(value.recovery_protocol_version),
  };
}

function poolSnapshot() {
  return pool ? { pool_total: pool.totalCount, pool_idle: pool.idleCount, pool_waiting: pool.waitingCount } : { pool_total: 0, pool_idle: 0, pool_waiting: 0 };
}

async function refreshSnapshot() {
  if (!distributedMoneyEnabled()) return snapshot = { ...snapshot, enabled: false, ready: false, ...poolSnapshot() };
  const { stdout } = await run(`SELECT row_to_json(x) FROM (SELECT COUNT(*)::bigint AS payments, COUNT(*) FILTER (WHERE request_hash IS NOT NULL)::bigint AS request_bound, COUNT(*) FILTER (WHERE request_hash IS NULL)::bigint AS legacy_unbound, COUNT(*) FILTER (WHERE state='reserved')::bigint AS reserved, COUNT(*) FILTER (WHERE state='executing')::bigint AS executing, COUNT(*) FILTER (WHERE state='provider_done')::bigint AS provider_done, COUNT(*) FILTER (WHERE state='settling')::bigint AS settling, COUNT(*) FILTER (WHERE state='settled')::bigint AS settled, COUNT(*) FILTER (WHERE state='ambiguous')::bigint AS ambiguous, COUNT(*) FILTER (WHERE state='failed')::bigint AS failed FROM missing_x402_payments) x;`);
  const row = stdout.trim() ? JSON.parse(stdout.trim()) as Record<string, unknown> : {};
  snapshot = { enabled: true, ready: true, backend: "postgres-native", response_cache_enabled: process.env.MISSING_TRANSACTIONAL_RESPONSE_CACHE_ENABLED === "1", ...poolSnapshot(),
    payments: integer(row.payments) ?? 0, request_bound: integer(row.request_bound) ?? 0, legacy_unbound: integer(row.legacy_unbound) ?? 0, reserved: integer(row.reserved) ?? 0,
    executing: integer(row.executing) ?? 0, provider_done: integer(row.provider_done) ?? 0, settling: integer(row.settling) ?? 0, settled: integer(row.settled) ?? 0, ambiguous: integer(row.ambiguous) ?? 0, failed: integer(row.failed) ?? 0 };
  return snapshot;
}

export async function initializeDistributedMoney() {
  if (!distributedMoneyEnabled()) return snapshot = { ...snapshot, enabled: false, ready: false, ...poolSnapshot() };
  if (!initializing) initializing = (async () => { await run(SCHEMA_SQL); initialized = true; })().finally(() => { initializing = null; });
  await initializing;
  return refreshSnapshot();
}

async function ensureReady() {
  if (initialized) return;
  if (initializing) await initializing; else await initializeDistributedMoney();
}

export async function distributedPayment(paymentHash: string): Promise<DistributedPaymentRecord | null> {
  if (!distributedMoneyEnabled()) return null;
  await ensureReady();
  const { stdout } = await run(`SELECT row_to_json(p) FROM missing_x402_payments p WHERE payment_hash=:'payment_hash';`, { payment_hash: paymentHash });
  return parseRecordLine(stdout.trim());
}

function fenceValue(value: number | undefined): number {
  return Number.isSafeInteger(value) && (value ?? 0) > 0 ? value! : 1;
}

function leaseVars(token: string, fence = 1) {
  return { lease_token: token, lease_fence: String(fenceValue(fence)), lease_ms: String(distributedRecoveryLeaseMs()) };
}

function legacyUnfencedAllowed() {
  return process.env.MISSING_DISTRIBUTED_LEGACY_UNFENCED_MUTATIONS === "1";
}

function mutationFence(executionId: string, token: string, explicit?: number): number | null | undefined {
  if (explicit !== undefined) return fenceValue(explicit);
  const inferred = implicitFence(executionId, token);
  if (inferred !== null) return inferred;
  return legacyUnfencedAllowed() ? undefined : null;
}

function activeLeaseCondition(fence: number | undefined) {
  return ` AND lease_token=:'lease_token'${fence === undefined ? "" : " AND lease_fence=:'lease_fence'::bigint"} AND lease_expires_at > NOW()`;
}

export async function reserveDistributedPayment(args: { paymentHash: string; requestHash: string; executionId: string; capability: string }) {
  await ensureReady();
  const vars = {
    payment_hash: args.paymentHash,
    request_hash: args.requestHash,
    execution_id: args.executionId,
    capability: args.capability,
    recovery_protocol_version: String(CURRENT_DISTRIBUTED_RECOVERY_PROTOCOL_VERSION),
    ...leaseVars(args.executionId, 1),
  };
  const { stdout } = await run(`WITH ins AS (INSERT INTO missing_x402_payments(payment_hash,request_hash,execution_id,capability,state,lease_token,lease_fence,lease_expires_at,recovery_protocol_version) VALUES (:'payment_hash',:'request_hash',:'execution_id',:'capability','reserved',:'lease_token',:'lease_fence'::bigint,NOW() + (:'lease_ms'::bigint * INTERVAL '1 millisecond'),:'recovery_protocol_version'::int) ON CONFLICT (payment_hash) DO NOTHING RETURNING *) SELECT row_to_json(ins) FROM ins;`, vars);
  const inserted = parseRecordLine(stdout.trim());
  if (inserted) registerLeaseSession(args.executionId, args.executionId, inserted.lease_fence);
  const prior = inserted ?? await distributedPayment(args.paymentHash);
  await refreshSnapshot();
  return { enabled: true as const, reserved: Boolean(inserted), prior, leaseToken: inserted ? args.executionId : null, leaseFence: inserted?.lease_fence ?? null };
}

export async function claimDistributedRecovery(args: { paymentHash: string; requestHash: string; leaseToken: string }) {
  await ensureReady();
  const vars = { payment_hash: args.paymentHash, request_hash: args.requestHash, ...leaseVars(args.leaseToken, 1) };
  const { stdout } = await run(`WITH upd AS (UPDATE missing_x402_payments SET lease_token=:'lease_token',lease_fence=lease_fence + 1,lease_expires_at=NOW() + (:'lease_ms'::bigint * INTERVAL '1 millisecond'),updated_at=NOW() WHERE payment_hash=:'payment_hash' AND request_hash=:'request_hash' AND state IN ('reserved','executing','provider_done','settling') AND (lease_expires_at IS NULL OR lease_expires_at <= NOW()) AND lease_fence < 9007199254740991 RETURNING *) SELECT row_to_json(upd) FROM upd;`, vars);
  const rec = parseRecordLine(stdout.trim());
  if (rec && rec.recovery_protocol_version !== CURRENT_DISTRIBUTED_RECOVERY_PROTOCOL_VERSION) {
    const observed = rec.recovery_protocol_version === null ? "legacy" : String(rec.recovery_protocol_version);
    const quarantined = await markDistributedPaymentAmbiguous({
      paymentHash: rec.payment_hash,
      executionId: rec.execution_id,
      reason: `recovery_protocol_version_untrusted:${observed}`,
      from: rec.state,
      leaseToken: args.leaseToken,
      leaseFence: rec.lease_fence,
    });
    const quarantinedRecord = quarantined.record ?? await distributedPayment(args.paymentHash);
    return { claimed: false, record: null, leaseToken: null, leaseFence: null, quarantined: quarantinedRecord };
  }
  if (rec) registerLeaseSession(rec.execution_id, args.leaseToken, rec.lease_fence);
  await refreshSnapshot();
  return { claimed: Boolean(rec), record: rec, leaseToken: rec ? args.leaseToken : null, leaseFence: rec?.lease_fence ?? null, quarantined: null };
}

export async function renewDistributedLease(args: { paymentHash: string; executionId: string; leaseToken: string; leaseFence: number }) {
  await ensureReady();
  const vars = { payment_hash: args.paymentHash, execution_id: args.executionId, ...leaseVars(args.leaseToken, args.leaseFence) };
  const { stdout } = await run(`WITH upd AS (UPDATE missing_x402_payments SET lease_expires_at=NOW() + (:'lease_ms'::bigint * INTERVAL '1 millisecond') WHERE payment_hash=:'payment_hash' AND execution_id=:'execution_id' AND state IN ('reserved','executing','provider_done','settling') AND lease_token=:'lease_token' AND lease_fence=:'lease_fence'::bigint AND lease_expires_at > NOW() RETURNING *) SELECT row_to_json(upd) FROM upd;`, vars);
  const rec = parseRecordLine(stdout.trim());
  return { renewed: Boolean(rec), record: rec, leaseToken: rec ? args.leaseToken : null, leaseFence: rec?.lease_fence ?? null };
}

function startLeaseHeartbeat(paymentHash: string, executionId: string) {
  const session = leaseSessions.get(executionId);
  if (!session || session.timer || session.lost) return;
  const tick = async () => {
    if (session.renewing || session.lost) return;
    session.renewing = true;
    try {
      const renewed = await renewDistributedLease({ paymentHash, executionId, leaseToken: session.token, leaseFence: session.fence });
      if (!renewed.renewed) {
        session.lost = true;
        stopLeaseSession(executionId);
      } else session.renewals += 1;
    } catch {
      session.lost = true;
      stopLeaseSession(executionId);
    } finally {
      session.renewing = false;
    }
  };
  session.timer = setInterval(() => { void tick(); }, distributedLeaseHeartbeatMs());
  session.timer.unref?.();
}

function mutationContext(executionId: string, token: string, explicitFence?: number) {
  const fence = mutationFence(executionId, token, explicitFence);
  return fence === null ? null : { fence, vars: leaseVars(token, fence ?? 1) };
}

export async function markDistributedPaymentExecuting(args: { paymentHash: string; executionId: string; recipeFingerprint: string; recoveryMode: ProviderRecoveryMode; providerIdempotencyKey?: string | null; leaseToken?: string; leaseFence?: number }) {
  await ensureReady();
  const token = args.leaseToken ?? args.executionId;
  const ctx = mutationContext(args.executionId, token, args.leaseFence);
  if (!ctx) return { changed: false, record: null, leaseToken: null, leaseFence: null };
  const vars = { payment_hash: args.paymentHash, execution_id: args.executionId, recipe_fingerprint: args.recipeFingerprint, recovery_mode: args.recoveryMode, provider_idempotency_key: args.providerIdempotencyKey ?? "", ...ctx.vars };
  const { stdout } = await run(`WITH upd AS (UPDATE missing_x402_payments SET state='executing',updated_at=NOW(),reason=NULL,provider_recipe_fingerprint=:'recipe_fingerprint',provider_recovery_mode=:'recovery_mode',provider_idempotency_key=NULLIF(:'provider_idempotency_key',''),lease_expires_at=NOW() + (:'lease_ms'::bigint * INTERVAL '1 millisecond') WHERE payment_hash=:'payment_hash' AND execution_id=:'execution_id' AND state IN ('reserved','executing')${activeLeaseCondition(ctx.fence)} RETURNING *) SELECT row_to_json(upd) FROM upd;`, vars);
  await refreshSnapshot();
  const rec = parseRecordLine(stdout.trim());
  if (rec && args.leaseFence === undefined) startLeaseHeartbeat(args.paymentHash, args.executionId);
  return { changed: Boolean(rec), record: rec, leaseToken: rec ? token : null, leaseFence: rec?.lease_fence ?? null };
}

export async function markDistributedProviderDone(args: { paymentHash: string; executionId: string; customerPriceMicrousd: number; providerCostMicrousd: number | null; grossMarginMicrousd: number | null; providerAttempts: number; unknownProviderCostAttempts: number; resolution: unknown; network: string; leaseToken?: string; leaseFence?: number }) {
  await ensureReady();
  const token = args.leaseToken ?? args.executionId;
  const ctx = mutationContext(args.executionId, token, args.leaseFence);
  if (!ctx) return { changed: false, record: null, leaseToken: null, leaseFence: null };
  const vars = { payment_hash: args.paymentHash, execution_id: args.executionId, customer_price: String(args.customerPriceMicrousd), provider_cost: args.providerCostMicrousd === null ? "" : String(args.providerCostMicrousd), gross_margin: args.grossMarginMicrousd === null ? "" : String(args.grossMarginMicrousd), provider_attempts: String(args.providerAttempts), unknown_attempts: String(args.unknownProviderCostAttempts), resolution_b64: Buffer.from(JSON.stringify(args.resolution), "utf8").toString("base64"), network: args.network, ...ctx.vars };
  const { stdout } = await run(`WITH upd AS (UPDATE missing_x402_payments SET state='provider_done',updated_at=NOW(),reason=NULL,customer_price_microusd=:'customer_price'::bigint,provider_cost_microusd=NULLIF(:'provider_cost','')::bigint,gross_margin_microusd=NULLIF(:'gross_margin','')::bigint,provider_attempts=:'provider_attempts'::int,unknown_provider_cost_attempts=:'unknown_attempts'::int,resolution_json=convert_from(decode(:'resolution_b64','base64'),'UTF8'),network=:'network',lease_expires_at=NOW() + (:'lease_ms'::bigint * INTERVAL '1 millisecond') WHERE payment_hash=:'payment_hash' AND execution_id=:'execution_id' AND state='executing'${activeLeaseCondition(ctx.fence)} RETURNING *) SELECT row_to_json(upd) FROM upd;`, vars);
  await refreshSnapshot(); const rec = parseRecordLine(stdout.trim());
  return { changed: Boolean(rec), record: rec, leaseToken: rec ? token : null, leaseFence: rec?.lease_fence ?? null };
}

export async function markDistributedPaymentSettling(args: { paymentHash: string; executionId: string; customerPriceMicrousd: number; providerCostMicrousd: number | null; grossMarginMicrousd: number | null; providerAttempts: number; unknownProviderCostAttempts: number; resolution: unknown; network: string; settlementIntentId?: string | null; leaseToken?: string; leaseFence?: number }) {
  await ensureReady();
  const token = args.leaseToken ?? args.executionId;
  const ctx = mutationContext(args.executionId, token, args.leaseFence);
  if (!ctx) return { changed: false, record: null, leaseToken: null, leaseFence: null };
  const vars = { payment_hash: args.paymentHash, execution_id: args.executionId, customer_price: String(args.customerPriceMicrousd), provider_cost: args.providerCostMicrousd === null ? "" : String(args.providerCostMicrousd), gross_margin: args.grossMarginMicrousd === null ? "" : String(args.grossMarginMicrousd), provider_attempts: String(args.providerAttempts), unknown_attempts: String(args.unknownProviderCostAttempts), resolution_b64: Buffer.from(JSON.stringify(args.resolution), "utf8").toString("base64"), network: args.network, settlement_intent_id: args.settlementIntentId ?? "", ...ctx.vars };
  const { stdout } = await run(`WITH upd AS (UPDATE missing_x402_payments SET state='settling',updated_at=NOW(),reason=NULL,customer_price_microusd=:'customer_price'::bigint,provider_cost_microusd=NULLIF(:'provider_cost','')::bigint,gross_margin_microusd=NULLIF(:'gross_margin','')::bigint,provider_attempts=:'provider_attempts'::int,unknown_provider_cost_attempts=:'unknown_attempts'::int,resolution_json=convert_from(decode(:'resolution_b64','base64'),'UTF8'),network=:'network',settlement_intent_id=COALESCE(NULLIF(:'settlement_intent_id',''),settlement_intent_id),lease_expires_at=NOW() + (:'lease_ms'::bigint * INTERVAL '1 millisecond') WHERE payment_hash=:'payment_hash' AND execution_id=:'execution_id' AND state IN ('reserved','provider_done')${activeLeaseCondition(ctx.fence)} RETURNING *) SELECT row_to_json(upd) FROM upd;`, vars);
  await refreshSnapshot(); const rec = parseRecordLine(stdout.trim());
  if (rec && args.leaseFence === undefined) startLeaseHeartbeat(args.paymentHash, args.executionId);
  return { changed: Boolean(rec), record: rec, leaseToken: rec ? token : null, leaseFence: rec?.lease_fence ?? null };
}

export async function markDistributedSettlementPending(args: { paymentHash: string; executionId: string; transactionReference: string; reason: string; leaseToken?: string; leaseFence?: number }) {
  await ensureReady(); const token = args.leaseToken ?? args.executionId; const ctx = mutationContext(args.executionId, token, args.leaseFence);
  if (!ctx) return { changed: false, record: null, leaseToken: null, leaseFence: null };
  const vars = { payment_hash: args.paymentHash, execution_id: args.executionId, reason: args.reason, transaction_reference: args.transactionReference, ...ctx.vars };
  const { stdout } = await run(`WITH upd AS (UPDATE missing_x402_payments SET updated_at=NOW(),reason=:'reason',transaction_reference=:'transaction_reference',lease_expires_at=NOW() + (:'lease_ms'::bigint * INTERVAL '1 millisecond') WHERE payment_hash=:'payment_hash' AND execution_id=:'execution_id' AND state='settling'${activeLeaseCondition(ctx.fence)} RETURNING *) SELECT row_to_json(upd) FROM upd;`, vars);
  await refreshSnapshot(); const rec = parseRecordLine(stdout.trim()); return { changed: Boolean(rec), record: rec, leaseToken: rec ? token : null, leaseFence: rec?.lease_fence ?? null };
}

export async function markDistributedPaymentAmbiguous(args: { paymentHash: string; executionId: string; reason: string; from?: "reserved" | "executing" | "provider_done" | "settling"; leaseToken?: string; leaseFence?: number }) {
  await ensureReady(); const token = args.leaseToken ?? args.executionId; const ctx = mutationContext(args.executionId, token, args.leaseFence);
  if (!ctx) return { changed: false, record: null };
  const vars = { payment_hash: args.paymentHash, execution_id: args.executionId, reason: args.reason, from_state: args.from ?? "executing", ...ctx.vars };
  const { stdout } = await run(`WITH upd AS (UPDATE missing_x402_payments SET state='ambiguous',updated_at=NOW(),reason=:'reason',lease_token=NULL,lease_expires_at=NULL WHERE payment_hash=:'payment_hash' AND execution_id=:'execution_id' AND state=:'from_state'${activeLeaseCondition(ctx.fence)} RETURNING *) SELECT row_to_json(upd) FROM upd;`, vars);
  await refreshSnapshot(); const rec = parseRecordLine(stdout.trim()); if (rec) stopLeaseSession(args.executionId, true); return { changed: Boolean(rec), record: rec };
}

export async function failDistributedPayment(args: { paymentHash: string; executionId: string; reason: string; from?: "reserved" | "executing" | "provider_done" | "settling"; leaseToken?: string; leaseFence?: number }) {
  await ensureReady(); const token = args.leaseToken ?? args.executionId; const ctx = mutationContext(args.executionId, token, args.leaseFence);
  if (!ctx) return { changed: false, record: null };
  const vars = { payment_hash: args.paymentHash, execution_id: args.executionId, reason: args.reason, from_state: args.from ?? "reserved", ...ctx.vars };
  const { stdout } = await run(`WITH upd AS (UPDATE missing_x402_payments SET state='failed',updated_at=NOW(),reason=:'reason',lease_token=NULL,lease_expires_at=NULL WHERE payment_hash=:'payment_hash' AND execution_id=:'execution_id' AND state=:'from_state'${activeLeaseCondition(ctx.fence)} RETURNING *) SELECT row_to_json(upd) FROM upd;`, vars);
  await refreshSnapshot(); const rec = parseRecordLine(stdout.trim()); if (rec) stopLeaseSession(args.executionId, true); return { changed: Boolean(rec), record: rec };
}

export async function settleDistributedPayment(args: { paymentHash: string; executionId: string; transactionReference: string; responseStatus: number; responseHeaders: Record<string, string>; responseBody: unknown; leaseToken?: string; leaseFence?: number }) {
  await ensureReady();
  const cache = process.env.MISSING_TRANSACTIONAL_RESPONSE_CACHE_ENABLED === "1";
  const token = args.leaseToken ?? args.executionId;
  const ctx = mutationContext(args.executionId, token, args.leaseFence);
  if (!ctx) return { changed: false, record: null };
  const vars = { payment_hash: args.paymentHash, execution_id: args.executionId, transaction_reference: args.transactionReference, response_status: String(args.responseStatus), headers_b64: cache ? Buffer.from(JSON.stringify(args.responseHeaders), "utf8").toString("base64") : "", body_b64: cache ? Buffer.from(JSON.stringify(args.responseBody), "utf8").toString("base64") : "", ...ctx.vars };
  const { stdout } = await run(`WITH upd AS (UPDATE missing_x402_payments SET state='settled',updated_at=NOW(),reason=NULL,transaction_reference=:'transaction_reference',response_status=:'response_status'::int,response_headers_json=CASE WHEN :'headers_b64'='' THEN NULL ELSE convert_from(decode(:'headers_b64','base64'),'UTF8') END,response_body_json=CASE WHEN :'body_b64'='' THEN NULL ELSE convert_from(decode(:'body_b64','base64'),'UTF8') END,lease_token=NULL,lease_expires_at=NULL WHERE payment_hash=:'payment_hash' AND execution_id=:'execution_id' AND state='settling'${activeLeaseCondition(ctx.fence)} RETURNING *) SELECT row_to_json(upd) FROM upd;`, vars);
  await refreshSnapshot(); const rec = parseRecordLine(stdout.trim()); if (rec) stopLeaseSession(args.executionId, true); return { changed: Boolean(rec), record: rec };
}

export function cachedDistributedResponse(value: DistributedPaymentRecord) {
  if (value.state !== "settled" || value.response_status === null || !value.response_body_json) return null;
  try { return { status: value.response_status, headers: value.response_headers_json ? JSON.parse(value.response_headers_json) as Record<string, string> : {}, body: JSON.parse(value.response_body_json) as unknown }; } catch { return null; }
}

export function distributedMoneySnapshot() {
  return { ...snapshot, ...poolSnapshot(), enabled: distributedMoneyEnabled(), response_cache_enabled: process.env.MISSING_TRANSACTIONAL_RESPONSE_CACHE_ENABLED === "1" };
}

export async function truncateDistributedMoney() {
  if (!distributedMoneyEnabled()) return;
  clearLeaseSessions();
  await ensureReady();
  await run("DELETE FROM missing_x402_payments;");
  await refreshSnapshot();
}

export function closeDistributedMoney() {
  clearLeaseSessions();
  initialized = false;
  initializing = null;
  closePoolSoon();
  snapshot = { ...snapshot, ready: false, pool_total: 0, pool_idle: 0, pool_waiting: 0 };
}