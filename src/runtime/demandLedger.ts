import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

export type DemandSource = "mcp" | "a2a" | "runtime" | "unknown" | string;
export type DemandExampleScalar = string | number | boolean;
export type DemandExampleInput = Record<string, DemandExampleScalar>;

export interface DemandLedgerEvent {
  version: 1;
  observed_at: string;
  intent: string;
  normalized_intent: string;
  capability: string | null;
  source: DemandSource;
  example_input?: DemandExampleInput;
}

let overridePath: string | null | undefined;

const SENSITIVE_INPUT_KEYS = new Set([
  "authorization", "bearer", "cookie", "password", "passwd", "secret", "token", "accesstoken", "refreshtoken",
  "apikey", "privatekey", "clientsecret", "seed", "mnemonic", "credential", "credentials",
]);

function normalizedInputKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export function sanitizeDemandExampleInput(value: unknown): DemandExampleInput | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const entries = Object.entries(value as Record<string, unknown>);
  if (!entries.length || entries.length > 16) return null;
  const result: DemandExampleInput = {};
  for (const [key, raw] of entries) {
    if (!key.trim() || key.length > 64 || SENSITIVE_INPUT_KEYS.has(normalizedInputKey(key))) return null;
    if (typeof raw === "string") {
      if (!raw.length || raw.length > 512) return null;
      result[key] = raw;
      continue;
    }
    if (typeof raw === "number") {
      if (!Number.isFinite(raw)) return null;
      result[key] = raw;
      continue;
    }
    if (typeof raw === "boolean") {
      result[key] = raw;
      continue;
    }
    return null;
  }
  return JSON.stringify(result).length <= 4096 ? result : null;
}

export function demandLedgerPath(): string | null {
  if (overridePath !== undefined) return overridePath;
  if (process.env.NODE_ENV === "test" && !process.env.MISSING_DEMAND_LEDGER) return null;
  const configured = process.env.MISSING_DEMAND_LEDGER ?? ".missing/demand.jsonl";
  return resolve(configured);
}

export function configureDemandLedger(path: string | null | undefined) {
  overridePath = path === undefined ? undefined : path === null ? null : resolve(path);
}

export function appendDemandEvent(event: DemandLedgerEvent) {
  const path = demandLedgerPath();
  if (!path) return;
  mkdirSync(dirname(path), { recursive: true });
  appendFileSync(path, `${JSON.stringify(event)}\n`, "utf8");
}

export function readDemandEvents(): DemandLedgerEvent[] {
  const path = demandLedgerPath();
  if (!path || !existsSync(path)) return [];
  const lines = readFileSync(path, "utf8").split(/\r?\n/).filter(Boolean);
  const events: DemandLedgerEvent[] = [];
  for (const line of lines) {
    try {
      const value = JSON.parse(line) as Partial<DemandLedgerEvent>;
      if (
        value.version === 1 &&
        typeof value.observed_at === "string" &&
        typeof value.intent === "string" &&
        typeof value.normalized_intent === "string" &&
        (typeof value.capability === "string" || value.capability === null) &&
        typeof value.source === "string"
      ) {
        const exampleInput = value.example_input === undefined ? null : sanitizeDemandExampleInput(value.example_input);
        events.push({
          version: 1,
          observed_at: value.observed_at,
          intent: value.intent,
          normalized_intent: value.normalized_intent,
          capability: value.capability,
          source: value.source,
          ...(exampleInput ? { example_input: exampleInput } : {}),
        });
      }
    } catch {
      // Ignore malformed historical lines rather than making the runtime unavailable.
    }
  }
  return events;
}

export function truncateDemandLedger() {
  const path = demandLedgerPath();
  if (!path) return;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, "", "utf8");
}
