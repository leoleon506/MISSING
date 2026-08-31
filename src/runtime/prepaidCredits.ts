import { createHash, randomUUID } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { chargingLedgerPath } from "./charging.js";

export type CreditEventType = "credit" | "reserve" | "commit" | "release";

export interface CreditEvent {
  version: 1;
  observed_at: string;
  event_id: string;
  account_id: string;
  type: CreditEventType;
  amount_microusd: number;
  transaction_id: string | null;
  external_reference_hash: string | null;
}

export interface CreditBalance {
  account_id: string;
  funded_microusd: number;
  committed_spend_microusd: number;
  reserved_microusd: number;
  available_microusd: number;
}

let overrideLedgerPath: string | null | undefined;

function validMoney(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function refHash(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function prepaidCreditsEnabled(): boolean {
  return process.env.MISSING_PREPAID_CREDITS_ENABLED === "1";
}

export function prepaidCreditLedgerPath(): string | null {
  if (overrideLedgerPath !== undefined) return overrideLedgerPath;
  if (process.env.MISSING_PREPAID_CREDIT_LEDGER) return resolve(process.env.MISSING_PREPAID_CREDIT_LEDGER);
  const chargingPath = chargingLedgerPath();
  if (chargingPath) return join(dirname(chargingPath), "credits.jsonl");
  if (process.env.NODE_ENV === "test") return null;
  return resolve(".missing/credits.jsonl");
}

export function configurePrepaidCreditLedger(path: string | null | undefined) {
  overrideLedgerPath = path === undefined ? undefined : path === null ? null : resolve(path);
}

function validEvent(value: unknown): value is CreditEvent {
  if (!value || typeof value !== "object") return false;
  const e = value as Partial<CreditEvent>;
  return e.version === 1
    && typeof e.observed_at === "string"
    && typeof e.event_id === "string"
    && typeof e.account_id === "string"
    && (e.type === "credit" || e.type === "reserve" || e.type === "commit" || e.type === "release")
    && validMoney(e.amount_microusd)
    && (e.transaction_id === null || typeof e.transaction_id === "string")
    && (e.external_reference_hash === null || typeof e.external_reference_hash === "string");
}

export function creditEvents(): CreditEvent[] {
  const path = prepaidCreditLedgerPath();
  if (!path || !existsSync(path)) return [];
  const out: CreditEvent[] = [];
  for (const line of readFileSync(path, "utf8").split(/\r?\n/).filter(Boolean)) {
    try {
      const parsed = JSON.parse(line) as unknown;
      if (validEvent(parsed)) out.push(parsed);
    } catch {
      // Ignore malformed historical lines.
    }
  }
  return out;
}

function appendEvent(event: CreditEvent) {
  const path = prepaidCreditLedgerPath();
  if (!path) return;
  mkdirSync(dirname(path), { recursive: true });
  appendFileSync(path, `${JSON.stringify(event)}\n`, "utf8");
}

export function creditBalance(accountId: string): CreditBalance {
  const events = creditEvents().filter(event => event.account_id === accountId);
  let funded = 0;
  let committed = 0;
  const reservations = new Map<string, number>();
  for (const event of events) {
    if (event.type === "credit") funded += event.amount_microusd;
    if (event.type === "reserve" && event.transaction_id) reservations.set(event.transaction_id, event.amount_microusd);
    if (event.type === "commit" && event.transaction_id) {
      const amount = reservations.get(event.transaction_id) ?? event.amount_microusd;
      committed += amount;
      reservations.delete(event.transaction_id);
    }
    if (event.type === "release" && event.transaction_id) reservations.delete(event.transaction_id);
  }
  const reserved = [...reservations.values()].reduce((sum, amount) => sum + amount, 0);
  return {
    account_id: accountId,
    funded_microusd: funded,
    committed_spend_microusd: committed,
    reserved_microusd: reserved,
    available_microusd: Math.max(0, funded - committed - reserved),
  };
}

export function creditAccount(args: { accountId: string; amountMicrousd: number; externalReference: string }): { credited: boolean; balance: CreditBalance } {
  if (!prepaidCreditsEnabled()) return { credited: false, balance: creditBalance(args.accountId) };
  if (!args.accountId.trim() || !validMoney(args.amountMicrousd) || args.amountMicrousd === 0 || !args.externalReference.trim()) {
    return { credited: false, balance: creditBalance(args.accountId) };
  }
  const hash = refHash(args.externalReference);
  const duplicate = creditEvents().some(event => event.type === "credit" && event.account_id === args.accountId && event.external_reference_hash === hash);
  if (!duplicate) {
    appendEvent({
      version: 1,
      observed_at: new Date().toISOString(),
      event_id: randomUUID(),
      account_id: args.accountId,
      type: "credit",
      amount_microusd: args.amountMicrousd,
      transaction_id: null,
      external_reference_hash: hash,
    });
  }
  return { credited: !duplicate, balance: creditBalance(args.accountId) };
}

export function reserveCredits(args: { accountId: string; transactionId: string; amountMicrousd: number }): boolean {
  if (!prepaidCreditsEnabled() || !args.accountId.trim() || !args.transactionId.trim() || !validMoney(args.amountMicrousd) || args.amountMicrousd === 0) return false;
  const existing = creditEvents().find(event => event.type === "reserve" && event.account_id === args.accountId && event.transaction_id === args.transactionId);
  if (existing) return existing.amount_microusd === args.amountMicrousd;
  if (creditBalance(args.accountId).available_microusd < args.amountMicrousd) return false;
  appendEvent({ version: 1, observed_at: new Date().toISOString(), event_id: randomUUID(), account_id: args.accountId, type: "reserve", amount_microusd: args.amountMicrousd, transaction_id: args.transactionId, external_reference_hash: null });
  return true;
}

export function commitCredits(args: { accountId: string; transactionId: string; amountMicrousd: number }) {
  const terminal = creditEvents().find(event => event.account_id === args.accountId && event.transaction_id === args.transactionId && (event.type === "commit" || event.type === "release"));
  if (terminal) return terminal.type === "commit";
  appendEvent({ version: 1, observed_at: new Date().toISOString(), event_id: randomUUID(), account_id: args.accountId, type: "commit", amount_microusd: args.amountMicrousd, transaction_id: args.transactionId, external_reference_hash: null });
  return true;
}

export function releaseCredits(args: { accountId: string; transactionId: string; amountMicrousd: number }) {
  const terminal = creditEvents().find(event => event.account_id === args.accountId && event.transaction_id === args.transactionId && (event.type === "commit" || event.type === "release"));
  if (terminal) return terminal.type === "release";
  appendEvent({ version: 1, observed_at: new Date().toISOString(), event_id: randomUUID(), account_id: args.accountId, type: "release", amount_microusd: args.amountMicrousd, transaction_id: args.transactionId, external_reference_hash: null });
  return true;
}

export function prepaidCreditsSnapshot(accountId?: string) {
  const accounts = [...new Set(creditEvents().map(event => event.account_id))];
  const selected = accountId ? accounts.filter(id => id === accountId) : accounts;
  return {
    enabled: prepaidCreditsEnabled(),
    ledger_persistence: prepaidCreditLedgerPath() !== null,
    accounts: selected.map(creditBalance),
  };
}

export function truncatePrepaidCreditLedger() {
  const path = prepaidCreditLedgerPath();
  if (!path) return;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, "", "utf8");
}
