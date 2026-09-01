import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { economicsLedgerPath, recipeEconomics } from "./economics.js";
import type { RuntimeAttempt, VerifiedRecipe } from "./types.js";

export type ProviderCostSource = "routing" | "exploration";

export interface ProviderCostEvent {
  version: 1;
  observed_at: string;
  execution_id: string | null;
  capability: string;
  provider: string;
  recipe_fingerprint: string;
  source: ProviderCostSource;
  outcome: "success" | "failure";
  provider_cost_microusd: number | null;
  customer_billable: boolean;
}

let overridePath: string | null | undefined;

export function providerCostLedgerPath(): string | null {
  if (overridePath !== undefined) return overridePath;
  if (process.env.MISSING_PROVIDER_COST_LEDGER) return resolve(process.env.MISSING_PROVIDER_COST_LEDGER);
  const economicsPath = economicsLedgerPath();
  if (economicsPath) return join(dirname(economicsPath), "provider-costs.jsonl");
  if (process.env.NODE_ENV === "test") return null;
  return resolve(".missing/provider-costs.jsonl");
}

export function configureProviderCostLedger(path: string | null | undefined) {
  overridePath = path === undefined ? undefined : path === null ? null : resolve(path);
}

function appendEvent(event: ProviderCostEvent) {
  const path = providerCostLedgerPath();
  if (!path) return;
  try {
    mkdirSync(dirname(path), { recursive: true });
    appendFileSync(path, `${JSON.stringify(event)}\n`, "utf8");
  } catch {
    // Advisory until the financial backend is transactional.
  }
}

export function recordProviderAttemptCost(args: {
  executionId?: string | null;
  capability: string;
  recipe: VerifiedRecipe;
  attempt: RuntimeAttempt;
  source: ProviderCostSource;
  customerBillable: boolean;
}) {
  const economics = recipeEconomics(args.recipe);
  const event: ProviderCostEvent = {
    version: 1,
    observed_at: new Date().toISOString(),
    execution_id: args.executionId ?? null,
    capability: args.capability,
    provider: args.recipe.provider,
    recipe_fingerprint: args.recipe.recipe_fingerprint,
    source: args.source,
    outcome: args.attempt.ok ? "success" : "failure",
    provider_cost_microusd: economics?.provider_cost_microusd ?? null,
    customer_billable: args.customerBillable,
  };
  appendEvent(event);
  return event;
}

function validEvent(value: unknown): value is ProviderCostEvent {
  if (!value || typeof value !== "object") return false;
  const e = value as Partial<ProviderCostEvent>;
  return e.version === 1
    && typeof e.observed_at === "string"
    && (e.execution_id === null || typeof e.execution_id === "string")
    && typeof e.capability === "string"
    && typeof e.provider === "string"
    && typeof e.recipe_fingerprint === "string"
    && (e.source === "routing" || e.source === "exploration")
    && (e.outcome === "success" || e.outcome === "failure")
    && (e.provider_cost_microusd === null || (Number.isSafeInteger(e.provider_cost_microusd) && e.provider_cost_microusd >= 0))
    && typeof e.customer_billable === "boolean";
}

export function providerCostEvents(): ProviderCostEvent[] {
  const path = providerCostLedgerPath();
  if (!path || !existsSync(path)) return [];
  const events: ProviderCostEvent[] = [];
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

export function providerCostForExecution(executionId: string) {
  const events = providerCostEvents().filter(event => event.execution_id === executionId && event.source === "routing");
  const known = events.filter(event => event.provider_cost_microusd !== null);
  const unknownCostAttempts = events.length - known.length;
  return {
    attempts: events.length,
    known_cost_attempts: known.length,
    unknown_cost_attempts: unknownCostAttempts,
    provider_cost_microusd: unknownCostAttempts > 0
      ? null
      : known.reduce((sum, event) => sum + (event.provider_cost_microusd ?? 0), 0),
  };
}

export function providerCostSnapshot() {
  const events = providerCostEvents();
  const routing = events.filter(event => event.source === "routing");
  const exploration = events.filter(event => event.source === "exploration");
  const sumKnown = (rows: ProviderCostEvent[]) => rows.reduce((sum, event) => sum + (event.provider_cost_microusd ?? 0), 0);
  return {
    ledger_persistence: providerCostLedgerPath() !== null,
    routing_attempts: routing.length,
    exploration_attempts: exploration.length,
    routing_known_provider_cost_microusd: sumKnown(routing),
    exploration_known_provider_cost_microusd: sumKnown(exploration),
    unknown_cost_attempts: events.filter(event => event.provider_cost_microusd === null).length,
  };
}

export function truncateProviderCostLedger() {
  const path = providerCostLedgerPath();
  if (!path) return;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, "", "utf8");
}
