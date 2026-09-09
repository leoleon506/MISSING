import { createHash } from "node:crypto";
import { Pool, type PoolConfig } from "pg";
import { distributedMoneyDatabaseUrl, distributedMoneyEnabled } from "./distributedMoney.js";
import { parseX402PaymentSignature } from "./x402.js";

export type ConsumerEntryChannel = "http" | "mcp" | "a2a" | "bazaar" | "smithery" | "unknown";

export interface ConsumerTelemetrySnapshot {
  enabled: boolean;
  ready: boolean;
  classification_ready: boolean;
  privacy: "payer_sha256_only";
  attributed_payments: number;
  attributed_settled: number;
  unattributed_settled: number;
  unknown_payer_settled: number;
  internal_settled: number | null;
  external_settled: number | null;
  external_unique_payers: number | null;
  external_customer_revenue_microusd: number | null;
  external_known_provider_cost_microusd: number | null;
  external_known_gross_margin_microusd: number | null;
  settled_by_channel: Record<string, number>;
  external_settled_by_channel: Record<string, number> | null;
  last_error: string | null;
}

let pool: Pool | null = null;
let initialized = false;
let snapshot: ConsumerTelemetrySnapshot = emptySnapshot();

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS missing_consumer_attribution (
  payment_hash TEXT PRIMARY KEY,
  payer_hash TEXT,
  entry_channel TEXT NOT NULL DEFAULT 'http',
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT missing_consumer_attribution_channel_check
    CHECK (entry_channel IN ('http','mcp','a2a','bazaar','smithery','unknown'))
);
CREATE INDEX IF NOT EXISTS idx_missing_consumer_attribution_payer_hash
  ON missing_consumer_attribution(payer_hash)
  WHERE payer_hash IS NOT NULL;
`;

function emptySnapshot(): ConsumerTelemetrySnapshot {
  return {
    enabled: distributedMoneyEnabled(),
    ready: false,
    classification_ready: internalPayerHashes().size > 0,
    privacy: "payer_sha256_only",
    attributed_payments: 0,
    attributed_settled: 0,
    unattributed_settled: 0,
    unknown_payer_settled: 0,
    internal_settled: null,
    external_settled: null,
    external_unique_payers: null,
    external_customer_revenue_microusd: null,
    external_known_provider_cost_microusd: null,
    external_known_gross_margin_microusd: null,
    settled_by_channel: {},
    external_settled_by_channel: null,
    last_error: null,
  };
}

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function poolConfig(): PoolConfig {
  const raw = distributedMoneyDatabaseUrl();
  if (!raw) throw new Error("consumer telemetry requires the distributed PostgreSQL URL");
  const url = new URL(raw);
  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") throw new Error("Invalid PostgreSQL URL protocol");
  const explicitSslmode = process.env.MISSING_POSTGRES_SSLMODE?.trim();
  if (explicitSslmode) url.searchParams.set("sslmode", explicitSslmode);
  const timeout = positiveInteger(process.env.MISSING_POSTGRES_TIMEOUT_MS, 10_000);
  return {
    connectionString: url.toString(),
    max: positiveInteger(process.env.MISSING_CONSUMER_TELEMETRY_POOL_MAX, 2),
    idleTimeoutMillis: positiveInteger(process.env.MISSING_POSTGRES_IDLE_TIMEOUT_MS, 30_000),
    connectionTimeoutMillis: timeout,
    query_timeout: timeout,
    statement_timeout: timeout,
    application_name: "missing-consumer-telemetry",
  };
}

function telemetryPool(): Pool {
  if (pool) return pool;
  const created = new Pool(poolConfig());
  created.on("error", error => {
    snapshot = { ...snapshot, ready: false, last_error: error.message };
  });
  pool = created;
  return created;
}

function normalizeAddress(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return /^0x[0-9a-f]{40}$/.test(normalized) ? normalized : null;
}

export function payerHashFromAddress(address: string): string | null {
  const normalized = normalizeAddress(address);
  return normalized ? createHash("sha256").update(normalized, "utf8").digest("hex") : null;
}

export function paymentHashFromSignature(signature: string): string {
  return createHash("sha256").update(signature, "utf8").digest("hex");
}

export function payerAddressFromPaymentSignature(signature: string): string | null {
  const parsed = parseX402PaymentSignature(signature) as any;
  if (!parsed || typeof parsed !== "object") return null;
  const candidates = [
    parsed?.payload?.authorization?.from,
    parsed?.authorization?.from,
    parsed?.payload?.from,
    parsed?.payer,
    parsed?.from,
  ];
  for (const candidate of candidates) {
    const normalized = normalizeAddress(candidate);
    if (normalized) return normalized;
  }
  return null;
}

export function internalPayerHashes(): Set<string> {
  const values = (process.env.MISSING_INTERNAL_PAYER_ADDRESSES ?? "")
    .split(",")
    .map(value => payerHashFromAddress(value))
    .filter((value): value is string => Boolean(value));
  return new Set(values);
}

export function normalizeConsumerEntryChannel(value: string | null | undefined): ConsumerEntryChannel {
  const normalized = value?.trim().toLowerCase();
  return normalized === "mcp" || normalized === "a2a" || normalized === "bazaar" || normalized === "smithery" || normalized === "http"
    ? normalized
    : normalized ? "unknown" : "http";
}

export async function initializeConsumerTelemetry(): Promise<ConsumerTelemetrySnapshot> {
  if (!distributedMoneyEnabled()) {
    initialized = false;
    snapshot = emptySnapshot();
    return snapshot;
  }
  try {
    await telemetryPool().query(SCHEMA_SQL);
    initialized = true;
    return await refreshConsumerTelemetrySnapshot();
  } catch (error) {
    snapshot = { ...emptySnapshot(), enabled: true, last_error: error instanceof Error ? error.message : String(error) };
    return snapshot;
  }
}

async function ensureInitialized() {
  if (initialized) return true;
  const initializedSnapshot = await initializeConsumerTelemetry();
  return initializedSnapshot.ready;
}

/**
 * Persist privacy-preserving attribution only when the payment hash already exists
 * in the durable financial ledger. This prevents arbitrary unsigned/spoofed headers
 * from creating telemetry rows. Raw payer addresses and PAYMENT-SIGNATURE values are
 * never stored.
 */
export async function observeDurableConsumerPayment(args: {
  paymentSignature: string;
  entryChannel?: string | null;
}): Promise<{ recorded: boolean; payment_hash: string; payer_hash: string | null; entry_channel: ConsumerEntryChannel }> {
  const paymentHash = paymentHashFromSignature(args.paymentSignature);
  const payer = payerAddressFromPaymentSignature(args.paymentSignature);
  const payerHash = payer ? payerHashFromAddress(payer) : null;
  const entryChannel = normalizeConsumerEntryChannel(args.entryChannel);
  if (!distributedMoneyEnabled() || !await ensureInitialized()) return { recorded: false, payment_hash: paymentHash, payer_hash: payerHash, entry_channel: entryChannel };

  const result = await telemetryPool().query(
    `INSERT INTO missing_consumer_attribution(payment_hash,payer_hash,entry_channel)
     SELECT $1,$2,$3
     WHERE EXISTS (SELECT 1 FROM missing_x402_payments WHERE payment_hash=$1)
     ON CONFLICT (payment_hash) DO UPDATE SET
       payer_hash=COALESCE(missing_consumer_attribution.payer_hash,EXCLUDED.payer_hash),
       entry_channel=CASE
         WHEN missing_consumer_attribution.entry_channel='http' AND EXCLUDED.entry_channel<>'http' THEN EXCLUDED.entry_channel
         ELSE missing_consumer_attribution.entry_channel
       END,
       last_seen_at=NOW()
     RETURNING payment_hash;`,
    [paymentHash, payerHash, entryChannel],
  );
  await refreshConsumerTelemetrySnapshot();
  return { recorded: result.rowCount === 1, payment_hash: paymentHash, payer_hash: payerHash, entry_channel: entryChannel };
}

function integer(value: unknown): number {
  const parsed = typeof value === "string" ? Number(value) : value;
  return typeof parsed === "number" && Number.isSafeInteger(parsed) ? parsed : 0;
}

function channelMap(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, integer(item)]));
}

export async function refreshConsumerTelemetrySnapshot(): Promise<ConsumerTelemetrySnapshot> {
  if (!distributedMoneyEnabled()) return snapshot = emptySnapshot();
  if (!initialized) {
    const initializedSnapshot = await initializeConsumerTelemetry();
    if (!initializedSnapshot.ready) return initializedSnapshot;
  }

  const internal = [...internalPayerHashes()];
  const classificationReady = internal.length > 0;
  try {
    const result = await telemetryPool().query(`
      WITH joined AS (
        SELECT a.payment_hash,a.payer_hash,a.entry_channel,p.state,
               p.customer_price_microusd,p.provider_cost_microusd,p.gross_margin_microusd,
               CASE
                 WHEN a.payer_hash IS NULL THEN 'unknown'
                 WHEN array_length($1::text[],1) IS NULL THEN 'unconfigured'
                 WHEN a.payer_hash = ANY($1::text[]) THEN 'internal'
                 ELSE 'external'
               END AS consumer_class
        FROM missing_consumer_attribution a
        JOIN missing_x402_payments p ON p.payment_hash=a.payment_hash
      ), channel_counts AS (
        SELECT entry_channel,COUNT(*)::bigint AS count
        FROM joined WHERE state='settled' GROUP BY entry_channel
      ), external_channel_counts AS (
        SELECT entry_channel,COUNT(*)::bigint AS count
        FROM joined WHERE state='settled' AND consumer_class='external' GROUP BY entry_channel
      )
      SELECT
        (SELECT COUNT(*)::bigint FROM missing_consumer_attribution) AS attributed_payments,
        (SELECT COUNT(*)::bigint FROM joined WHERE state='settled') AS attributed_settled,
        (SELECT COUNT(*)::bigint FROM missing_x402_payments p WHERE p.state='settled' AND NOT EXISTS (SELECT 1 FROM missing_consumer_attribution a WHERE a.payment_hash=p.payment_hash)) AS unattributed_settled,
        (SELECT COUNT(*)::bigint FROM joined WHERE state='settled' AND consumer_class='unknown') AS unknown_payer_settled,
        (SELECT COUNT(*)::bigint FROM joined WHERE state='settled' AND consumer_class='internal') AS internal_settled,
        (SELECT COUNT(*)::bigint FROM joined WHERE state='settled' AND consumer_class='external') AS external_settled,
        (SELECT COUNT(DISTINCT payer_hash)::bigint FROM joined WHERE state='settled' AND consumer_class='external') AS external_unique_payers,
        (SELECT COALESCE(SUM(customer_price_microusd),0)::bigint FROM joined WHERE state='settled' AND consumer_class='external') AS external_customer_revenue_microusd,
        (SELECT COALESCE(SUM(provider_cost_microusd),0)::bigint FROM joined WHERE state='settled' AND consumer_class='external' AND provider_cost_microusd IS NOT NULL) AS external_known_provider_cost_microusd,
        (SELECT COALESCE(SUM(gross_margin_microusd),0)::bigint FROM joined WHERE state='settled' AND consumer_class='external' AND gross_margin_microusd IS NOT NULL) AS external_known_gross_margin_microusd,
        COALESCE((SELECT jsonb_object_agg(entry_channel,count) FROM channel_counts),'{}'::jsonb) AS settled_by_channel,
        COALESCE((SELECT jsonb_object_agg(entry_channel,count) FROM external_channel_counts),'{}'::jsonb) AS external_settled_by_channel;
    `, [internal]);
    const row = result.rows[0] ?? {};
    snapshot = {
      enabled: true,
      ready: true,
      classification_ready: classificationReady,
      privacy: "payer_sha256_only",
      attributed_payments: integer(row.attributed_payments),
      attributed_settled: integer(row.attributed_settled),
      unattributed_settled: integer(row.unattributed_settled),
      unknown_payer_settled: integer(row.unknown_payer_settled),
      internal_settled: classificationReady ? integer(row.internal_settled) : null,
      external_settled: classificationReady ? integer(row.external_settled) : null,
      external_unique_payers: classificationReady ? integer(row.external_unique_payers) : null,
      external_customer_revenue_microusd: classificationReady ? integer(row.external_customer_revenue_microusd) : null,
      external_known_provider_cost_microusd: classificationReady ? integer(row.external_known_provider_cost_microusd) : null,
      external_known_gross_margin_microusd: classificationReady ? integer(row.external_known_gross_margin_microusd) : null,
      settled_by_channel: channelMap(row.settled_by_channel),
      external_settled_by_channel: classificationReady ? channelMap(row.external_settled_by_channel) : null,
      last_error: null,
    };
  } catch (error) {
    snapshot = { ...snapshot, enabled: true, ready: false, classification_ready: classificationReady, last_error: error instanceof Error ? error.message : String(error) };
  }
  return snapshot;
}

export function consumerTelemetrySnapshot(): ConsumerTelemetrySnapshot {
  return { ...snapshot, settled_by_channel: { ...snapshot.settled_by_channel }, external_settled_by_channel: snapshot.external_settled_by_channel ? { ...snapshot.external_settled_by_channel } : null };
}

export async function closeConsumerTelemetry() {
  const current = pool;
  pool = null;
  initialized = false;
  if (current) await current.end().catch(() => undefined);
}
