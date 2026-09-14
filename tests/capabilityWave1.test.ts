import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { quoteCapability } from "../src/runtime/charging.js";
import { searchCapabilities } from "../src/runtime/discovery.js";
import { renderRecipeUrl } from "../src/runtime/executor.js";
import { VERIFIED_RECIPES } from "../src/runtime/recipes.js";
import { WAVE1_VERIFIED_RECIPES } from "../src/runtime/wave1Recipes.js";

const originalEconomicsJson = process.env.MISSING_ECONOMICS_JSON;
const originalMinMargin = process.env.MISSING_MIN_MARGIN_MICROUSD;

beforeEach(() => {
  process.env.MISSING_ECONOMICS_JSON = JSON.stringify({
    recipes: {},
    product_live_family_defaults: {
      finance: { provider_cost_microusd: 0, customer_price_microusd: 5000 },
      network: { provider_cost_microusd: 0, customer_price_microusd: 5000 },
      developer: { provider_cost_microusd: 0, customer_price_microusd: 5000 },
      geography: { provider_cost_microusd: 0, customer_price_microusd: 5000 },
    },
  });
  process.env.MISSING_MIN_MARGIN_MICROUSD = "1";
});

afterEach(() => {
  if (originalEconomicsJson === undefined) delete process.env.MISSING_ECONOMICS_JSON;
  else process.env.MISSING_ECONOMICS_JSON = originalEconomicsJson;

  if (originalMinMargin === undefined) delete process.env.MISSING_MIN_MARGIN_MICROUSD;
  else process.env.MISSING_MIN_MARGIN_MICROUSD = originalMinMargin;
});

describe("Capability Expansion Wave 1", () => {
  it("registers nine credential-free replay-verified GET capabilities", () => {
    expect(WAVE1_VERIFIED_RECIPES).toHaveLength(9);
    expect(new Set(WAVE1_VERIFIED_RECIPES.map(recipe => recipe.capability)).size).toBe(9);
    expect(new Set(WAVE1_VERIFIED_RECIPES.map(recipe => recipe.recipe_fingerprint)).size).toBe(9);

    for (const recipe of WAVE1_VERIFIED_RECIPES) {
      expect(recipe.method).toBe("GET");
      expect(recipe.credential_bindings ?? []).toHaveLength(0);
      expect(recipe.verification.source).toBe("product_live");
      if (recipe.verification.source === "product_live") {
        expect(recipe.verification.verification_inputs).toHaveLength(2);
      }
      expect(VERIFIED_RECIPES.some(item => item.recipe_fingerprint === recipe.recipe_fingerprint)).toBe(true);
    }
  });

  it("renders representative public provider URLs safely", () => {
    const byCapability = new Map(WAVE1_VERIFIED_RECIPES.map(recipe => [recipe.capability, recipe]));

    expect(renderRecipeUrl(byCapability.get("currency_exchange_rate")!, { base_currency: "usd", quote_currency: "eur" }))
      .toBe("https://api.frankfurter.dev/v2/rate/usd/eur");
    expect(renderRecipeUrl(byCapability.get("dns_record_lookup")!, { name: "example.com", type: "A" }))
      .toBe("https://dns.google/resolve?name=example.com&type=A");
    expect(renderRecipeUrl(byCapability.get("domain_rdap_metadata")!, { domain: "example.com" }))
      .toBe("https://rdap.org/domain/example.com");
    expect(renderRecipeUrl(byCapability.get("npm_package_metadata")!, { package_name: "express" }))
      .toBe("https://registry.npmjs.org/express/latest");
    expect(renderRecipeUrl(byCapability.get("pypi_package_metadata")!, { package_name: "requests" }))
      .toBe("https://pypi.org/pypi/requests/json");
    expect(renderRecipeUrl(byCapability.get("nuget_package_versions")!, { package_name: "newtonsoft.json" }))
      .toBe("https://api.nuget.org/v3-flatcontainer/newtonsoft.json/index.json");
    expect(renderRecipeUrl(byCapability.get("github_repository_metadata")!, { owner: "openai", repo: "openai-python" }))
      .toBe("https://api.github.com/repos/openai/openai-python");
    expect(renderRecipeUrl(byCapability.get("github_user_metadata")!, { username: "torvalds" }))
      .toBe("https://api.github.com/users/torvalds");
    expect(renderRecipeUrl(byCapability.get("postal_code_location_metadata")!, { country_code: "us", postal_code: "90210" }))
      .toBe("https://api.zippopotam.us/us/90210");
  });

  it("quotes every Wave 1 capability at the standing product-live price", () => {
    for (const recipe of WAVE1_VERIFIED_RECIPES) {
      expect(quoteCapability(recipe.capability)).toMatchObject({
        status: "quoted",
        capability: recipe.capability,
        customer_price_microusd: 5000,
        currency: "USD",
      });
    }
  });

  it("finds the new capabilities from agent-like natural-language intents", () => {
    const cases = [
      ["convert currency exchange rate USD EUR", "currency_exchange_rate"],
      ["query DNS record for a domain", "dns_record_lookup"],
      ["RDAP domain registration details", "domain_rdap_metadata"],
      ["latest npm package version", "npm_package_metadata"],
      ["latest pypi package version", "pypi_package_metadata"],
      ["available NuGet package versions", "nuget_package_versions"],
      ["GitHub repository stars and default branch", "github_repository_metadata"],
      ["GitHub user followers and public repos", "github_user_metadata"],
      ["location for a postal zipcode", "postal_code_location_metadata"],
    ] as const;

    for (const [query, expectedCapability] of cases) {
      const matches = searchCapabilities(query, 5);
      expect(matches.some(match => match.capability === expectedCapability), `${query} should find ${expectedCapability}`).toBe(true);
    }
  });
});
