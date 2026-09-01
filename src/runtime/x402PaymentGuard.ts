import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { economicsLedgerPath } from "./economics.js";

export type X402PaymentGuardState = "reserved" | "settled" | "failed";

export interface X402PaymentGuardEvent {
  version: 1;
  observed_at: string;
  payment_hash: string;
  execution_id: string;
  capability: string;
  state: X402PaymentGuardState;
  reason: string | null;
  transaction_reference: string | null;
}

let overridePath: string | null | undefined;
const inFlight = new Set<string>();

export function x402PaymentGuardPath(): string | null {
  if (overridePath !== undefined) return overridePath;
  if (process.env.MISSING_X402_PAYMENT_GUARD_LEDGER) return resolve(process.env.MISSING_X402_PAYMENT_GUARD_LEDGER);
  const economicsPath = economicsLedgerPath();
  if (economicsPath) return join(dirname(economicsPath), "x402-payment-guard.jsonl");
  if (process.env.NODE_ENV === "test") return null;
  return resolve(".missing/x402-payment-guard.jsonl");
}

export function configureX402PaymentGuard(path: string | null | undefined) {
  overridePath = path === undefined ? undefined : path === null ? null : resolve(path);
}

function validEvent(value: unknown): value is X402PaymentGuardEvent {
  if (!value || typeof value !== "object") return false;
  const e = value as Partial<X402PaymentGuardEvent>;
  return e.version === 1
    && typeof e.observed_at === "string"
    && typeof e.payment_hash === "string"
    && typeof e.execution_id === "string"
    && typeof e.capability === "string"
    && (e.state === "reserved" || e.state === "settled" || e.state === "failed")
    && (e.reason === null || typeof e.reason === "string")
    && (e.transaction_reference === null || typeof e.transaction_reference === "string");
}

export function x402PaymentGuardEvents(): X402PaymentGuardEvent[] {
  const path = x402PaymentGuardPath();
  if (!path || !existsSync(path)) return [];
  const events: X402PaymentGuardEvent[] = [];
  for (const line of readFileSync(path, "utf8").split(/\r?\n/).filter(Boolean)) {
    try {
      const parsed = JSON.parse(line) as unknown;
      if (validEvent(parsed)) events.push(parsed);
    } catch {
      // Ignore malformed historical telemetry.
    }
  }
  return events;
}

function latest(paymentHash: string): X402PaymentGuardEvent | null {
  return x402PaymentGuardEvents().filter(event => event.payment_hash === paymentHash).at(-1) ?? null;
}

function append(event: X402PaymentGuardEvent) {
  const path = x402PaymentGuardPath();
  if (!path) return;
  mkdirSync(dirname(path), { recursive: true });
  appendFileSync(path, `${JSON.stringify(event)}\n`, "utf8");
}

export function reserveX402Payment(args: { paymentHash: string; executionId: string; capability: string }) {
  const prior = latest(args.paymentHash);
  if (prior) return { reserved: false as const, prior };
  if (inFlight.has(args.paymentHash)) return { reserved: false as const, prior: null };
  inFlight.add(args.paymentHash);
  const event: X402PaymentGuardEvent = {
    version: 1,
    observed_at: new Date().toISOString(),
    payment_hash: args.paymentHash,
    execution_id: args.executionId,
    capability: args.capability,
    state: "reserved",
    reason: null,
    transaction_reference: null,
  };
  append(event);
  return { reserved: true as const, prior: null, event };
}

export function settleX402PaymentGuard(args: { paymentHash: string; executionId: string; capability: string; transactionReference: string }) {
  const event: X402PaymentGuardEvent = {
    version: 1,
    observed_at: new Date().toISOString(),
    payment_hash: args.paymentHash,
    execution_id: args.executionId,
    capability: args.capability,
    state: "settled",
    reason: null,
    transaction_reference: args.transactionReference,
  };
  append(event);
  inFlight.delete(args.paymentHash);
  return event;
}

export function failX402PaymentGuard(args: { paymentHash: string; executionId: string; capability: string; reason: string }) {
  const event: X402PaymentGuardEvent = {
    version: 1,
    observed_at: new Date().toISOString(),
    payment_hash: args.paymentHash,
    execution_id: args.executionId,
    capability: args.capability,
    state: "failed",
    reason: args.reason,
    transaction_reference: null,
  };
  append(event);
  inFlight.delete(args.paymentHash);
  return event;
}

export function x402PaymentGuardSnapshot() {
  const latestByHash = new Map<string, X402PaymentGuardEvent>();
  for (const event of x402PaymentGuardEvents()) latestByHash.set(event.payment_hash, event);
  const terminal = [...latestByHash.values()];
  return {
    ledger_persistence: x402PaymentGuardPath() !== null,
    payments: terminal.length,
    reserved: terminal.filter(event => event.state === "reserved").length,
    settled: terminal.filter(event => event.state === "settled").length,
    failed: terminal.filter(event => event.state === "failed").length,
  };
}

export function truncateX402PaymentGuard() {
  const path = x402PaymentGuardPath();
  if (path) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, "", "utf8");
  }
  inFlight.clear();
}
