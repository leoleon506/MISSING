import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { demandLedgerPath } from "./demandLedger.js";

export interface SupplyBlockEvent {
  version: 1;
  blocked_at: string;
  normalized_intent: string;
  intent: string;
  provider: string | null;
  reason: string;
  credentials_required: string[];
  response_schema_missing: boolean;
  retry_after: string;
  attempt: number;
}

let overridePath: string | null | undefined;

export function supplyBlockLedgerPath(): string | null {
  if (overridePath !== undefined) return overridePath;
  if (process.env.MISSING_SUPPLY_BLOCK_LEDGER) return resolve(process.env.MISSING_SUPPLY_BLOCK_LEDGER);
  const demandPath = demandLedgerPath();
  if (demandPath) return join(dirname(demandPath), "supply-blocks.jsonl");
  if (process.env.NODE_ENV === "test") return null;
  return resolve(".missing/supply-blocks.jsonl");
}

export function configureSupplyBlockLedger(path: string | null | undefined) {
  overridePath = path === undefined ? undefined : path === null ? null : resolve(path);
}

export function blockBackoffMs(attempt: number): number {
  const base = Number(process.env.MISSING_SUPPLY_BLOCK_BACKOFF_MS ?? 86_400_000);
  const safeBase = Number.isFinite(base) && base > 0 ? base : 86_400_000;
  const multiplier = Math.min(2 ** Math.max(0, attempt - 1), 30);
  return Math.min(safeBase * multiplier, 30 * 86_400_000);
}

export function latestSupplyBlocks(): Map<string, SupplyBlockEvent> {
  const path = supplyBlockLedgerPath();
  const result = new Map<string, SupplyBlockEvent>();
  if (!path || !existsSync(path)) return result;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/).filter(Boolean)) {
    try {
      const value = JSON.parse(line) as Partial<SupplyBlockEvent>;
      if (value.version !== 1 || typeof value.normalized_intent !== "string" || typeof value.intent !== "string" || typeof value.reason !== "string" || typeof value.blocked_at !== "string" || typeof value.retry_after !== "string" || typeof value.attempt !== "number") continue;
      result.set(value.normalized_intent, {
        version: 1,
        blocked_at: value.blocked_at,
        normalized_intent: value.normalized_intent,
        intent: value.intent,
        provider: typeof value.provider === "string" ? value.provider : null,
        reason: value.reason,
        credentials_required: Array.isArray(value.credentials_required) ? value.credentials_required.filter((item): item is string => typeof item === "string") : [],
        response_schema_missing: value.response_schema_missing === true,
        retry_after: value.retry_after,
        attempt: value.attempt,
      });
    } catch {
      // Ignore malformed historical lines rather than making the runtime unavailable.
    }
  }
  return result;
}

export function recordSupplyBlock(input: Omit<SupplyBlockEvent, "version" | "blocked_at" | "retry_after" | "attempt">, now = new Date()): SupplyBlockEvent {
  const previous = latestSupplyBlocks().get(input.normalized_intent);
  const attempt = (previous?.attempt ?? 0) + 1;
  const blockedAt = now.toISOString();
  const retryAfter = new Date(now.getTime() + blockBackoffMs(attempt)).toISOString();
  const event: SupplyBlockEvent = { version: 1, blocked_at: blockedAt, retry_after: retryAfter, attempt, ...input };
  const path = supplyBlockLedgerPath();
  if (path) {
    mkdirSync(dirname(path), { recursive: true });
    appendFileSync(path, `${JSON.stringify(event)}\n`, "utf8");
  }
  return event;
}

export function isSupplyIntentBlocked(normalizedIntent: string, now = new Date()): boolean {
  const block = latestSupplyBlocks().get(normalizedIntent);
  return !!block && Date.parse(block.retry_after) > now.getTime();
}

export function truncateSupplyBlockLedger() {
  const path = supplyBlockLedgerPath();
  if (!path) return;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, "", "utf8");
}
