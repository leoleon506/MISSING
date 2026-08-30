import { afterEach, describe, expect, it } from "vitest";
import { recordDemand, resetDemand } from "../src/runtime/discovery.js";
import {
  discoverProviderCandidates,
  discoverTopSupplyCandidates,
  providerDiscoveryEnabled,
  type ProviderDiscoveryCandidate,
} from "../src/runtime/providerDiscovery.js";
import type { SupplyOpportunity } from "../src/runtime/acquisition.js";

const opportunity: SupplyOpportunity = {
  intent: "Validate this Finnish VAT number",
  normalized_intent: "validate this finnish vat number",
  requested_capability: null,
  observations: 2,
  source_diversity: 1,
  sources: { a2a: 2 },
  first_seen_at: "2026-08-30T00:00:00.000Z",
  last_seen_at: "2026-08-30T00:01:00.000Z",
  priority_score: 1,
};

function directoryResponse(status = 200) {
  const payload = {
    "weather.example": {
      preferred: "1.0",
      versions: {
        "1.0": {
          info: { title: "Weather API", description: "Forecast and current conditions" },
          swaggerUrl: "https://specs.example/weather.json",
          link: "https://apis.guru/apis/weather.example",
          openapiVer: "3.0.0",
        },
      },
    },
    "finnish-vat.example": {
      preferred: "2.0",
      versions: {
        "1.0": {
          info: { title: "Old VAT API", description: "Legacy" },
          swaggerUrl: "https://specs.example/vat-v1.json",
        },
        "2.0": {
          info: { title: "Finnish VAT Validation API", description: "Validate Finnish VAT identifiers" },
          swaggerUrl: "https://specs.example/vat-v2.json",
          link: "https://apis.guru/apis/finnish-vat.example",
          openapiVer: "3.1.0",
        },
      },
    },
    "vat-no-spec.example": {
      preferred: "1.0",
      versions: {
        "1.0": { info: { title: "Finnish VAT without spec" } },
      },
    },
  };
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const fakeFetch = async () => directoryResponse();

afterEach(() => {
  delete process.env.MISSING_PROVIDER_DISCOVERY_ENABLED;
  delete process.env.MISSING_PROVIDER_DIRECTORY_URL;
  resetDemand();
});

describe("MISSING Product Theta.1 provider discovery", () => {
  it("is disabled by default and opt-in on trusted workers", () => {
    expect(providerDiscoveryEnabled()).toBe(false);
    process.env.MISSING_PROVIDER_DISCOVERY_ENABLED = "1";
    expect(providerDiscoveryEnabled()).toBe(true);
  });

  it("ranks structured OpenAPI directory candidates against unresolved demand", async () => {
    const candidates = await discoverProviderCandidates(opportunity, { fetchFn: fakeFetch, limit: 5 });
    expect(candidates).toHaveLength(1);
    const first = candidates[0] as ProviderDiscoveryCandidate;
    expect(first.directory_id).toBe("finnish-vat.example");
    expect(first.provider).toBe("Finnish VAT Validation API");
    expect(first.spec_url).toBe("https://specs.example/vat-v2.json");
    expect(first.openapi_version).toBe("3.1.0");
    expect(first.matched_terms).toContain("finnish");
    expect(first.matched_terms).toContain("vat");
    expect(first.score).toBeGreaterThan(0.5);
  });

  it("uses the durable demand ranking as the automatic discovery queue", async () => {
    recordDemand("Validate this Finnish VAT number", null, "a2a");
    recordDemand("Validate this Finnish VAT number", null, "mcp");
    recordDemand("Find a fictional registry record", null, "a2a");

    const results = await discoverTopSupplyCandidates({
      fetchFn: fakeFetch,
      opportunityLimit: 1,
      candidatesPerOpportunity: 3,
    });
    expect(results).toHaveLength(1);
    expect(results[0]?.opportunity.normalized_intent).toBe("validate this finnish vat number");
    expect(results[0]?.candidates[0]?.directory_id).toBe("finnish-vat.example");
  });

  it("fails closed when the provider directory is unavailable", async () => {
    const unavailable = async () => new Response("unavailable", { status: 503 });
    await expect(discoverProviderCandidates(opportunity, { fetchFn: unavailable }))
      .rejects.toThrow("Provider directory request failed with HTTP 503");
  });
});
