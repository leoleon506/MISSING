import { afterEach, describe, expect, it } from "vitest";
import { recordDemand, resetDemand } from "../src/runtime/discovery.js";
import { compileOpenApiLead, type OpenApiCompileResult } from "../src/runtime/openApiCompiler.js";
import { runThetaOrchestrator } from "../src/runtime/orchestrator.js";
import type { ProviderDiscoveryCandidate } from "../src/runtime/providerDiscovery.js";
import { assessSafePostVerification } from "../src/runtime/safePostPolicy.js";
import type { SupplyCandidate } from "../src/runtime/acquisition.js";

function lead(overrides: Partial<ProviderDiscoveryCandidate> = {}): ProviderDiscoveryCandidate {
  return {
    source: "apis_guru",
    directory_id: "example.com:create-item",
    provider: "Example Items API",
    title: "Example Items API",
    description: "Create items",
    spec_url: "https://specs.example/items-openapi.json",
    directory_url: "https://apis.guru/example-items",
    openapi_version: "3.0.3",
    score: 1,
    matched_terms: ["create", "item"],
    demand_intent: "Create item",
    normalized_intent: "create item",
    ...overrides,
  };
}

function postSpec(options: {
  server?: string;
  dryRun?: boolean;
  idempotency?: boolean;
  safeDeclaration?: boolean;
} = {}) {
  const properties: Record<string, any> = {
    name: { type: "string", enum: ["alpha", "beta"] },
  };
  if (options.dryRun) {
    properties.dry_run = {
      type: "boolean",
      description: "When true, validate and simulate the request without creating or persisting an item.",
    };
  }

  const parameters: any[] = [];
  if (options.idempotency) {
    parameters.push({
      name: "Idempotency-Key",
      in: "header",
      required: true,
      schema: { type: "string" },
      description: "Prevents duplicate creation for the same key.",
    });
  }

  return {
    openapi: "3.0.3",
    servers: [{ url: options.server ?? "https://items.example/api" }],
    paths: {
      "/items": {
        post: {
          operationId: "createItem",
          summary: "Create item",
          ...(options.safeDeclaration ? { "x-missing-safe-verification": "dry_run" } : {}),
          parameters,
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["name"],
                  properties,
                },
              },
            },
          },
          responses: {
            "201": {
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    required: ["id"],
                    properties: { id: { type: "string" }, simulated: { type: "boolean" } },
                  },
                },
              },
            },
          },
        },
      },
    },
  };
}

const fetchSpec = (spec: unknown) => async () => new Response(JSON.stringify(spec), { status: 200, headers: { "content-type": "application/json" } });

afterEach(() => resetDemand());

describe("Product Lambda.2 safe POST verification policy", () => {
  it("accepts an explicit sandbox server as side-effect containment evidence", () => {
    const assessment = assessSafePostVerification({
      base_url: "https://sandbox.items.example/api",
      operation: {},
      parameters: [],
    });
    expect(assessment.status).toBe("safe_for_replay");
    expect(assessment.signals.some(signal => signal.kind === "sandbox_server" && signal.sufficient)).toBe(true);
  });

  it("treats idempotency as supportive but not sufficient safety evidence", () => {
    const assessment = assessSafePostVerification({
      base_url: "https://items.example/api",
      operation: {},
      parameters: [{
        name: "Idempotency-Key",
        input_name: null,
        location: "header",
        required: true,
        schema: { type: "string" },
        description: "Prevents duplicates",
      }],
    });
    expect(assessment.status).toBe("needs_safe_verification");
    expect(assessment.generated_headers).toEqual(["Idempotency-Key"]);
    expect(assessment.signals).toEqual(expect.arrayContaining([expect.objectContaining({ kind: "idempotency_key", sufficient: false })]));
  });

  it("compiles a documented dry_run POST as ready for dedicated safe replay and forces dry_run=true", async () => {
    const result = await compileOpenApiLead(lead(), { fetchFn: fetchSpec(postSpec({ dryRun: true })) });

    expect(result.status).toBe("candidate_ready_for_safe_post_replay");
    expect(result.safe_post_verification?.status).toBe("safe_for_replay");
    expect(result.safe_post_verification?.input_overrides).toEqual({ dry_run: true });
    expect(result.candidate?.body_bindings).toEqual({ name: "$input.name", dry_run: "$input.dry_run" });
    expect(result.candidate?.verification_inputs).toEqual([
      { name: "alpha", dry_run: true },
      { name: "beta", dry_run: true },
    ]);
    expect(result.missing).toEqual([]);
  });

  it("allows a provider-declared safe verification mode without weakening normal POSTs", async () => {
    const safe = await compileOpenApiLead(lead(), { fetchFn: fetchSpec(postSpec({ safeDeclaration: true })) });
    const normal = await compileOpenApiLead(lead(), { fetchFn: fetchSpec(postSpec()) });

    expect(safe.status).toBe("candidate_ready_for_safe_post_replay");
    expect(safe.safe_post_verification?.signals.some(signal => signal.kind === "provider_safe_declaration")).toBe(true);
    expect(normal.status).toBe("needs_safe_verification");
  });

  it("does not mistake a required idempotency header for a credential or safe mutation guarantee", async () => {
    const result = await compileOpenApiLead(lead(), { fetchFn: fetchSpec(postSpec({ idempotency: true })) });

    expect(result.status).toBe("needs_safe_verification");
    expect(result.provider_readiness.credentials_required).toEqual([]);
    expect(result.safe_post_verification?.signals.some(signal => signal.kind === "idempotency_key")).toBe(true);
  });

  it("surfaces safe replay readiness without invoking standard acquisition", async () => {
    recordDemand("Create item", null, "a2a");
    const l = lead();
    let acquisitionCalls = 0;
    const candidate: SupplyCandidate = {
      candidate_id: "lambda2_safe_candidate",
      demand_intent: l.demand_intent,
      capability: "create_item",
      family: "items",
      provider: l.provider,
      evidence_url: l.spec_url,
      method: "POST",
      base_url: "https://sandbox.items.example",
      path_template: "/items",
      path_bindings: {},
      query_bindings: {},
      body_bindings: { name: "$input.name" },
      projection: { id: { op: "FIELD", path: "id" } },
      required: ["id"],
      verification_inputs: [{ name: "alpha" }, { name: "beta" }],
    };
    const compiled: OpenApiCompileResult = {
      status: "candidate_ready_for_safe_post_replay",
      lead: l,
      operation: { method: "POST", path: "/items", operation_id: "createItem", summary: "Create item", score: 1, matched_terms: ["create", "item"] },
      candidate,
      verification_input_evidence: [],
      provider_readiness: { credentials_required: [], response_schema_missing: false },
      safe_post_verification: {
        status: "safe_for_replay",
        signals: [{ kind: "sandbox_server", sufficient: true, source: "server_url", detail: "sandbox" }],
        input_overrides: {},
        generated_headers: [],
        reason: "sandbox",
      },
      missing: [],
      reason: "ready for dedicated safe replay",
    };

    const result = await runThetaOrchestrator({
      discoverFn: async () => [l],
      compileFn: async () => compiled,
      acquireFn: async () => {
        acquisitionCalls += 1;
        throw new Error("standard acquisition must not run for POST");
      },
    });

    expect(result.status).toBe("candidate_ready_for_safe_post_replay");
    expect(result.selected_provider).toBe(l.provider);
    expect(acquisitionCalls).toBe(0);
  });
});
