import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { configureAgentRankLedger, resetAgentRankForTest } from "../src/runtime/agentRank.js";
import {
  configureEconomicsLedger,
  economicsSnapshot,
  economicsSummary,
  rankRecipesByEconomics,
  recipeEconomics,
  recordEconomicsResolution,
  truncateEconomicsLedger,
} from "../src/runtime/economics.js";
import { resetRuntimeHealth, resolveCapability } from "../src/runtime/executor.js";
import { recipesForCapability } from "../src/runtime/recipes.js";
import type { VerifiedRecipe } from "../src/runtime/types.js";

let tempDir: string | null = null;

function setup() {
  tempDir = mkdtempSync(join(tmpdir(), "missing-kappa-"));
  configureEconomicsLedger(join(tempDir, "economics.jsonl"));
  truncateEconomicsLedger();
  configureAgentRankLedger(null);
  resetAgentRankForTest();
  resetRuntimeHealth();
}

function configureCountryEconomics(args: {
  warnelyCost: number;
  warnelyPrice: number;
  countriesCost: number;
  countriesPrice: number;
}) {
  const recipes = recipesForCapability("country_alpha_metadata");
  const warnely = recipes.find(recipe => recipe.provider === "Warnely")!;
  const countries = recipes.find(recipe => recipe.provider === "countries.dev")!;
  process.env.MISSING_ECONOMICS_JSON = JSON.stringify({
    recipes: {
      [warnely.recipe_fingerprint]: {
        provider_cost_microusd: args.warnelyCost,
        customer_price_microusd: args.warnelyPrice,
      },
      [countries.recipe_fingerprint]: {
        provider_cost_microusd: args.countriesCost,
        customer_price_microusd: args.countriesPrice,
      },
    },
  });
  return { recipes, warnely, countries };
}

function discoveredProductLiveRecipe(args: { credentials?: boolean; family?: string; fingerprint?: string } = {}): VerifiedRecipe {
  return {
    capability: "sample_discovered_capability",
    family: args.family ?? "discovered",
    provider: "Sample Public API",
    provider_candidate_id: "theta_sample",
    recipe_fingerprint: args.fingerprint ?? "family-default-fingerprint",
    method: "GET",
    base_url: "https://example.test",
    path_template: "/resource",
    path_bindings: {},
    query_bindings: { value: "$input.value" },
    ...(args.credentials ? {
      credential_bindings: [{ location: "header", name: "Authorization", credential_key: "sample_token", prefix: "Bearer " }],
    } : {}),
    projection: { value: { op: "FIELD", path: "value" } },
    required: ["value"],
    example_input: { value: "a" },
    verification: {
      status: "replay_verified",
      source: "product_live",
      verification_inputs: [{ value: "a" }, { value: "b" }],
      verified_at: "2026-09-04T00:00:00.000Z",
      evidence_url: "https://example.test/openapi.json",
    },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.MISSING_ECONOMICS_JSON;
  delete process.env.MISSING_ECONOMICS_ENFORCEMENT_ENABLED;
  delete process.env.MISSING_MIN_MARGIN_MICROUSD;
  delete process.env.MISSING_AGENTRANK_EXPLORATION_ENABLED;
  configureEconomicsLedger(null);
  configureAgentRankLedger(null);
  resetAgentRankForTest();
  resetRuntimeHealth();
  if (tempDir) rmSync(tempDir, { recursive: true, force: true });
  tempDir = null;
});

describe("Product Kappa economics and metering", () => {
  it("never treats unknown economics as zero cost", () => {
    setup();
    const recipes = recipesForCapability("country_alpha_metadata");
    const snapshot = economicsSnapshot(recipes, "country_alpha_metadata");
    expect(snapshot.enforcement_enabled).toBe(false);
    expect(snapshot.recipes.every(item => item.economics_status === "unknown")).toBe(true);
    expect(snapshot.recipes.every(item => item.provider_cost_microusd === null)).toBe(true);

    process.env.MISSING_ECONOMICS_ENFORCEMENT_ENABLED = "1";
    expect(rankRecipesByEconomics(recipes)).toEqual([]);
  });

  it("prefers the explicitly higher-margin eligible provider when enforcement is enabled", () => {
    setup();
    const { recipes } = configureCountryEconomics({
      warnelyCost: 1000,
      warnelyPrice: 2500,
      countriesCost: 500,
      countriesPrice: 3000,
    });
    process.env.MISSING_ECONOMICS_ENFORCEMENT_ENABLED = "1";

    expect(rankRecipesByEconomics(recipes).map(recipe => recipe.provider)).toEqual(["countries.dev", "Warnely"]);
  });

  it("enforces a minimum absolute margin without inventing fallback pricing", () => {
    setup();
    const { recipes } = configureCountryEconomics({
      warnelyCost: 1000,
      warnelyPrice: 2500,
      countriesCost: 500,
      countriesPrice: 3000,
    });
    process.env.MISSING_ECONOMICS_ENFORCEMENT_ENABLED = "1";
    process.env.MISSING_MIN_MARGIN_MICROUSD = "2000";

    expect(rankRecipesByEconomics(recipes).map(recipe => recipe.provider)).toEqual(["countries.dev"]);
  });

  it("applies an explicit family default to credential-free product-live supply", () => {
    setup();
    const recipe = discoveredProductLiveRecipe();
    process.env.MISSING_ECONOMICS_ENFORCEMENT_ENABLED = "1";
    process.env.MISSING_MIN_MARGIN_MICROUSD = "1000";
    process.env.MISSING_ECONOMICS_JSON = JSON.stringify({
      product_live_family_defaults: {
        discovered: {
          provider_cost_microusd: 0,
          customer_price_microusd: 5000,
        },
      },
    });

    expect(recipeEconomics(recipe)).toEqual({
      provider_cost_microusd: 0,
      customer_price_microusd: 5000,
      margin_microusd: 5000,
    });
    expect(rankRecipesByEconomics([recipe])).toEqual([recipe]);
    expect(economicsSnapshot([recipe]).recipes[0]).toMatchObject({
      economics_status: "configured",
      economics_source: "product_live_family_default",
      eligible: true,
      provider_cost_microusd: 0,
      customer_price_microusd: 5000,
      margin_microusd: 5000,
    });
  });

  it("does not apply family defaults to credentialed product-live supply", () => {
    setup();
    const recipe = discoveredProductLiveRecipe({ credentials: true });
    process.env.MISSING_ECONOMICS_ENFORCEMENT_ENABLED = "1";
    process.env.MISSING_ECONOMICS_JSON = JSON.stringify({
      product_live_family_defaults: {
        discovered: {
          provider_cost_microusd: 0,
          customer_price_microusd: 5000,
        },
      },
    });

    expect(recipeEconomics(recipe)).toBeNull();
    expect(rankRecipesByEconomics([recipe])).toEqual([]);
  });

  it("keeps experiment recipes unknown even when their family has a product-live default", () => {
    setup();
    const recipe = recipesForCapability("pokemon_name_metadata")[0]!;
    process.env.MISSING_ECONOMICS_ENFORCEMENT_ENABLED = "1";
    process.env.MISSING_ECONOMICS_JSON = JSON.stringify({
      product_live_family_defaults: {
        games: {
          provider_cost_microusd: 0,
          customer_price_microusd: 5000,
        },
      },
    });

    expect(recipe.verification.source).toBe("experiment");
    expect(recipeEconomics(recipe)).toBeNull();
    expect(rankRecipesByEconomics([recipe])).toEqual([]);
  });

  it("lets exact fingerprint economics override a family default", () => {
    setup();
    const recipe = discoveredProductLiveRecipe({ fingerprint: "exact-wins" });
    process.env.MISSING_ECONOMICS_JSON = JSON.stringify({
      recipes: {
        "exact-wins": {
          provider_cost_microusd: 2000,
          customer_price_microusd: 9000,
        },
      },
      product_live_family_defaults: {
        discovered: {
          provider_cost_microusd: 0,
          customer_price_microusd: 5000,
        },
      },
    });

    expect(recipeEconomics(recipe)).toEqual({
      provider_cost_microusd: 2000,
      customer_price_microusd: 9000,
      margin_microusd: 7000,
    });
    expect(economicsSnapshot([recipe]).recipes[0]?.economics_source).toBe("recipe");
  });

  it("persists priced and unknown successful resolution metering", () => {
    setup();
    const { warnely, countries } = configureCountryEconomics({
      warnelyCost: 1000,
      warnelyPrice: 3000,
      countriesCost: 500,
      countriesPrice: 2500,
    });

    recordEconomicsResolution({ capability: "country_alpha_metadata", recipe: warnely, observedAt: "2026-08-30T00:00:00.000Z" });
    delete process.env.MISSING_ECONOMICS_JSON;
    recordEconomicsResolution({ capability: "country_alpha_metadata", recipe: countries, observedAt: "2026-08-30T00:00:01.000Z" });

    expect(economicsSummary()).toEqual({
      resolutions: 2,
      priced_resolutions: 1,
      unknown_economics_resolutions: 1,
      provider_cost_microusd: 1000,
      customer_revenue_microusd: 3000,
      gross_margin_microusd: 2000,
    });
  });

  it("routes and meters a real resolution through the higher-margin provider", async () => {
    setup();
    configureCountryEconomics({
      warnelyCost: 1000,
      warnelyPrice: 2000,
      countriesCost: 500,
      countriesPrice: 3500,
    });
    process.env.MISSING_ECONOMICS_ENFORCEMENT_ENABLED = "1";

    const seen: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      seen.push(url);
      if (url.includes("countries.dev/alpha/US")) {
        return new Response(JSON.stringify({ name: "United States", alpha2Code: "US", region: "Americas" }), { status: 200 });
      }
      throw new Error(`Unexpected URL ${url}`);
    }));

    const result = await resolveCapability("country_alpha_metadata", { country_code: "US" });
    expect(result.status).toBe("resolved");
    if (result.status !== "resolved") return;
    expect(result.provider).toBe("countries.dev");
    expect(seen).toEqual(["https://countries.dev/alpha/US"]);
    expect(economicsSummary()).toEqual({
      resolutions: 1,
      priced_resolutions: 1,
      unknown_economics_resolutions: 0,
      provider_cost_microusd: 500,
      customer_revenue_microusd: 3500,
      gross_margin_microusd: 3000,
    });
  });

  it("returns unavailable before network execution when enforcement has no eligible provider", async () => {
    setup();
    process.env.MISSING_ECONOMICS_ENFORCEMENT_ENABLED = "1";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await resolveCapability("country_alpha_metadata", { country_code: "US" });
    expect(result.status).toBe("unavailable");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
