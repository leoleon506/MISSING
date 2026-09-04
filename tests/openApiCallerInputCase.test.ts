import { describe, expect, it } from "vitest";
import { compileOpenApiLead } from "../src/runtime/openApiCompiler.js";
import type { ProviderDiscoveryCandidate } from "../src/runtime/providerDiscovery.js";

const lead: ProviderDiscoveryCandidate = {
  source: "apis_guru",
  directory_id: "holidays.example",
  provider: "Holiday Example API",
  title: "Holiday Example API",
  description: "Return a holiday by id and year",
  spec_url: "https://example.test/openapi.json",
  directory_url: null,
  openapi_version: "3.0.0",
  score: 1,
  matched_terms: ["holiday", "id", "year"],
  demand_intent: "Get holiday metadata by holiday ID and year",
  normalized_intent: "get holiday metadata by holiday id and year",
};

const spec = {
  openapi: "3.0.0",
  servers: [{ url: "https://example.test" }],
  paths: {
    "/holidays/{holidayId}": {
      get: {
        summary: "Get a holiday by id",
        parameters: [
          { name: "holidayId", in: "path", required: true, schema: { type: "integer" } },
          { name: "year", in: "query", required: false, schema: { type: "integer" } },
        ],
        responses: {
          "200": {
            description: "ok",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["holiday"],
                  properties: {
                    holiday: { type: "object" },
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

describe("OpenAPI caller input name preservation", () => {
  it("preserves caller-provided camelCase keys when binding provider parameters", async () => {
    const verificationInputs = [
      { holidayId: 1, year: 2026 },
      { holidayId: 32, year: 2027 },
    ];

    const result = await compileOpenApiLead(lead, {
      capability: "canadian_holiday_metadata_by_id",
      family: "discovered",
      verificationInputs,
      fetchFn,
    });

    expect(result.status).toBe("candidate_ready");
    expect(result.candidate?.path_bindings).toEqual({ holidayId: "$input.holidayId" });
    expect(result.candidate?.query_bindings).toEqual({ year: "$input.year" });
    expect(result.candidate?.verification_inputs).toEqual(verificationInputs);
  });
});
