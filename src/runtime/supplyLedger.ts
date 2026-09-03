import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { demandLedgerPath } from "./demandLedger.js";
import type { CredentialBinding, GeneratedHeaderBinding, VerifiedRecipe } from "./types.js";

export interface SupplyPromotionOrigin {
  demand_intent: string;
  normalized_intent: string;
}

export interface SupplyLedgerEvent {
  version: 1;
  promoted_at: string;
  recipe: VerifiedRecipe;
  origin?: SupplyPromotionOrigin;
}

let overridePath: string | null | undefined;

export function supplyLedgerPath(): string | null {
  if (overridePath !== undefined) return overridePath;
  if (process.env.MISSING_SUPPLY_LEDGER) return resolve(process.env.MISSING_SUPPLY_LEDGER);
  const demandPath = demandLedgerPath();
  if (demandPath) return join(dirname(demandPath), "supply.jsonl");
  if (process.env.NODE_ENV === "test") return null;
  return resolve(".missing/supply.jsonl");
}

export function configureSupplyLedger(path: string | null | undefined) {
  overridePath = path === undefined ? undefined : path === null ? null : resolve(path);
}

function plainRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value)
    && Object.keys(value as Record<string, unknown>).every(key => Boolean(key));
}

function stringRecord(value: unknown): value is Record<string, string> {
  return plainRecord(value)
    && Object.entries(value).every(([, item]) => typeof item === "string");
}

function credentialBindings(value: unknown): value is CredentialBinding[] {
  if (!Array.isArray(value)) return false;
  return value.every(item => !!item && typeof item === "object"
    && (item as Partial<CredentialBinding>).location === "header"
    && typeof (item as Partial<CredentialBinding>).name === "string"
    && Boolean((item as Partial<CredentialBinding>).name?.trim())
    && typeof (item as Partial<CredentialBinding>).credential_key === "string"
    && Boolean((item as Partial<CredentialBinding>).credential_key?.trim())
    && ((item as Partial<CredentialBinding>).prefix === undefined || typeof (item as Partial<CredentialBinding>).prefix === "string"));
}

function generatedHeaderBindings(value: unknown): value is GeneratedHeaderBinding[] {
  if (!Array.isArray(value)) return false;
  return value.every(item => !!item && typeof item === "object"
    && (item as Partial<GeneratedHeaderBinding>).location === "header"
    && typeof (item as Partial<GeneratedHeaderBinding>).name === "string"
    && Boolean((item as Partial<GeneratedHeaderBinding>).name?.trim())
    && (item as Partial<GeneratedHeaderBinding>).generator === "uuid_v4");
}

function isVerifiedRecipe(value: unknown): value is VerifiedRecipe {
  if (!value || typeof value !== "object") return false;
  const recipe = value as Partial<VerifiedRecipe>;
  return typeof recipe.capability === "string"
    && typeof recipe.family === "string"
    && typeof recipe.provider === "string"
    && typeof recipe.recipe_fingerprint === "string"
    && (recipe.method === "GET" || recipe.method === "POST")
    && typeof recipe.base_url === "string"
    && typeof recipe.path_template === "string"
    && stringRecord(recipe.path_bindings)
    && stringRecord(recipe.query_bindings)
    && (recipe.body_bindings === undefined || stringRecord(recipe.body_bindings))
    && (recipe.static_headers === undefined || stringRecord(recipe.static_headers))
    && (recipe.credential_bindings === undefined || credentialBindings(recipe.credential_bindings))
    && (recipe.generated_headers === undefined || generatedHeaderBindings(recipe.generated_headers))
    && (recipe.forced_inputs === undefined || plainRecord(recipe.forced_inputs))
    && !!recipe.verification
    && recipe.verification.status === "replay_verified";
}

function validOrigin(value: unknown): value is SupplyPromotionOrigin {
  if (!value || typeof value !== "object") return false;
  const origin = value as Partial<SupplyPromotionOrigin>;
  return typeof origin.demand_intent === "string" && Boolean(origin.demand_intent.trim())
    && typeof origin.normalized_intent === "string" && Boolean(origin.normalized_intent.trim());
}

export function appendPromotedRecipe(
  recipe: VerifiedRecipe,
  promotedAt = new Date().toISOString(),
  origin?: SupplyPromotionOrigin,
) {
  const path = supplyLedgerPath();
  if (!path) return;
  mkdirSync(dirname(path), { recursive: true });
  const event: SupplyLedgerEvent = {
    version: 1,
    promoted_at: promotedAt,
    recipe,
    ...(origin ? { origin } : {}),
  };
  appendFileSync(path, `${JSON.stringify(event)}\n`, "utf8");
}

export function readSupplyLedgerEvents(): SupplyLedgerEvent[] {
  const path = supplyLedgerPath();
  if (!path || !existsSync(path)) return [];
  const events: SupplyLedgerEvent[] = [];
  for (const line of readFileSync(path, "utf8").split(/\r?\n/).filter(Boolean)) {
    try {
      const event = JSON.parse(line) as Partial<SupplyLedgerEvent>;
      if (event.version !== 1 || typeof event.promoted_at !== "string" || !isVerifiedRecipe(event.recipe)) continue;
      if (event.origin !== undefined && !validOrigin(event.origin)) continue;
      events.push(event as SupplyLedgerEvent);
    } catch {
      // A malformed historical line must not make the product runtime unavailable.
    }
  }
  return events;
}

export function readPromotedRecipes(): VerifiedRecipe[] {
  const recipes = new Map<string, VerifiedRecipe>();
  for (const event of readSupplyLedgerEvents()) recipes.set(event.recipe.recipe_fingerprint, event.recipe);
  return [...recipes.values()];
}

export function truncateSupplyLedger() {
  const path = supplyLedgerPath();
  if (!path) return;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, "", "utf8");
}
