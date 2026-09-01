import { afterEach, describe, expect, it } from "vitest";
import { verifySupplyCandidate, type SupplyCandidate } from "../src/runtime/acquisition.js";
import { recordDemand, resetDemand } from "../src/runtime/discovery.js";
import { compileOpenApiLead, type OpenApiCompileResult } from "../src/runtime/openApiCompiler.js";
import { runThetaOrchestrator } from "../src/runtime/orchestrator.js";
import type { ProviderDiscoveryCandidate } from "../src/runtime/providerDiscovery.js";

function lead(overrides: Partial<ProviderDiscoveryCandidate> = {}): ProviderDiscoveryCandidate {
  return {
    source: "apis_guru",
    directory_id: "example.com:items",
    provider: "Example Items API",
    title: "Example Items API",
    description: "Create and inspect items",
    spec_url: "https://specs.example/items-openapi.json",
    directory_url: "https://apis.guru/example-items",
    openapi_version: "3.0.3",
    score: 1,
    matched_terms: ["create", "item"],
    demand_intent: "Create an item",
    normalized_intent: "create item",
    ...overrides,
  };
}

function postSpec(bodySchema: Record<string, unknown>) {
  return {
    openapi: "3.0.3",
    servers: [{ url: "https://items.example/api" }],
    paths: {
      "/items": {
        post: {
          operationId: "createItem",
          summary: "Create item",
          requestBody: { required: true, content: { "application/json": { schema: bodySchema } } },
          responses: {
            "201": {
              content: {
                "application/json": {
                  schema: { type: "object", required: ["id"], properties: { id: { type: "string" }, status: { type: "string" } } },
                },
              },
            },
          },
        },
      },
    },
  };
}

const responseFor = (spec: unknown) => async () => new Response(JSON.stringify(spec), { status: 200, headers: { "content-type": "application/json" } });

afterEach(() => resetDemand());

describe("Product Lambda.1 POST OpenAPI compiler", () => {
  it("harvests documented requestBody values but still requires safe verification", async () => {
    const spec = postSpec({
      type: "object",
      required: ["name"],
      properties: { name: { type: "string", enum: ["alpha", "beta"] } },
    });
    const result = await compileOpenApiLead(lead(), { fetchFn: responseFor(spec) });

    expect(result.status).toBe("needs_safe_verification");
    expect(result.operation?.method).toBe("POST");
    expect(result.candidate?.method).toBe("POST");
    expect(result.candidate?.body_bindings).toEqual({ name: "$input.name" });
    expect(result.candidate?.verification_inputs).toEqual([{ name: "alpha" }, { name: "beta" }]);
    expect(result.missing).toEqual(["safe_verification"]);
    expect(result.verification_input_evidence.map(item => item.source)).toContain("schema_enum");
  });

  it("preserves GET-first autonomous acquisition when a relevant GET also exists", async () => {
    const spec = {
      ...postSpec({ type: "object", required: ["name"], properties: { name: { type: "string" } } }),
      paths: {
        "/items/{id}": {
          get: {
            operationId: "getItem",
            summary: "Get item",
            parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
            responses: { "200": { content: { "application/json": { schema: { type: "object", required: ["id"], properties: { id: { type: "string" } } } } } } },
          },
        },
        "/items": (postSpec({ type: "object", required: ["name"], properties: { name: { type: "string" } } }) as any).paths["/items"],
      },
    };
    const result = await compileOpenApiLead(lead(), {
      fetchFn: responseFor(spec),
      verificationInputs: [{ id: "one" }, { id: "two" }],
    });

    expect(result.operation?.method).toBe("GET");
    expect(result.operation?.path).toBe("/items/{id}");
    expect(result.status).toBe("candidate_ready");
    expect(result.candidate?.method).toBe("GET");
    expect(result.candidate?.body_bindings).toBeUndefined();
  });

  it("rejects POST operations without a deterministic application/json object body", async () => {
    const spec = {
      openapi: "3.0.3",
      servers: [{ url: "https://items.example/api" }],
      paths: {
        "/items": {
          post: {
            operationId: "createItem",
            summary: "Create item",
            requestBody: { required: true, content: { "text/plain": { schema: { type: "string" } } } },
            responses: { "200": { content: { "application/json": { schema: { type: "object", properties: { id: { type: "string" } } } } } } },
          },
        },
      },
    };
    const result = await compileOpenApiLead(lead(), { fetchFn: responseFor(spec) });
    expect(result.status).toBe("unsupported");
    expect(result.missing).toContain("json_request_body");
    expect(result.candidate).toBeNull();
  });

  it("rejects compiled POST candidates before network in automatic replay verification", async () => {
    const candidate: SupplyCandidate = {
      candidate_id: "lambda1_post_candidate",
      demand_intent: "Create item",
      capability: "create_item",
      family: "items",
      provider: "Example Items API",
      evidence_url: "https://specs.example/items-openapi.json",
      method: "POST",
      base_url: "https://items.example",
      path_template: "/items",
      path_bindings: {},
      query_bindings: {},
      body_bindings: { name: "$input.name" },
      projection: { id: { op: "FIELD", path: "id" } },
      required: ["id"],
      verification_inputs: [{ name: "alpha" }, { name: "beta" }],
    };
    await expect(verifySupplyCandidate(candidate)).rejects.toThrow(/POST requires safe verification/i);
  });

  it("never invokes acquisition for a needs_safe_verification compiler result", async () => {
    recordDemand("Create item", null, "a2a");
    const l = lead();
    let acquisitionCalls = 0;
    const candidate: SupplyCandidate = {
      candidate_id: "lambda1_safe_candidate",
      demand_intent: l.demand_intent,
      capability: "create_item",
      family: "items",
      provider: l.provider,
      evidence_url: l.spec_url,
      method: "POST",
      base_url: "https://items.example",
      path_template: "/items",
      path_bindings: {},
      query_bindings: {},
      body_bindings: { name: "$input.name" },
      projection: { id: { op: "FIELD", path: "id" } },
      required: ["id"],
      verification_inputs: [{ name: "alpha" }, { name: "beta" }],
    };
    const compiled: OpenApiCompileResult = {
      status: "needs_safe_verification",
      lead: l,
      operation: { method: "POST", path: "/items", operation_id: "createItem", summary: "Create item", score: 1, matched_terms: ["create", "item"] },
      candidate,
      verification_input_evidence: [],
      provider_readiness: { credentials_required: [], response_schema_missing: false },
      missing: ["safe_verification"],
      reason: "POST requires explicit safe verification",
    };

    const result = await runThetaOrchestrator({
      discoverFn: async () => [l],
      compileFn: async () => compiled,
      acquireFn: async () => {
        acquisitionCalls += 1;
        throw new Error("acquisition must not run");
      },
    });

    expect(result.status).toBe("needs_safe_verification");
    expect(result.selected_provider).toBe(l.provider);
    expect(acquisitionCalls).toBe(0);
    expect(result.trace.some(step => step.status === "needs_safe_verification")).toBe(true);
  });
});
