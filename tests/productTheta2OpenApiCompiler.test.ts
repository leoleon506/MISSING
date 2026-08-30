import { describe, expect, it } from "vitest";
import { compileOpenApiLead } from "../src/runtime/openApiCompiler.js";
import type { ProviderDiscoveryCandidate } from "../src/runtime/providerDiscovery.js";

function lead(overrides: Partial<ProviderDiscoveryCandidate> = {}): ProviderDiscoveryCandidate {
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
    ...overrides,
  };
}

const openApi = {
  openapi: "3.0.3",
  servers: [{ url: "https://vat.example/api" }],
  paths: {
    "/health": { get: { operationId: "health", summary: "Service health", responses: { "200": { content: { "application/json": { schema: { type: "object", properties: { ok: { type: "boolean" } } } } } } } } },
    "/vat/{vat_number}": {
      get: {
        operationId: "validateVatNumber",
        summary: "Validate a Finnish VAT number",
        parameters: [{ name: "vat_number", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { content: { "application/json": { schema: { type: "object", required: ["valid", "country"], properties: { valid: { type: "boolean" }, country: { type: "string" }, normalized: { type: "string" } } } } } } },
      },
    },
  },
};

const fetchJson = async () => new Response(JSON.stringify(openApi), { status: 200, headers: { "content-type": "application/json" } });

describe("MISSING Product Theta.2 OpenAPI recipe compiler", () => {
  it("selects the GET operation most relevant to unresolved demand", async () => {
    const result = await compileOpenApiLead(lead(), { fetchFn: fetchJson });
    expect(result.operation?.path).toBe("/vat/{vat_number}");
    expect(result.operation?.operation_id).toBe("validateVatNumber");
    expect(result.operation?.matched_terms).toContain("vat");
  });

  it("rejects an OpenAPI document when its best GET has zero semantic overlap", async () => {
    const unrelated = {
      openapi: "3.0.3",
      servers: [{ url: "https://unrelated.example" }],
      paths: {
        "/reservations": {
          get: {
            operationId: "listReservations",
            summary: "List cloud reservations",
            responses: { "200": { content: { "application/json": { schema: { type: "object", properties: { items: { type: "array" } } } } } } },
          },
        },
      },
    };
    const result = await compileOpenApiLead(lead(), { fetchFn: async () => new Response(JSON.stringify(unrelated), { status: 200 }) });
    expect(result.status).toBe("unsupported");
    expect(result.candidate).toBeNull();
    expect(result.missing).toContain("relevant_get_operation");
  });

  it("derives deterministic path bindings and response projection", async () => {
    const result = await compileOpenApiLead(lead(), { fetchFn: fetchJson });
    expect(result.candidate?.base_url).toBe("https://vat.example/api");
    expect(result.candidate?.path_template).toBe("/vat/{vat_number}");
    expect(result.candidate?.path_bindings).toEqual({ vat_number: "$input.vat_number" });
    expect(result.candidate?.projection).toEqual({ country: { op: "FIELD", path: "country" }, normalized: { op: "FIELD", path: "normalized" }, valid: { op: "FIELD", path: "valid" } });
    expect(result.candidate?.required.sort()).toEqual(["country", "valid"]);
  });

  it("refuses to invent replay inputs when OpenAPI does not provide two real examples", async () => {
    const result = await compileOpenApiLead(lead(), { fetchFn: fetchJson });
    expect(result.status).toBe("needs_verification_inputs");
    expect(result.missing).toContain("verification_inputs");
    expect(result.candidate?.verification_inputs).toEqual([]);
  });

  it("produces a Theta-ready candidate when two independent replay inputs are supplied", async () => {
    const result = await compileOpenApiLead(lead(), { fetchFn: fetchJson, capability: "finnish_vat_validation", family: "compliance", verificationInputs: [{ vat_number: "FI12345678" }, { vat_number: "FI87654321" }] });
    expect(result.status).toBe("candidate_ready");
    expect(result.missing).toEqual([]);
    expect(result.candidate?.capability).toBe("finnish_vat_validation");
    expect(result.candidate?.family).toBe("compliance");
    expect(result.candidate?.verification_inputs).toHaveLength(2);
    expect(result.candidate?.candidate_id).toMatch(/^theta2_[a-f0-9]{16}$/);
  });

  it("supports Swagger 2 HTTPS host and basePath", async () => {
    const swagger = { swagger: "2.0", host: "vat.example", basePath: "/v1", schemes: ["https"], paths: { "/vat/{vat_number}": { get: { operationId: "validateVat", summary: "Finnish VAT validation", parameters: [{ name: "vat_number", in: "path", required: true, type: "string" }], responses: { "200": { schema: { type: "object", properties: { valid: { type: "boolean" }, country: { type: "string" } } } } } } } } };
    const result = await compileOpenApiLead(lead(), { fetchFn: async () => new Response(JSON.stringify(swagger), { status: 200 }), verificationInputs: [{ vat_number: "FI1" }, { vat_number: "FI2" }] });
    expect(result.candidate?.base_url).toBe("https://vat.example/v1");
    expect(result.status).toBe("candidate_ready");
  });

  it("fails closed when no deterministic object projection can be derived", async () => {
    const primitiveSpec = { openapi: "3.0.3", servers: [{ url: "https://vat.example" }], paths: { "/vat/{vat_number}": { get: { summary: "Validate VAT number", parameters: [{ name: "vat_number", in: "path", required: true }], responses: { "200": { content: { "application/json": { schema: { type: "string" } } } } } } } } };
    const result = await compileOpenApiLead(lead(), { fetchFn: async () => new Response(JSON.stringify(primitiveSpec), { status: 200 }) });
    expect(result.status).toBe("unsupported");
    expect(result.candidate).toBeNull();
    expect(result.missing).toContain("object_response_projection");
  });
});
