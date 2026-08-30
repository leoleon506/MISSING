import { describe, expect, it } from "vitest";
import { compileOpenApiLead } from "../src/runtime/openApiCompiler.js";
import type { ProviderDiscoveryCandidate } from "../src/runtime/providerDiscovery.js";

const lead: ProviderDiscoveryCandidate = {
  source: "apis_guru",
  directory_id: "vat.example",
  provider: "VAT API",
  title: "VAT API",
  description: "VAT validation",
  spec_url: "https://specs.example/vat.json",
  directory_url: null,
  openapi_version: "2.0",
  score: 0.9,
  matched_terms: ["vat"],
  demand_intent: "Validate this Finnish VAT number",
  normalized_intent: "validate this finnish vat number",
};

describe("MISSING Product Theta.8 provider readiness diagnostics", () => {
  it("classifies a relevant provider with required API key and undocumented response schema as needs_provider_setup", async () => {
    const spec = {
      swagger: "2.0",
      host: "vat.example",
      schemes: ["https"],
      paths: {
        "/vat-number-check": {
          get: {
            operationId: "checkVatNumber",
            summary: "Validate VAT number",
            parameters: [
              { name: "apikey", in: "header", required: true, type: "string" },
              { name: "vat_number", in: "query", required: true, type: "string" },
            ],
            responses: { "200": { description: "Successful response" } },
          },
        },
      },
    };
    const result = await compileOpenApiLead(lead, {
      fetchFn: async () => new Response(JSON.stringify(spec), { status: 200 }),
    });
    expect(result.status).toBe("needs_provider_setup");
    expect(result.provider_readiness.credentials_required).toEqual(["apikey"]);
    expect(result.provider_readiness.response_schema_missing).toBe(true);
    expect(result.missing).toContain("credential:apikey");
    expect(result.missing).toContain("response_schema");
    expect(result.candidate).toBeNull();
  });

  it("detects OpenAPI security requirements even when credentials are not expressed as header parameters", async () => {
    const spec = {
      openapi: "3.0.3",
      servers: [{ url: "https://vat.example" }],
      security: [{ ApiKeyAuth: [] }],
      paths: {
        "/vat/{vat_number}": {
          get: {
            operationId: "validateVat",
            summary: "Validate VAT number",
            parameters: [{ name: "vat_number", in: "path", required: true, schema: { type: "string" } }],
            responses: {
              "200": {
                content: {
                  "application/json": {
                    schema: { type: "object", properties: { valid: { type: "boolean" } } },
                  },
                },
              },
            },
          },
        },
      },
    };
    const result = await compileOpenApiLead(lead, {
      fetchFn: async () => new Response(JSON.stringify(spec), { status: 200 }),
    });
    expect(result.status).toBe("needs_provider_setup");
    expect(result.provider_readiness.credentials_required).toEqual(["ApiKeyAuth"]);
    expect(result.provider_readiness.response_schema_missing).toBe(false);
  });

  it("does not weaken normal candidate compilation for credential-free documented providers", async () => {
    const spec = {
      openapi: "3.0.3",
      servers: [{ url: "https://vat.example" }],
      paths: {
        "/vat/{vat_number}": {
          get: {
            operationId: "validateVat",
            summary: "Validate VAT number",
            parameters: [{ name: "vat_number", in: "path", required: true, schema: { type: "string", enum: ["FI123", "FI456"] } }],
            responses: {
              "200": {
                content: {
                  "application/json": {
                    schema: { type: "object", required: ["valid"], properties: { valid: { type: "boolean" } } },
                  },
                },
              },
            },
          },
        },
      },
    };
    const result = await compileOpenApiLead(lead, {
      fetchFn: async () => new Response(JSON.stringify(spec), { status: 200 }),
    });
    expect(result.status).toBe("candidate_ready");
    expect(result.provider_readiness).toEqual({ credentials_required: [], response_schema_missing: false });
    expect(result.candidate?.verification_inputs).toHaveLength(2);
  });
});
