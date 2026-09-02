import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { economicsLedgerPath } from "./economics.js";

export type TransactionalPaymentState = "reserved" | "settling" | "settled" | "failed";

export interface TransactionalPaymentRecord {
  payment_hash: string;
  request_hash: string | null;
  execution_id: string;
  capability: string;
  state: TransactionalPaymentState;
  created_at: string;
  updated_at: string;
  reason: string | null;
  transaction_reference: string | null;
  response_status: number | null;
  response_headers_json: string | null;
  response_body_json: string | null;
  customer_price_microusd: number | null;
  provider_cost_microusd: number | null;
  gross_margin_microusd: number | null;
}

let overridePath: string | null | undefined;
let database: DatabaseSync | null = null;
let databasePath: string | null = null;

export function transactionalMoneyEnabled(): boolean {
  return process.env.MISSING_TRANSACTIONAL_MONEY_ENABLED === "1";
}

export function transactionalResponseCacheEnabled(): boolean {
  return process.env.MISSING_TRANSACTIONAL_RESPONSE_CACHE_ENABLED === "1";
}

export function transactionalMoneyPath(): string | null {
  if (overridePath !== undefined) return overridePath;
  if (process.env.MISSING_TRANSACTIONAL_MONEY_DB) return resolve(process.env.MISSING_TRANSACTIONAL_MONEY_DB);
  const economicsPath = economicsLedgerPath();
  if (economicsPath) return join(dirname(economicsPath), "money.sqlite");
  if (process.env.NODE_ENV === "test") return null;
  return resolve(".missing/money.sqlite");
}

export function configureTransactionalMoney(path: string | null | undefined) {
  if (database) database.close();
  database = null;
  databasePath = null;
  overridePath = path === undefined ? undefined : path === null ? null : resolve(path);
}

function db(): DatabaseSync | null {
  if (!transactionalMoneyEnabled()) return null;
  const path = transactionalMoneyPath();
  if (!path) return null;
  if (database && databasePath === path) return database;
  if (database) database.close();
  mkdirSync(dirname(path), { recursive: true });
  const opened = new DatabaseSync(path);
  opened.exec("PRAGMA journal_mode=WAL");
  opened.exec("PRAGMA synchronous=FULL");
  opened.exec("PRAGMA busy_timeout=5000");
  opened.exec(`
    CREATE TABLE IF NOT EXISTS x402_payments (
      payment_hash TEXT PRIMARY KEY,
      request_hash TEXT,
      execution_id TEXT NOT NULL UNIQUE,
      capability TEXT NOT NULL,
      state TEXT NOT NULL CHECK (state IN ('reserved','settling','settled','failed')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      reason TEXT,
      transaction_reference TEXT,
      response_status INTEGER,
      response_headers_json TEXT,
      response_body_json TEXT,
      customer_price_microusd INTEGER,
      provider_cost_microusd INTEGER,
      gross_margin_microusd INTEGER
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_x402_transaction_reference
      ON x402_payments(transaction_reference)
      WHERE transaction_reference IS NOT NULL;
  `);
  const columns = opened.prepare("PRAGMA table_info(x402_payments)").all() as Array<{ name: string }>;
  if (!columns.some(column => column.name === "request_hash")) opened.exec("ALTER TABLE x402_payments ADD COLUMN request_hash TEXT");
  database = opened;
  databasePath = path;
  return opened;
}

function row(value: unknown): TransactionalPaymentRecord | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  return {
    ...(raw as unknown as TransactionalPaymentRecord),
    request_hash: raw.request_hash == null ? null : String(raw.request_hash),
  };
}

export function transactionalPayment(paymentHash: string): TransactionalPaymentRecord | null {
  const opened = db();
  if (!opened) return null;
  return row(opened.prepare("SELECT * FROM x402_payments WHERE payment_hash = ?").get(paymentHash));
}

export function reserveTransactionalPayment(args: { paymentHash: string; requestHash: string; executionId: string; capability: string }) {
  const opened = db();
  if (!opened) return { enabled: false as const, reserved: false as const, prior: null };
  const now = new Date().toISOString();
  opened.exec("BEGIN IMMEDIATE");
  try {
    const result = opened.prepare(`
      INSERT OR IGNORE INTO x402_payments
        (payment_hash, request_hash, execution_id, capability, state, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'reserved', ?, ?)
    `).run(args.paymentHash, args.requestHash, args.executionId, args.capability, now, now);
    const prior = transactionalPayment(args.paymentHash);
    opened.exec("COMMIT");
    return { enabled: true as const, reserved: result.changes === 1, prior };
  } catch (error) {
    opened.exec("ROLLBACK");
    throw error;
  }
}

function transition(args: {
  paymentHash: string;
  executionId: string;
  from: TransactionalPaymentState;
  to: TransactionalPaymentState;
  reason?: string | null;
  transactionReference?: string | null;
  responseStatus?: number | null;
  responseHeadersJson?: string | null;
  responseBodyJson?: string | null;
  customerPriceMicrousd?: number | null;
  providerCostMicrousd?: number | null;
  grossMarginMicrousd?: number | null;
}) {
  const opened = db();
  if (!opened) return { changed: false, record: null as TransactionalPaymentRecord | null };
  const now = new Date().toISOString();
  const result = opened.prepare(`
    UPDATE x402_payments
       SET state = ?, updated_at = ?, reason = ?, transaction_reference = ?,
           response_status = ?, response_headers_json = ?, response_body_json = ?,
           customer_price_microusd = ?, provider_cost_microusd = ?, gross_margin_microusd = ?
     WHERE payment_hash = ? AND execution_id = ? AND state = ?
  `).run(
    args.to,
    now,
    args.reason ?? null,
    args.transactionReference ?? null,
    args.responseStatus ?? null,
    args.responseHeadersJson ?? null,
    args.responseBodyJson ?? null,
    args.customerPriceMicrousd ?? null,
    args.providerCostMicrousd ?? null,
    args.grossMarginMicrousd ?? null,
    args.paymentHash,
    args.executionId,
    args.from,
  );
  return { changed: result.changes === 1, record: transactionalPayment(args.paymentHash) };
}

export function markTransactionalPaymentSettling(args: { paymentHash: string; executionId: string }) {
  return transition({ ...args, from: "reserved", to: "settling" });
}

export function failTransactionalPayment(args: { paymentHash: string; executionId: string; reason: string; from?: "reserved" | "settling" }) {
  return transition({ ...args, from: args.from ?? "reserved", to: "failed", reason: args.reason });
}

export function settleTransactionalPayment(args: {
  paymentHash: string;
  executionId: string;
  transactionReference: string;
  responseStatus: number;
  responseHeaders: Record<string, string>;
  responseBody: unknown;
  customerPriceMicrousd: number;
  providerCostMicrousd: number | null;
  grossMarginMicrousd: number | null;
}) {
  return transition({
    paymentHash: args.paymentHash,
    executionId: args.executionId,
    from: "settling",
    to: "settled",
    transactionReference: args.transactionReference,
    responseStatus: args.responseStatus,
    responseHeadersJson: transactionalResponseCacheEnabled() ? JSON.stringify(args.responseHeaders) : null,
    responseBodyJson: transactionalResponseCacheEnabled() ? JSON.stringify(args.responseBody) : null,
    customerPriceMicrousd: args.customerPriceMicrousd,
    providerCostMicrousd: args.providerCostMicrousd,
    grossMarginMicrousd: args.grossMarginMicrousd,
  });
}

export function cachedTransactionalResponse(record: TransactionalPaymentRecord) {
  if (record.state !== "settled" || record.response_status === null || !record.response_body_json) return null;
  try {
    const headers = record.response_headers_json ? JSON.parse(record.response_headers_json) as Record<string, string> : {};
    const body = JSON.parse(record.response_body_json) as unknown;
    return { status: record.response_status, headers, body };
  } catch {
    return null;
  }
}

export function transactionalMoneySnapshot() {
  const opened = db();
  if (!opened) {
    return {
      enabled: transactionalMoneyEnabled(),
      ready: false,
      response_cache_enabled: transactionalResponseCacheEnabled(),
      payments: 0,
      request_bound: 0,
      legacy_unbound: 0,
      reserved: 0,
      settling: 0,
      settled: 0,
      failed: 0,
    };
  }
  const counts = opened.prepare(`
    SELECT
      COUNT(*) AS payments,
      SUM(CASE WHEN request_hash IS NOT NULL THEN 1 ELSE 0 END) AS request_bound,
      SUM(CASE WHEN request_hash IS NULL THEN 1 ELSE 0 END) AS legacy_unbound,
      SUM(CASE WHEN state='reserved' THEN 1 ELSE 0 END) AS reserved,
      SUM(CASE WHEN state='settling' THEN 1 ELSE 0 END) AS settling,
      SUM(CASE WHEN state='settled' THEN 1 ELSE 0 END) AS settled,
      SUM(CASE WHEN state='failed' THEN 1 ELSE 0 END) AS failed
    FROM x402_payments
  `).get() as Record<string, number | bigint | null>;
  const n = (value: number | bigint | null | undefined) => Number(value ?? 0);
  return {
    enabled: true,
    ready: true,
    response_cache_enabled: transactionalResponseCacheEnabled(),
    payments: n(counts.payments),
    request_bound: n(counts.request_bound),
    legacy_unbound: n(counts.legacy_unbound),
    reserved: n(counts.reserved),
    settling: n(counts.settling),
    settled: n(counts.settled),
    failed: n(counts.failed),
  };
}

export function truncateTransactionalMoney() {
  const opened = db();
  if (opened) opened.exec("DELETE FROM x402_payments");
}
