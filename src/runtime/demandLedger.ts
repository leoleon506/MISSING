import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

export type DemandSource = "mcp" | "a2a" | "runtime" | "unknown" | string;

export interface DemandLedgerEvent {
  version: 1;
  observed_at: string;
  intent: string;
  normalized_intent: string;
  capability: string | null;
  source: DemandSource;
}

let overridePath: string | null | undefined;

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
        events.push(value as DemandLedgerEvent);
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
