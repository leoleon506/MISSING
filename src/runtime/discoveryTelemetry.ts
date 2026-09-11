import { createHmac, randomBytes } from "node:crypto";
import { Pool, type PoolConfig } from "pg";
import { distributedMoneyDatabaseUrl } from "./distributedMoney.js";

export type PublicInteractionChannel = "direct" | "smithery" | "glama" | "unknown";
export type PublicInteractionEvent =
  | "landing"
  | "agent_card"
  | "a2a"
  | "mcp_get"
  | "mcp_initialize"
  | "mcp_tools_list"
  | "mcp_tool_call"
  | "mcp_other";

export interface DiscoveryTelemetrySnapshot {
  enabled: boolean;
  ready: boolean;
  privacy: "hmac_sha256_client_ip_no_raw_inputs";
  stable_client_hashes: boolean;
  classification_ready: boolean;
  retention_days: number;
  interactions_total: number;
  interactions_24h: number;
  unique_clients_24h: number;
  mcp_interactions_24h: number;
  mcp_tool_calls_24h: number;
  unique_tool_call_clients_24h: number;
  known_directory_scans_24h: number;
  legacy_unclassified_tool_calls_24h: number;
  by_event_24h: Record<string, number>;
  by_channel_24h: Record<string, number>;
  tool_calls_by_name_24h: Record<string, number>;
  tool_calls_by_channel_24h: Record<string, number>;
  internal_tool_calls_24h: number | null;
  external_candidate_tool_calls_24h: number | null;
  external_candidate_unique_clients_24h: number | null;
  last_tool_call_at: string | null;
  last_external_candidate_at: string | null;
  last_error: string | null;
}

export interface ParsedMcpInteraction {
  event_type: PublicInteractionEvent;
  tool_name: string | null;
}

const ephemeralSecret = randomBytes(32);
let pool: Pool | null = null;
let initialized = false;
let snapshot: DiscoveryTelemetrySnapshot = emptySnapshot();

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS missing_public_interactions (
  id BIGSERIAL PRIMARY KEY,
  observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  client_hash TEXT,
  hash_epoch TEXT,
  channel TEXT NOT NULL,
  event_type TEXT NOT NULL,
  tool_name TEXT,
  status_code INTEGER,
  CONSTRAINT missing_public_interactions_channel_check
    CHECK (channel IN ('direct','smithery','glama','unknown')),
  CONSTRAINT missing_public_interactions_event_check
    CHECK (event_type IN ('landing','agent_card','a2a','mcp_get','mcp_initialize','mcp_tools_list','mcp_tool_call','mcp_other'))
);
ALTER TABLE missing_public_interactions ADD COLUMN IF NOT EXISTS hash_epoch TEXT;
CREATE INDEX IF NOT EXISTS idx_missing_public_interactions_observed_at
  ON missing_public_interactions(observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_missing_public_interactions_client_hash
  ON missing_public_interactions(client_hash)
  WHERE client_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_missing_public_interactions_hash_epoch
  ON missing_public_interactions(hash_epoch)
  WHERE hash_epoch IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_missing_public_interactions_tool_name
  ON missing_public_interactions(tool_name)
  WHERE tool_name IS NOT NULL;
`;

function enabled(): boolean {
  return process.env.MISSING_DISCOVERY_TELEMETRY_ENABLED !== "0" && Boolean(distributedMoneyDatabaseUrl());
}

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function retentionDays(): number {
  return positiveInteger(process.env.MISSING_DISCOVERY_TELEMETRY_RETENTION_DAYS, 30);
}

function stableSecret(): string | null {
  const value = process.env.MISSING_DISCOVERY_TELEMETRY_HMAC_SECRET?.trim();
  return value && value.length >= 32 ? value : null;
}

function secret(): string | Buffer {
  return stableSecret() ?? ephemeralSecret;
}

export function discoveryHashEpoch(): string | null {
  const stable = stableSecret();
  if (!stable) return null;
  return createHmac("sha256", "missing-discovery-telemetry-epoch-v1")
    .update(stable, "utf8")
    .digest("hex")
    .slice(0, 16);
}

function normalizeIp(value: string | null | undefined): string | null {
  const trimmed = value?.trim().toLowerCase();
  if (!trimmed) return null;
  return trimmed.startsWith("::ffff:") ? trimmed.slice(7) : trimmed;
}

export function discoveryClientHash(ip: string | null | undefined): string | null {
  const normalized = normalizeIp(ip);
  return normalized ? createHmac("sha256", secret()).update(normalized, "utf8").digest("hex") : null;
}

function internalClientHashes(): string[] {
  if (!stableSecret()) return [];
  return (process.env.MISSING_INTERNAL_CLIENT_IPS ?? "")
    .split(",")
    .map(value => discoveryClientHash(value))
    .filter((value): value is string => Boolean(value));
}

function classificationReady(): boolean {
  return Boolean(discoveryHashEpoch()) && internalClientHashes().length > 0;
}

function emptySnapshot(): DiscoveryTelemetrySnapshot {
  return {
    enabled: enabled(),
    ready: false,
    privacy: "hmac_sha256_client_ip_no_raw_inputs",
    stable_client_hashes: Boolean(stableSecret()),
    classification_ready: classificationReady(),
    retention_days: retentionDays(),
    interactions_total: 0,
    interactions_24h: 0,
    unique_clients_24h: 0,
    mcp_interactions_24h: 0,
    mcp_tool_calls_24h: 0,
    unique_tool_call_clients_24h: 0,
    known_directory_scans_24h: 0,
    legacy_unclassified_tool_calls_24h: 0,
    by_event_24h: {},
    by_channel_24h: {},
    tool_calls_by_name_24h: {},
    tool_calls_by_channel_24h: {},
    internal_tool_calls_24h: null,
    external_candidate_tool_calls_24h: null,
    external_candidate_unique_clients_24h: null,
    last_tool_call_at: null,
    last_external_candidate_at: null,
    last_error: null,
  };
}

function poolConfig(): PoolConfig {
  const raw = distributedMoneyDatabaseUrl();
  if (!raw) throw new Error("discovery telemetry requires PostgreSQL");
  const url = new URL(raw);
  const explicitSslmode = process.env.MISSING_POSTGRES_SSLMODE?.trim();
  if (explicitSslmode) url.searchParams.set("sslmode", explicitSslmode);
  const timeout = positiveInteger(process.env.MISSING_POSTGRES_TIMEOUT_MS, 10_000);
  return {
    connectionString: url.toString(),
    max: positiveInteger(process.env.MISSING_DISCOVERY_TELEMETRY_POOL_MAX, 2),
    idleTimeoutMillis: positiveInteger(process.env.MISSING_POSTGRES_IDLE_TIMEOUT_MS, 30_000),
    connectionTimeoutMillis: timeout,
    query_timeout: timeout,
    statement_timeout: timeout,
    application_name: "missing-discovery-telemetry",
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

export function discoveryChannelFromHeaders(headers: Record<string, string | string[] | undefined>): PublicInteractionChannel {
  const explicitRaw = headers["x-missing-entry-channel"];
  const explicit = (Array.isArray(explicitRaw) ? explicitRaw[0] : explicitRaw)?.trim().toLowerCase();
  if (explicit === "smithery" || explicit === "glama") return explicit;

  const userAgentRaw = headers["user-agent"];
  const userAgent = (Array.isArray(userAgentRaw) ? userAgentRaw[0] : userAgentRaw)?.toLowerCase() ?? "";
  if (userAgent.includes("smithery")) return "smithery";
  if (userAgent.includes("glama")) return "glama";
  return userAgent ? "direct" : "unknown";
}

function safeToolName(value: unknown): string | null {
  return typeof value === "string" && /^[a-z][a-z0-9_]{0,63}$/.test(value) ? value : null;
}

export function parseMcpInteractions(method: string | undefined, rawBody?: Buffer): ParsedMcpInteraction[] {
  if ((method ?? "GET").toUpperCase() === "GET") return [{ event_type: "mcp_get", tool_name: null }];
  if (!rawBody?.length) return [{ event_type: "mcp_other", tool_name: null }];

  try {
    const parsed = JSON.parse(rawBody.toString("utf8"));
    const messages = Array.isArray(parsed) ? parsed : [parsed];
    const events: ParsedMcpInteraction[] = [];
    for (const message of messages) {
      if (!message || typeof message !== "object" || Array.isArray(message)) {
        events.push({ event_type: "mcp_other", tool_name: null });
        continue;
      }
      const methodName = typeof message.method === "string" ? message.method : "";
      if (methodName === "initialize") events.push({ event_type: "mcp_initialize", tool_name: null });
      else if (methodName === "tools/list") events.push({ event_type: "mcp_tools_list", tool_name: null });
      else if (methodName === "tools/call") events.push({ event_type: "mcp_tool_call", tool_name: safeToolName(message?.params?.name) });
      else events.push({ event_type: "mcp_other", tool_name: null });
    }
    return events.length ? events : [{ event_type: "mcp_other", tool_name: null }];
  } catch {
    return [{ event_type: "mcp_other", tool_name: null }];
  }
}

export async function initializeDiscoveryTelemetry(): Promise<DiscoveryTelemetrySnapshot> {
  if (!enabled()) {
    initialized = false;
    snapshot = emptySnapshot();
    return snapshot;
  }
  try {
    await telemetryPool().query(SCHEMA_SQL);
    initialized = true;
    return await refreshDiscoveryTelemetrySnapshot();
  } catch (error) {
    snapshot = { ...emptySnapshot(), enabled: true, last_error: error instanceof Error ? error.message : String(error) };
    return snapshot;
  }
}

async function ensureInitialized(): Promise<boolean> {
  if (initialized) return true;
  const current = await initializeDiscoveryTelemetry();
  return current.ready;
}

export async function observePublicInteractions(args: {
  clientIp?: string | null;
  headers?: Record<string, string | string[] | undefined>;
  events: ParsedMcpInteraction[] | Array<{ event_type: PublicInteractionEvent; tool_name?: string | null }>;
  statusCode?: number | null;
}): Promise<void> {
  if (!enabled() || !await ensureInitialized()) return;
  const clientHash = discoveryClientHash(args.clientIp);
  const hashEpoch = discoveryHashEpoch();
  const channel = discoveryChannelFromHeaders(args.headers ?? {});
  const statusCode = Number.isInteger(args.statusCode) ? args.statusCode! : null;
  for (const event of args.events) {
    await telemetryPool().query(
      `INSERT INTO missing_public_interactions(client_hash,hash_epoch,channel,event_type,tool_name,status_code)
       VALUES($1,$2,$3,$4,$5,$6)`,
      [clientHash, hashEpoch, channel, event.event_type, event.tool_name ?? null, statusCode],
    );
  }
}

function integer(value: unknown): number {
  const parsed = typeof value === "string" ? Number(value) : value;
  return typeof parsed === "number" && Number.isSafeInteger(parsed) ? parsed : 0;
}

function mapOf(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, integer(item)]));
}

function iso(value: unknown): string | null {
  if (value instanceof Date) return value.toISOString();
  return typeof value === "string" && value ? new Date(value).toISOString() : null;
}

export async function refreshDiscoveryTelemetrySnapshot(): Promise<DiscoveryTelemetrySnapshot> {
  if (!enabled()) return snapshot = emptySnapshot();
  if (!initialized) {
    const current = await initializeDiscoveryTelemetry();
    if (!current.ready) return current;
  }

  const internalHashes = internalClientHashes();
  const currentEpoch = discoveryHashEpoch();
  const classification = classificationReady();
  try {
    await telemetryPool().query(
      `DELETE FROM missing_public_interactions WHERE observed_at < NOW() - ($1::int * INTERVAL '1 day')`,
      [retentionDays()],
    );
    const result = await telemetryPool().query(`
      WITH recent AS (
        SELECT * FROM missing_public_interactions WHERE observed_at >= NOW() - INTERVAL '24 hours'
      ), by_event AS (
        SELECT event_type,COUNT(*)::bigint AS count FROM recent GROUP BY event_type
      ), by_channel AS (
        SELECT channel,COUNT(*)::bigint AS count FROM recent GROUP BY channel
      ), by_tool AS (
        SELECT COALESCE(tool_name,'unknown') AS tool_name,COUNT(*)::bigint AS count
        FROM recent WHERE event_type='mcp_tool_call' GROUP BY COALESCE(tool_name,'unknown')
      ), tool_by_channel AS (
        SELECT channel,COUNT(*)::bigint AS count FROM recent WHERE event_type='mcp_tool_call' GROUP BY channel
      )
      SELECT
        (SELECT COUNT(*)::bigint FROM missing_public_interactions) AS interactions_total,
        (SELECT COUNT(*)::bigint FROM recent) AS interactions_24h,
        (SELECT COUNT(DISTINCT client_hash)::bigint FROM recent WHERE client_hash IS NOT NULL) AS unique_clients_24h,
        (SELECT COUNT(*)::bigint FROM recent WHERE event_type LIKE 'mcp_%') AS mcp_interactions_24h,
        (SELECT COUNT(*)::bigint FROM recent WHERE event_type='mcp_tool_call') AS mcp_tool_calls_24h,
        (SELECT COUNT(DISTINCT client_hash)::bigint FROM recent WHERE event_type='mcp_tool_call' AND client_hash IS NOT NULL) AS unique_tool_call_clients_24h,
        (SELECT COUNT(*)::bigint FROM recent WHERE channel IN ('smithery','glama') AND event_type IN ('mcp_initialize','mcp_tools_list','mcp_get')) AS known_directory_scans_24h,
        (SELECT COUNT(*)::bigint FROM recent WHERE event_type='mcp_tool_call' AND ($2::text IS NULL OR hash_epoch IS DISTINCT FROM $2::text)) AS legacy_unclassified_tool_calls_24h,
        COALESCE((SELECT jsonb_object_agg(event_type,count) FROM by_event),'{}'::jsonb) AS by_event_24h,
        COALESCE((SELECT jsonb_object_agg(channel,count) FROM by_channel),'{}'::jsonb) AS by_channel_24h,
        COALESCE((SELECT jsonb_object_agg(tool_name,count) FROM by_tool),'{}'::jsonb) AS tool_calls_by_name_24h,
        COALESCE((SELECT jsonb_object_agg(channel,count) FROM tool_by_channel),'{}'::jsonb) AS tool_calls_by_channel_24h,
        (SELECT COUNT(*)::bigint FROM recent WHERE event_type='mcp_tool_call' AND hash_epoch=$2::text AND client_hash = ANY($1::text[])) AS internal_tool_calls_24h,
        (SELECT COUNT(*)::bigint FROM recent WHERE event_type='mcp_tool_call' AND hash_epoch=$2::text AND client_hash IS NOT NULL AND NOT (client_hash = ANY($1::text[]))) AS external_candidate_tool_calls_24h,
        (SELECT COUNT(DISTINCT client_hash)::bigint FROM recent WHERE event_type='mcp_tool_call' AND hash_epoch=$2::text AND client_hash IS NOT NULL AND NOT (client_hash = ANY($1::text[]))) AS external_candidate_unique_clients_24h,
        (SELECT MAX(observed_at) FROM recent WHERE event_type='mcp_tool_call') AS last_tool_call_at,
        (SELECT MAX(observed_at) FROM recent WHERE event_type='mcp_tool_call' AND hash_epoch=$2::text AND client_hash IS NOT NULL AND NOT (client_hash = ANY($1::text[]))) AS last_external_candidate_at;
    `, [internalHashes, currentEpoch]);
    const row = result.rows[0] ?? {};
    snapshot = {
      enabled: true,
      ready: true,
      privacy: "hmac_sha256_client_ip_no_raw_inputs",
      stable_client_hashes: Boolean(stableSecret()),
      classification_ready: classification,
      retention_days: retentionDays(),
      interactions_total: integer(row.interactions_total),
      interactions_24h: integer(row.interactions_24h),
      unique_clients_24h: integer(row.unique_clients_24h),
      mcp_interactions_24h: integer(row.mcp_interactions_24h),
      mcp_tool_calls_24h: integer(row.mcp_tool_calls_24h),
      unique_tool_call_clients_24h: integer(row.unique_tool_call_clients_24h),
      known_directory_scans_24h: integer(row.known_directory_scans_24h),
      legacy_unclassified_tool_calls_24h: integer(row.legacy_unclassified_tool_calls_24h),
      by_event_24h: mapOf(row.by_event_24h),
      by_channel_24h: mapOf(row.by_channel_24h),
      tool_calls_by_name_24h: mapOf(row.tool_calls_by_name_24h),
      tool_calls_by_channel_24h: mapOf(row.tool_calls_by_channel_24h),
      internal_tool_calls_24h: classification ? integer(row.internal_tool_calls_24h) : null,
      external_candidate_tool_calls_24h: classification ? integer(row.external_candidate_tool_calls_24h) : null,
      external_candidate_unique_clients_24h: classification ? integer(row.external_candidate_unique_clients_24h) : null,
      last_tool_call_at: iso(row.last_tool_call_at),
      last_external_candidate_at: classification ? iso(row.last_external_candidate_at) : null,
      last_error: null,
    };
  } catch (error) {
    snapshot = { ...snapshot, enabled: true, ready: false, stable_client_hashes: Boolean(stableSecret()), classification_ready: classification, last_error: error instanceof Error ? error.message : String(error) };
  }
  return snapshot;
}

export function discoveryTelemetrySnapshot(): DiscoveryTelemetrySnapshot {
  return {
    ...snapshot,
    by_event_24h: { ...snapshot.by_event_24h },
    by_channel_24h: { ...snapshot.by_channel_24h },
    tool_calls_by_name_24h: { ...snapshot.tool_calls_by_name_24h },
    tool_calls_by_channel_24h: { ...snapshot.tool_calls_by_channel_24h },
  };
}

export async function closeDiscoveryTelemetry(): Promise<void> {
  const current = pool;
  pool = null;
  initialized = false;
  if (current) await current.end().catch(() => undefined);
}
