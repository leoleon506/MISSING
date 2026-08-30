import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import type { VerifiedRecipe } from "./types.js";

export interface SupplyLedgerEvent {
  version: 1;
  promoted_at: string;
  recipe: VerifiedRecipe;
}

let overridePath: string | null | undefined;

export function supplyLedgerPath(): string | null {
  if (overridePath !== undefined) return overridePath;
  if (process.env.NODE_ENV === "test" && !process.env.MISSING_SUPPLY_LEDGER) return null;
  const configured = process.env.MISSING_SUPPLY_LEDGER
    ?? (process.env.MISSING_DEMAND_LEDGER
      ? join(dirname(resolve(process.env.MISSING_DEMAND_LEDGER)), "supply.jsonl")
      : ".missing/supply.jsonl");
  return resolve(configured);
}

export function configureSupplyLedger(path: string | null | undefined) {
  overridePath = path === undefined ? undefined : path === null ? null : resolve(path);
}

function isVerifiedRecipe(value: unknown): value is VerifiedRecipe {
  if (!value || typeof value !== "object") return false;
  const recipe = value as Partial<VerifiedRecipe>;
  return typeof recipe.capability === "string"
    && typeof recipe.family === "string"
    && typeof recipe.provider === "string"
    && typeof recipe.recipe_fingerprint === "string"
    && recipe.method === "GET"
    && typeof recipe.base_url === "string"
    && typeof recipe.path_template === "string"
    && !!recipe.verification
    && recipe.verification.status === "replay_verified";
}

export function appendPromotedRecipe(recipe: VerifiedRecipe, promotedAt = new Date().toISOString()) {
  const path = supplyLedgerPath();
  if (!path) return;
  mkdirSync(dirname(path), { recursive: true });
  const event: SupplyLedgerEvent = { version: 1, promoted_at: promotedAt, recipe };
  appendFileSync(path, `${JSON.stringify(event)}\n`, "utf8");
}

export function readPromotedRecipes(): VerifiedRecipe[] {
  const path = supplyLedgerPath();
  if (!path || !existsSync(path)) return [];
  const recipes = new Map<string, VerifiedRecipe>();
  for (const line of readFileSync(path, "utf8").split(/\r?\n/).filter(Boolean)) {
    try {
      const event = JSON.parse(line) as Partial<SupplyLedgerEvent>;
      if (event.version === 1 && typeof event.promoted_at === "string" && isVerifiedRecipe(event.recipe)) {
        recipes.set(event.recipe.recipe_fingerprint, event.recipe);
      }
    } catch {
      // A malformed historical line must not make the product runtime unavailable.
    }
  }
  return [...recipes.values()];
}

export function truncateSupplyLedger() {
  const path = supplyLedgerPath();
  if (!path) return;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, "", "utf8");
}
