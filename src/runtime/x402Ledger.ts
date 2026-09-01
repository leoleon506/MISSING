import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { economicsLedgerPath, recipeEconomics, recordEconomicsResolution } from "./economics.js";
import type { VerifiedRecipe } from "./types.js";

export interface X402LedgerEvent {
  version: 1;
  observed_at: string;
  payment_hash: string;
  transaction_reference: string;
  capability: string;
  provider: string;
  recipe_fingerprint: string;
  customer_price_microusd: number;
  provider_cost_microusd: number;
  gross_margin_microusd: number;
  network: string | null;
}

let overridePath: string | null | undefined;

export function x402LedgerPath(): string | null {
  if (overridePath !== undefined) return overridePath;
  if (process.env.MISSING_X402_LEDGER) return resolve(process.env.MISSING_X402_LEDGER);
  const economicsPath = economicsLedgerPath();
  if (economicsPath) return join(dirname(economicsPath), "x402.jsonl");
  if (process.env.NODE_ENV === "test") return null;
  return resolve(".missing/x402.jsonl");
}

export function configureX402Ledger(path: string | null | undefined) {
  overridePath = path === undefined ? undefined : path === null ? null : resolve(path);
}

function validEvent(value: unknown): value is X402LedgerEvent {
  if (!value || typeof value !== "object") return false;
  const e = value as Partial<X402LedgerEvent>;
  return e.version === 1
    && typeof e.observed_at === "string"
    && typeof e.payment_hash === "string"
    && typeof e.transaction_reference === "string"
    && typeof e.capability === "string"
    && typeof e.provider === "string"
    && typeof e.recipe_fingerprint === "string"
    && Number.isSafeInteger(e.customer_price_microusd)
    && Number.isSafeInteger(e.provider_cost_microusd)
    && Number.isSafeInteger(e.gross_margin_microusd);
}

export function x402Events(): X402LedgerEvent[] {
  const path = x402LedgerPath();
  if (!path || !existsSync(path)) return [];
  const events: X402LedgerEvent[] = [];
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

export function recordX402Settlement(args: {
  paymentHash: string;
  transactionReference: string;
  network?: string;
  capability: string;
  recipe: VerifiedRecipe;
  customerPriceMicrousd: number;
  realizedProviderCostMicrousd?: number;
}): { recorded: boolean; event: X402LedgerEvent | null } {
  if (x402Events().some(event => event.payment_hash === args.paymentHash)) return { recorded: false, event: null };
  const economics = recipeEconomics(args.recipe);
  if (!economics || economics.customer_price_microusd !== args.customerPriceMicrousd) return { recorded: false, event: null };
  const realizedCost = args.realizedProviderCostMicrousd ?? economics.provider_cost_microusd;
  if (!Number.isSafeInteger(realizedCost) || realizedCost < 0) return { recorded: false, event: null };
  const event: X402LedgerEvent = {
    version: 1,
    observed_at: new Date().toISOString(),
    payment_hash: args.paymentHash,
    transaction_reference: args.transactionReference,
    capability: args.capability,
    provider: args.recipe.provider,
    recipe_fingerprint: args.recipe.recipe_fingerprint,
    customer_price_microusd: economics.customer_price_microusd,
    provider_cost_microusd: realizedCost,
    gross_margin_microusd: economics.customer_price_microusd - realizedCost,
    network: args.network ?? null,
  };
  const path = x402LedgerPath();
  if (path) {
    mkdirSync(dirname(path), { recursive: true });
    appendFileSync(path, `${JSON.stringify(event)}\n`, "utf8");
  }
  // Compatibility meter: records the selected provider's configured economics.
  // Realized routing COGS, including failed attempts, lives in this x402 event.
  recordEconomicsResolution({ capability: args.capability, recipe: args.recipe });
  return { recorded: true, event };
}

export function x402Snapshot() {
  const events = x402Events();
  return {
    ledger_persistence: x402LedgerPath() !== null,
    settled_resolutions: events.length,
    customer_revenue_microusd: events.reduce((sum, event) => sum + event.customer_price_microusd, 0),
    provider_cost_microusd: events.reduce((sum, event) => sum + event.provider_cost_microusd, 0),
    gross_margin_microusd: events.reduce((sum, event) => sum + event.gross_margin_microusd, 0),
  };
}

export function truncateX402Ledger() {
  const path = x402LedgerPath();
  if (!path) return;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, "", "utf8");
}
