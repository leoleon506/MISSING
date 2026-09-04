import { describe, expect, it } from "vitest";
import { compileOpenApiLead } from "../src/runtime/openApiCompiler.js";
import type { ProviderDiscoveryCandidate } from "../src/runtime/providerDiscovery.js";

const lead: ProviderDiscoveryCandidate = {
  source: "apis_guru",
  directory_id: "holidays.example",
  provider: "Holiday Example API",
  title: "Holiday Example API",
  description: "Return holidays by year",
  spec_url: "https://example.test/openapi.json",
  directory_url: null,
  openapi_version: "3.0.0",
  score: 1,
  matched_terms: ["holidays", "year"],
  demand_intent: "Get holidays for a year",
  normalized_intent: "get holidays for a year",
};

const spec = {
  openapi: "3.0.0",
  servers: [{ url: "https://example.test" }],
  paths: {
    "/holidays": {
      get: {
        summary: "Get holidays for a year",
        parameters: [
          { name: "year", in: "query", required: false, schema: { type: "integer", default: 2026 } },
          { name: "language", in: "query", required: false, schema: { type: "string" } },
        ],
        responses: {
          "200": {
            description: "ok",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["year", "holidays"],
                  properties: {
                    year: { type: "integer" },
                    holidays: { type: "array", items: { type: "object" } },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
};

const fetchFn = async () => new Response(JSON.stringify(spec), {
  status: 200,
  headers: { "content-type": "application/json" },
});

describe("OpenAPI caller-backed optional query parameters", () => {
  it("binds an optional query parameter present in every caller replay input", async () => {
    const result = await compileOpenApiLead(lead, {
      capability: "holidays_by_year",
      verificationInputs: [{ year: 2026 }, { year: 2027 }],
      fetchFn,
    });

    expect(result.status).toBe("candidate_ready");
    expect(result.candidate?.query_bindings).toEqual({ year: "$input.year" });
    expect(result.candidate?.verification_inputs).toEqual([{ year: 2026 }, { year: 2027 }]);
  });

  it("does not bind unrelated optional query parameters without caller evidence", async () => {
    const result = await compileOpenApiLead(lead, {
      capability: "holidays_by_year",
      verificationInputs: [{ year: 2026 }, { year: 2027 }],
      fetchFn,
    });

    expect(result.candidate?.query_bindings).not.toHaveProperty("language");
  });
});
