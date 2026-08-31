import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { demandLedgerPath } from "./demandLedger.js";
import type { VerifiedRecipe } from "./types.js";

export interface RecipeEconomics {
  provider_cost_microusd: number;
  customer_price_microusd: number;
  margin_microusd: number;
}

export interface EconomicsMeterEvent {
  version: 1;
  observed_at: string;
  capability: string;
  provider: string;
  recipe_fingerprint: string;
  provider_cost_microusd: number | null;
  customer_price_microusd: number | null;
  margin_microusd: number | null;
}

export interface EconomicsSummary {
  resolutions: number;
  priced_resolutions: number;
  unknown_economics_resolutions: number;
  provider_cost_microusd: number;
  customer_revenue_microusd: number;
  gross_margin_microusd: number;
}

type EconomicsConfig = {
  recipes?: Record<string, {
    provider_cost_microusd?: unknown;
    customer_price_microusd?: unknown;
  }>;
};

let overrideLedgerPath: string | null | undefined;

function validMoney(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function parsedConfig(): EconomicsConfig {
  const raw = process.env.MISSING_ECONOMICS_JSON;
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" ? parsed as EconomicsConfig : {};
  } catch {
    return {};
  }
}

export function economicsEnforcementEnabled(): boolean {
  return process.env.MISSING_ECONOMICS_ENFORCEMENT_ENABLED === "1";
}

export function economicsMinMarginMicrousd(): number {
  const value = Number(process.env.MISSING_MIN_MARGIN_MICROUSD ?? 0);
  return Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

export function recipeEconomics(recipe: VerifiedRecipe): RecipeEconomics | null {
  const configured = parsedConfig().recipes?.[recipe.recipe_fingerprint];
  if (!configured) return null;
  const cost = configured.provider_cost_microusd;
  const price = configured.customer_price_microusd;
  if (!validMoney(cost) || !validMoney(price) || price < cost) return null;
  return {
    provider_cost_microusd: cost,
    customer_price_microusd: price,
    margin_microusd: price - cost,
  };
}

export function recipeEconomicallyEligible(recipe: VerifiedRecipe): boolean {
  if (!economicsEnforcementEnabled()) return true;
  const economics = recipeEconomics(recipe);
  return economics !== null && economics.margin_microusd >= economicsMinMarginMicrousd();
}

/**
 * Kappa never treats missing pricing as zero cost. When enforcement is enabled,
 * unknown or below-margin recipes are removed from the executable candidate set.
 * Within eligible supply, higher explicit margin is preferred; registry/AgentRank
 * order is the stable tie breaker supplied by the caller.
 */
export function rankRecipesByEconomics(recipes: VerifiedRecipe[]): VerifiedRecipe[] {
  if (!economicsEnforcementEnabled()) return [...recipes];
  return recipes
    .map((recipe, index) => ({ recipe, index, economics: recipeEconomics(recipe) }))
    .filter(item => item.economics !== null && item.economics.margin_microusd >= economicsMinMarginMicrousd())
    .sort((a, b) => (b.economics!.margin_microusd - a.economics!.margin_microusd) || a.index - b.index)
    .map(item => item.recipe);
}

export function economicsLedgerPath(): string | null {
  if (overrideLedgerPath !== undefined) return overrideLedgerPath;
  if (process.env.MISSING_ECONOMICS_LEDGER) return resolve(process.env.MISSING_ECONOMICS_LEDGER);
  const demandPath = demandLedgerPath();
  if (demandPath) return join(dirname(demandPath), "economics.jsonl");
  if (process.env.NODE_ENV === "test") return null;
  return resolve(".missing/economics.jsonl");
}

export function configureEconomicsLedger(path: string | null | undefined) {
  overrideLedgerPath = path === undefined ? undefined : path === null ? null : resolve(path);
}

export function recordEconomicsResolution(args: {
  capability: string;
  recipe: VerifiedRecipe;
  observedAt?: string;
}): EconomicsMeterEvent {
  const economics = recipeEconomics(args.recipe);
  const event: EconomicsMeterEvent = {
    version: 1,
    observed_at: args.observedAt ?? new Date().toISOString(),
    capability: args.capability,
    provider: args.recipe.provider,
    recipe_fingerprint: args.recipe.recipe_fingerprint,
    provider_cost_microusd: economics?.provider_cost_microusd ?? null,
    customer_price_microusd: economics?.customer_price_microusd ?? null,
    margin_microusd: economics?.margin_microusd ?? null,
  };
  const path = economicsLedgerPath();
  if (path) {
    try {
      mkdirSync(dirname(path), { recursive: true });
      appendFileSync(path, `${JSON.stringify(event)}\n`, "utf8");
    } catch {
      // Metering is advisory until a transactional billing backend exists.
      // A ledger write failure must not corrupt an already successful resolution.
    }
  }
  return event;
}

function validMeterEvent(value: unknown): value is EconomicsMeterEvent {
  if (!value || typeof value !== "object") return false;
  const event = value as Partial<EconomicsMeterEvent>;
  const nullableMoney = (v: unknown) => v === null || validMoney(v);
  return event.version === 1
    && typeof event.observed_at === "string"
    && typeof event.capability === "string"
    && typeof event.provider === "string"
    && typeof event.recipe_fingerprint === "string"
    && nullableMoney(event.provider_cost_microusd)
    && nullableMoney(event.customer_price_microusd)
    && nullableMoney(event.margin_microusd);
}

export function economicsSummary(): EconomicsSummary {
  const summary: EconomicsSummary = {
    resolutions: 0,
    priced_resolutions: 0,
    unknown_economics_resolutions: 0,
    provider_cost_microusd: 0,
    customer_revenue_microusd: 0,
    gross_margin_microusd: 0,
  };
  const path = economicsLedgerPath();
  if (!path || !existsSync(path)) return summary;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/).filter(Boolean)) {
    try {
      const parsed = JSON.parse(line) as unknown;
      if (!validMeterEvent(parsed)) continue;
      summary.resolutions += 1;
      if (parsed.margin_microusd === null || parsed.provider_cost_microusd === null || parsed.customer_price_microusd === null) {
        summary.unknown_economics_resolutions += 1;
        continue;
      }
      summary.priced_resolutions += 1;
      summary.provider_cost_microusd += parsed.provider_cost_microusd;
      summary.customer_revenue_microusd += parsed.customer_price_microusd;
      summary.gross_margin_microusd += parsed.margin_microusd;
    } catch {
      // Ignore malformed historical telemetry.
    }
  }
  return summary;
}

export function economicsSnapshot(recipes: VerifiedRecipe[], capability?: string) {
  const selected = capability ? recipes.filter(recipe => recipe.capability === capability) : recipes;
  return {
    enforcement_enabled: economicsEnforcementEnabled(),
    minimum_margin_microusd: economicsMinMarginMicrousd(),
    ledger_persistence: economicsLedgerPath() !== null,
    recipes: selected.map(recipe => {
      const economics = recipeEconomics(recipe);
      return {
        capability: recipe.capability,
        provider: recipe.provider,
        recipe_fingerprint: recipe.recipe_fingerprint,
        economics_status: economics ? "configured" : "unknown",
        eligible: recipeEconomicallyEligible(recipe),
        ...(economics ?? {
          provider_cost_microusd: null,
          customer_price_microusd: null,
          margin_microusd: null,
        }),
      };
    }),
    summary: economicsSummary(),
  };
}

export function truncateEconomicsLedger() {
  const path = economicsLedgerPath();
  if (!path) return;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, "", "utf8");
}
