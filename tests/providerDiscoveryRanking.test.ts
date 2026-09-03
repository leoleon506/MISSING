import { describe, expect, it } from "vitest";
import { discoverProviderCandidates } from "../src/runtime/providerDiscovery.js";
import type { SupplyOpportunity } from "../src/runtime/acquisition.js";

const opportunity: SupplyOpportunity = {
  intent: "Get all Canadian holidays for a year",
  normalized_intent: "get all canadian holidays for a year",
  requested_capability: "canadian_holidays_by_year",
  observations: 2,
  source_diversity: 1,
  sources: { mcp: 2 },
  first_seen_at: "2026-09-03T00:00:00.000Z",
  last_seen_at: "2026-09-03T00:01:00.000Z",
  priority_score: 1,
};

describe("provider discovery semantic ranking", () => {
  it("prefers provider identity matches over generic description matches and handles Canadian/Canada morphology", async () => {
    const directory = {
      "canada-holidays.ca": {
        preferred: "1.8.0",
        versions: {
          "1.8.0": {
            info: {
              title: "Canada Holidays API",
              description: "Public API for holidays in Canada by year and province.",
            },
            swaggerUrl: "https://example.test/canada-holidays.json",
            link: "https://example.test/canada-holidays",
            openapiVer: "3.0.0",
          },
        },
      },
      "generic.example": {
        preferred: "1.0.0",
        versions: {
          "1.0.0": {
            info: {
              title: "Generic Workforce API",
              description: "A large API whose documentation happens to mention Canadian holiday calendars and yearly metadata among many unrelated features.",
            },
            swaggerUrl: "https://example.test/generic.json",
            link: "https://example.test/generic",
            openapiVer: "3.0.0",
          },
        },
      },
    };

    const candidates = await discoverProviderCandidates(opportunity, {
      limit: 10,
      fetchFn: async () => new Response(JSON.stringify(directory), { status: 200, headers: { "content-type": "application/json" } }),
    });

    expect(candidates[0]?.directory_id).toBe("canada-holidays.ca");
    expect(candidates[0]?.matched_terms).toContain("canadian");
    expect(candidates[0]!.score).toBeGreaterThan(candidates[1]!.score);
  });
});
