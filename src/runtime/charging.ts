import { createHash, randomUUID } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { rankRecipesForExecution } from "./agentRank.js";
import { economicsLedgerPath, economicsMinMarginMicrousd, recipeEconomics, recordEconomicsResolution } from "./economics.js";
import { resolveCapability } from "./executor.js";
import { commitCredits, prepaidCreditsEnabled, releaseCredits, reserveCredits } from "./prepaidCredits.js";
import { recipesForCapability, VERIFIED_RECIPES } from "./recipes.js";
import type { ResolveResult, RuntimeInput, VerifiedRecipe } from "./types.js";

export type ChargeState = "reserved" | "committed" | "voided";

export interface ChargeEvent {
  version: 1;
  observed_at: string;
  transaction_id: string;
  idempotency_hash: string;
  state: ChargeState;
  capability: string;
  customer_price_microusd: number;
  provider: string | null;
  recipe_fingerprint: string | null;
  provider_cost_microusd: number | null;
  gross_margin_microusd: number | null;
  reason: string | null;
  account_id?: string | null;
}

let overrideLedgerPath: string | null | undefined;
const inFlight = new Set<string>();

export function transactionalChargingEnabled(): boolean {
  return process.env.MISSING_TRANSACTIONAL_CHARGING_ENABLED === "1";
}

export function chargingLedgerPath(): string | null {
  if (overrideLedgerPath !== undefined) return overrideLedgerPath;
  if (process.env.MISSING_CHARGING_LEDGER) return resolve(process.env.MISSING_CHARGING_LEDGER);
  const economicsPath = economicsLedgerPath();
  if (economicsPath) return join(dirname(economicsPath), "charges.jsonl");
  if (process.env.NODE_ENV === "test") return null;
  return resolve(".missing/charges.jsonl");
}

export function configureChargingLedger(path: string | null | undefined) {
  overrideLedgerPath = path === undefined ? undefined : path === null ? null : resolve(path);
}

function idempotencyHash(key: string): string {
  return createHash("sha256").update(key, "utf8").digest("hex");
}

function appendEvent(event: ChargeEvent) {
  const path = chargingLedgerPath();
  if (!path) return;
  mkdirSync(dirname(path), { recursive: true });
  appendFileSync(path, `${JSON.stringify(event)}\n`, "utf8");
}

function validEvent(value: unknown): value is ChargeEvent {
  if (!value || typeof value !== "object") return false;
  const e = value as Partial<ChargeEvent>;
  return e.version === 1
    && typeof e.observed_at === "string"
    && typeof e.transaction_id === "string"
    && typeof e.idempotency_hash === "string"
    && (e.state === "reserved" || e.state === "committed" || e.state === "voided")
    && typeof e.capability === "string"
    && Number.isSafeInteger(e.customer_price_microusd) && (e.customer_price_microusd ?? -1) >= 0
    && (e.account_id === undefined || e.account_id === null || typeof e.account_id === "string");
}

export function chargeEvents(): ChargeEvent[] {
  const path = chargingLedgerPath();
  if (!path || !existsSync(path)) return [];
  const events: ChargeEvent[] = [];
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

function latestForHash(hash: string): ChargeEvent | null {
  const matches = chargeEvents().filter(event => event.idempotency_hash === hash);
  return matches.at(-1) ?? null;
}

function pricedRecipes(capability: string): Array<{ recipe: VerifiedRecipe; cost: number; price: number; margin: number }> {
  return rankRecipesForExecution(recipesForCapability(capability))
    .map(recipe => {
      const economics = recipeEconomics(recipe);
      return economics ? {
        recipe,
        cost: economics.provider_cost_microusd,
        price: economics.customer_price_microusd,
        margin: economics.margin_microusd,
      } : null;
    })
    .filter((item): item is { recipe: VerifiedRecipe; cost: number; price: number; margin: number } => item !== null && item.margin >= economicsMinMarginMicrousd());
}

export function quoteCapability(capability: string) {
  const priced = pricedRecipes(capability);
  if (!priced.length) return {
    status: "unavailable" as const,
    capability,
    reason: "No replay-verified provider has explicit economics satisfying the minimum margin",
  };
  const prices = [...new Set(priced.map(item => item.price))];
  if (prices.length !== 1) return {
    status: "pricing_conflict" as const,
    capability,
    reason: "Eligible failover providers do not share one customer price",
    customer_prices_microusd: prices.sort((a, b) => a - b),
  };
  return {
    status: "quoted" as const,
    capability,
    customer_price_microusd: prices[0],
    currency: "USD" as const,
    eligible_provider_count: priced.length,
    minimum_margin_microusd: economicsMinMarginMicrousd(),
  };
}

export async function resolveCapabilityCharged(args: {
  idempotencyKey: string;
  accountId?: string;
  capability: string;
  input: RuntimeInput;
}): Promise<{
  status: "resolved" | "unavailable" | "provider_error" | "already_committed" | "already_voided" | "in_progress" | "charging_disabled" | "pricing_conflict" | "insufficient_credits";
  transaction_id?: string;
  customer_price_microusd?: number;
  charge_state?: ChargeState;
  resolution?: ResolveResult;
  reason?: string;
}> {
  if (!transactionalChargingEnabled()) return { status: "charging_disabled", reason: "Set MISSING_TRANSACTIONAL_CHARGING_ENABLED=1 to enable transactional charging" };
  if (!args.idempotencyKey.trim()) return { status: "unavailable", reason: "A non-empty idempotency key is required" };
  if (prepaidCreditsEnabled() && !args.accountId?.trim()) return { status: "unavailable", reason: "account_id is required when prepaid credits are enabled" };

  const quote = quoteCapability(args.capability);
  if (quote.status !== "quoted") return { status: quote.status, reason: quote.reason };

  const hash = idempotencyHash(args.idempotencyKey);
  const prior = latestForHash(hash);
  if (prior?.state === "committed") return {
    status: "already_committed",
    transaction_id: prior.transaction_id,
    customer_price_microusd: prior.customer_price_microusd,
    charge_state: "committed",
  };
  if (prior?.state === "voided") return {
    status: "already_voided",
    transaction_id: prior.transaction_id,
    customer_price_microusd: prior.customer_price_microusd,
    charge_state: "voided",
    reason: prior.reason ?? "Prior attempt was voided; use a new idempotency key to retry",
  };
  if (prior?.state === "reserved" || inFlight.has(hash)) return {
    status: "in_progress",
    transaction_id: prior?.transaction_id,
    customer_price_microusd: quote.customer_price_microusd,
    charge_state: "reserved",
  };

  const transactionId = randomUUID();
  const reserved: ChargeEvent = {
    version: 1,
    observed_at: new Date().toISOString(),
    transaction_id: transactionId,
    idempotency_hash: hash,
    state: "reserved",
    capability: args.capability,
    customer_price_microusd: quote.customer_price_microusd,
    provider: null,
    recipe_fingerprint: null,
    provider_cost_microusd: null,
    gross_margin_microusd: null,
    reason: null,
    account_id: args.accountId ?? null,
  };
  appendEvent(reserved);

  if (prepaidCreditsEnabled()) {
    const reservedCredits = reserveCredits({ accountId: args.accountId!, transactionId, amountMicrousd: quote.customer_price_microusd });
    if (!reservedCredits) {
      appendEvent({ ...reserved, observed_at: new Date().toISOString(), state: "voided", reason: "Insufficient prepaid credits" });
      return {
        status: "insufficient_credits",
        transaction_id: transactionId,
        customer_price_microusd: quote.customer_price_microusd,
        charge_state: "voided",
        reason: "Insufficient prepaid credits",
      };
    }
  }

  inFlight.add(hash);
  try {
    const resolution = await resolveCapability(args.capability, args.input, { meterEconomics: false });
    if (resolution.status !== "resolved") {
      if (prepaidCreditsEnabled()) releaseCredits({ accountId: args.accountId!, transactionId, amountMicrousd: quote.customer_price_microusd });
      appendEvent({ ...reserved, observed_at: new Date().toISOString(), state: "voided", reason: resolution.reason });
      return {
        status: resolution.status,
        transaction_id: transactionId,
        customer_price_microusd: quote.customer_price_microusd,
        charge_state: "voided",
        resolution,
        reason: resolution.reason,
      };
    }

    const recipe = VERIFIED_RECIPES.find(item => item.recipe_fingerprint === resolution.recipe_fingerprint);
    const economics = recipe ? recipeEconomics(recipe) : null;
    if (!recipe || !economics || economics.customer_price_microusd !== quote.customer_price_microusd) {
      if (prepaidCreditsEnabled()) releaseCredits({ accountId: args.accountId!, transactionId, amountMicrousd: quote.customer_price_microusd });
      appendEvent({ ...reserved, observed_at: new Date().toISOString(), state: "voided", reason: "Resolved provider no longer matches the authorized quote" });
      return {
        status: "unavailable",
        transaction_id: transactionId,
        customer_price_microusd: quote.customer_price_microusd,
        charge_state: "voided",
        resolution,
        reason: "Resolved provider no longer matches the authorized quote",
      };
    }

    if (prepaidCreditsEnabled()) commitCredits({ accountId: args.accountId!, transactionId, amountMicrousd: quote.customer_price_microusd });
    recordEconomicsResolution({ capability: args.capability, recipe });
    appendEvent({
      ...reserved,
      observed_at: new Date().toISOString(),
      state: "committed",
      provider: recipe.provider,
      recipe_fingerprint: recipe.recipe_fingerprint,
      provider_cost_microusd: economics.provider_cost_microusd,
      gross_margin_microusd: economics.margin_microusd,
    });
    return {
      status: "resolved",
      transaction_id: transactionId,
      customer_price_microusd: quote.customer_price_microusd,
      charge_state: "committed",
      resolution,
    };
  } finally {
    inFlight.delete(hash);
  }
}

export function chargingSnapshot() {
  const events = chargeEvents();
  const latest = new Map<string, ChargeEvent>();
  for (const event of events) latest.set(event.idempotency_hash, event);
  const terminal = [...latest.values()];
  return {
    enabled: transactionalChargingEnabled(),
    ledger_persistence: chargingLedgerPath() !== null,
    transactions: terminal.length,
    committed: terminal.filter(event => event.state === "committed").length,
    voided: terminal.filter(event => event.state === "voided").length,
    reserved: terminal.filter(event => event.state === "reserved").length,
    customer_revenue_microusd: terminal.filter(event => event.state === "committed").reduce((sum, event) => sum + event.customer_price_microusd, 0),
    provider_cost_microusd: terminal.filter(event => event.state === "committed").reduce((sum, event) => sum + (event.provider_cost_microusd ?? 0), 0),
    gross_margin_microusd: terminal.filter(event => event.state === "committed").reduce((sum, event) => sum + (event.gross_margin_microusd ?? 0), 0),
  };
}

export function truncateChargingLedger() {
  const path = chargingLedgerPath();
  if (!path) return;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, "", "utf8");
  inFlight.clear();
}
