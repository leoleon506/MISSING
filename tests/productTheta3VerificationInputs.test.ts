import { describe, expect, it } from "vitest";
import { compileOpenApiLead } from "../src/runtime/openApiCompiler.js";
import type { ProviderDiscoveryCandidate } from "../src/runtime/providerDiscovery.js";
import { harvestVerificationInputs } from "../src/runtime/verificationInputHarvest.js";

function lead(): ProviderDiscoveryCandidate {
  return {
    source: "apis_guru",
    directory_id: "example.com:vat",
    provider: "Example VAT API",
    title: "Example VAT API",
    description: "Validate European VAT numbers",
    spec_url: "https://specs.example/openapi.json",
    directory_url: "https://apis.guru/example",
    openapi_version: "3.0.3",
    score: 0.9,
    matched_terms: ["finnish", "vat"],
    demand_intent: "Validate this Finnish VAT number",
    normalized_intent: "validate this finnish vat number",
  };
}

describe("MISSING Product Theta.3 verification-input harvesting", () => {
  it("harvests two distinct inputs only from documented parameter evidence", () => {
    const result = harvestVerificationInputs([
      {
        input_name: "vat_number",
        parameter: {
          name: "vat_number",
          in: "path",
          required: true,
          schema: { type: "string", enum: ["FI12345678", "FI87654321"] },
        },
      },
    ]);

    expect(result.status).toBe("ready");
    expect(result.inputs).toEqual([
      { vat_number: "FI12345678" },
      { vat_number: "FI87654321" },
    ]);
    expect(result.evidence.map(item => item.source)).toEqual(["schema_enum", "schema_enum"]);
  });

  it("combines documented values across all required parameters", () => {
    const result = harvestVerificationInputs([
      { input_name: "country", parameter: { schema: { enum: ["FI", "SE"] } } },
      { input_name: "vat_number", parameter: { example: "12345678" } },
    ]);

    expect(result.status).toBe("ready");
    expect(result.inputs).toEqual([
      { country: "FI", vat_number: "12345678" },
      { country: "SE", vat_number: "12345678" },
    ]);
  });

  it("fails closed when the contract documents only one complete input", () => {
    const result = harvestVerificationInputs([
      { input_name: "vat_number", parameter: { schema: { example: "FI12345678" } } },
    ]);

    expect(result.status).toBe("insufficient_evidence");
    expect(result.inputs).toEqual([]);
    expect(result.missing_inputs).toEqual(["vat_number"]);
  });

  it("automatically makes a Theta.2 candidate ready when OpenAPI contains two grounded examples", async () => {
    const spec = {
      openapi: "3.0.3",
      servers: [{ url: "https://vat.example/api" }],
      paths: {
        "/vat/{vat_number}": {
          get: {
            operationId: "validateVatNumber",
            summary: "Validate Finnish VAT number",
            parameters: [{
              name: "vat_number",
              in: "path",
              required: true,
              schema: { type: "string", enum: ["FI12345678", "FI87654321"] },
            }],
            responses: {
              "200": {
                content: {
                  "application/json": {
                    schema: {
                      type: "object",
                      required: ["valid"],
                      properties: { valid: { type: "boolean" }, country: { type: "string" } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    };

    const result = await compileOpenApiLead(lead(), {
      fetchFn: async () => new Response(JSON.stringify(spec), { status: 200 }),
      capability: "finnish_vat_validation",
    });

    expect(result.status).toBe("candidate_ready");
    expect(result.candidate?.verification_inputs).toEqual([
      { vat_number: "FI12345678" },
      { vat_number: "FI87654321" },
    ]);
    expect(result.verification_input_evidence).toHaveLength(2);
  });

  it("does not treat one documented default as two independent replays", async () => {
    const spec = {
      openapi: "3.0.3",
      servers: [{ url: "https://vat.example/api" }],
      paths: {
        "/vat/{vat_number}": {
          get: {
            summary: "Validate VAT number",
            parameters: [{ name: "vat_number", in: "path", required: true, schema: { type: "string", default: "FI12345678" } }],
            responses: {
              "200": {
                content: { "application/json": { schema: { type: "object", properties: { valid: { type: "boolean" } } } } },
              },
            },
          },
        },
      },
    };

    const result = await compileOpenApiLead(lead(), {
      fetchFn: async () => new Response(JSON.stringify(spec), { status: 200 }),
    });

    expect(result.status).toBe("needs_verification_inputs");
    expect(result.candidate?.verification_inputs).toEqual([]);
    expect(result.verification_input_evidence).toEqual([
      { input_name: "vat_number", value: "FI12345678", source: "schema_default" },
    ]);
  });
});
