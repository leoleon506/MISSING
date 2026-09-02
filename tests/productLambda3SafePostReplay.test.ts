import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { SupplyCandidate } from "../src/runtime/acquisition.js";
import { resetDemand, recordDemand } from "../src/runtime/discovery.js";
import { resetRuntimeHealth, resolveCapability } from "../src/runtime/executor.js";
import type { OpenApiCompileResult } from "../src/runtime/openApiCompiler.js";
import { runThetaOrchestrator } from "../src/runtime/orchestrator.js";
import type { ProviderDiscoveryCandidate } from "../src/runtime/providerDiscovery.js";
import { reloadPromotedRecipesFromLedger, resetPromotedRecipesForTest } from "../src/runtime/recipes.js";
import type { SafePostVerificationAssessment } from "../src/runtime/safePostPolicy.js";
import { acquireSafePostCandidate, verifySafePostCandidate } from "../src/runtime/safePostReplay.js";
import { configureSupplyLedger, readPromotedRecipes } from "../src/runtime/supplyLedger.js";
import { runTrustedWorkerCycle } from "../src/worker/acquisitionWorker.js";

const servers: Server[] = [];
const tempDirs: string[] = [];
const originalSafeReplay = process.env.MISSING_SAFE_POST_REPLAY_ENABLED;

type Handler = (req: IncomingMessage, res: ServerResponse) => void | Promise<void>;

async function localServer(handler: Handler) {
  const server = createServer((req, res) => {
    void Promise.resolve(handler(req, res)).catch(error => {
      res.statusCode = 500;
      res.end(error instanceof Error ? error.message : String(error));
    });
  });
  servers.push(server);
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("test server did not bind");
  return `http://127.0.0.1:${address.port}`;
}

function candidate(baseUrl: string, overrides: Partial<SupplyCandidate> = {}): SupplyCandidate {
  return {
    candidate_id: "lambda3_safe_post",
    demand_intent: "Validate item",
    capability: "lambda3_validate_item",
    family: "test",
    provider: "Lambda3 Test Provider",
    evidence_url: `${baseUrl}/openapi.json`,
    method: "POST",
    base_url: baseUrl,
    path_template: "/items",
    path_bindings: {},
    query_bindings: {},
    body_bindings: { name: "$input.name", dry_run: "$input.dry_run" },
    projection: { id: { op: "FIELD", path: "id" }, simulated: { op: "FIELD", path: "simulated" } },
    required: ["id", "simulated"],
    verification_inputs: [
      { name: "alpha", dry_run: true },
      { name: "beta", dry_run: true },
    ],
    ...overrides,
  };
}

function assessment(overrides: Partial<SafePostVerificationAssessment> = {}): SafePostVerificationAssessment {
  return {
    status: "safe_for_replay",
    signals: [
      {
        kind: "dry_run_control",
        sufficient: true,
        source: "body:dry_run",
        detail: "dry_run is documented as non-mutating",
        location: "body",
        name: "dry_run",
        input_name: "dry_run",
        safe_value: true,
      },
      {
        kind: "idempotency_key",
        sufficient: false,
        source: "header:Idempotency-Key",
        detail: "provider supports request idempotency",
        location: "header",
        name: "Idempotency-Key",
      },
    ],
    input_overrides: { dry_run: true },
    generated_headers: ["Idempotency-Key"],
    reason: "dry-run containment",
    ...overrides,
  };
}

function lead(): ProviderDiscoveryCandidate {
  return {
    source: "apis_guru",
    directory_id: "lambda3:test",
    provider: "Lambda3 Test Provider",
    title: "Lambda3 Test Provider",
    description: "Validate items safely",
    spec_url: "https://specs.example/lambda3.json",
    directory_url: null,
    openapi_version: "3.0.3",
    score: 1,
    matched_terms: ["validate", "item"],
    demand_intent: "Validate item",
    normalized_intent: "validate item",
  };
}

afterEach(async () => {
  if (originalSafeReplay === undefined) delete process.env.MISSING_SAFE_POST_REPLAY_ENABLED;
  else process.env.MISSING_SAFE_POST_REPLAY_ENABLED = originalSafeReplay;
  configureSupplyLedger(undefined);
  resetPromotedRecipesForTest();
  resetRuntimeHealth();
  resetDemand();
  for (const server of servers.splice(0)) await new Promise<void>(resolve => server.close(() => resolve()));
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("Product Lambda.3 dedicated safe POST replay", () => {
  it("executes exactly two dry-run replays, rotates idempotency keys, promotes and preserves containment after reload", async () => {
    const observedBodies: Array<Record<string, unknown>> = [];
    const observedKeys: string[] = [];
    const baseUrl = await localServer(async (req, res) => {
      if (req.url === "/openapi.json") {
        res.writeHead(200, { "content-type": "application/json" });
        res.end("{}");
        return;
      }
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(Buffer.from(chunk));
      const body = JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>;
      observedBodies.push(body);
      observedKeys.push(String(req.headers["idempotency-key"] ?? ""));
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ id: `sim-${body.name}`, simulated: true }));
    });

    const dir = mkdtempSync(join(tmpdir(), "missing-lambda3-"));
    tempDirs.push(dir);
    configureSupplyLedger(join(dir, "supply.jsonl"));
    process.env.MISSING_SAFE_POST_REPLAY_ENABLED = "1";

    const acquired = await acquireSafePostCandidate(candidate(baseUrl), assessment());
    expect(acquired.status).toBe("promoted");
    expect(acquired.verification.status).toBe("verified");
    expect(observedBodies).toEqual([
      { name: "alpha", dry_run: true },
      { name: "beta", dry_run: true },
    ]);
    expect(observedKeys).toHaveLength(2);
    expect(observedKeys[0]).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    expect(observedKeys[1]).toMatch(/^[0-9a-f-]{36}$/i);
    expect(observedKeys[0]).not.toBe(observedKeys[1]);

    const promoted = acquired.verification.recipe!;
    expect(promoted.generated_headers).toEqual([{ location: "header", name: "Idempotency-Key", generator: "uuid_v4" }]);
    expect(promoted.forced_inputs).toEqual({ dry_run: true });
    expect(promoted.verification.source).toBe("product_live");
    if (promoted.verification.source !== "product_live") throw new Error("unexpected verification source");
    expect(promoted.verification.safe_post?.policy).toBe("lambda2");
    expect(JSON.stringify(promoted)).not.toContain(observedKeys[0]);
    expect(JSON.stringify(promoted)).not.toContain(observedKeys[1]);
    expect(readPromotedRecipes()).toHaveLength(1);

    resetPromotedRecipesForTest();
    reloadPromotedRecipesFromLedger();
    // A caller cannot disable the containment mode after promotion.
    const resolved = await resolveCapability("lambda3_validate_item", { name: "runtime", dry_run: false });
    expect(resolved.status).toBe("resolved");
    expect(observedBodies).toHaveLength(3);
    expect(observedBodies[2]).toEqual({ name: "runtime", dry_run: true });
    expect(observedKeys[2]).toBeTruthy();
    expect(observedKeys[2]).not.toBe(observedKeys[0]);
    expect(observedKeys[2]).not.toBe(observedKeys[1]);
  });

  it("fails before network when safety evidence is inconsistent with the candidate", async () => {
    let requests = 0;
    const baseUrl = await localServer((_req, res) => {
      requests += 1;
      res.writeHead(200, { "content-type": "application/json" });
      res.end('{"id":"unexpected","simulated":true}');
    });
    const unsafe = candidate(baseUrl, {
      verification_inputs: [{ name: "alpha", dry_run: false }, { name: "beta", dry_run: true }],
    });

    await expect(verifySafePostCandidate(unsafe, assessment())).rejects.toThrow(/does not force dry_run=true/i);
    expect(requests).toBe(0);
  });

  it("refuses a normal production POST that did not pass Lambda.2", async () => {
    let requests = 0;
    const baseUrl = await localServer((_req, res) => {
      requests += 1;
      res.writeHead(200, { "content-type": "application/json" });
      res.end('{"id":"unexpected","simulated":true}');
    });

    await expect(verifySafePostCandidate(candidate(baseUrl), assessment({
      status: "needs_safe_verification",
      signals: [],
      input_overrides: {},
      generated_headers: [],
    }))).rejects.toThrow(/has not passed Lambda.2/i);
    expect(requests).toBe(0);
  });

  it("does not execute a provider-declaration-only POST without enforceable containment", async () => {
    let requests = 0;
    const baseUrl = await localServer((_req, res) => {
      requests += 1;
      res.writeHead(200, { "content-type": "application/json" });
      res.end('{"id":"unexpected","simulated":true}');
    });
    const declarationOnly = assessment({
      signals: [{ kind: "provider_safe_declaration", sufficient: true, source: "x-safe-to-test", detail: "provider declaration" }],
      input_overrides: {},
      generated_headers: [],
    });

    await expect(verifySafePostCandidate(candidate(baseUrl), declarationOnly)).rejects.toThrow(/provider declaration alone is not sufficient/i);
    expect(requests).toBe(0);
  });

  it("lets the trusted orchestrator promote a Lambda.2-ready POST only through the dedicated verifier", async () => {
    process.env.MISSING_SAFE_POST_REPLAY_ENABLED = "1";
    recordDemand("Validate item", null, "a2a");
    const l = lead();
    const c = candidate("https://sandbox.items.example");
    const a = assessment({
      signals: [{ kind: "sandbox_server", sufficient: true, source: "server_url", detail: "sandbox" }],
      input_overrides: {},
      generated_headers: [],
    });
    const compiled: OpenApiCompileResult = {
      status: "candidate_ready_for_safe_post_replay",
      lead: l,
      operation: { method: "POST", path: "/items", operation_id: "validateItem", summary: "Validate item", score: 1, matched_terms: ["validate", "item"] },
      candidate: c,
      verification_input_evidence: [],
      provider_readiness: { credentials_required: [], response_schema_missing: false },
      safe_post_verification: a,
      missing: [],
      reason: "ready",
    };
    let standardCalls = 0;
    let safeCalls = 0;

    const result = await runThetaOrchestrator({
      discoverFn: async () => [l],
      compileFn: async () => compiled,
      acquireFn: async () => {
        standardCalls += 1;
        throw new Error("standard acquisition must not run");
      },
      safePostAcquireFn: async () => {
        safeCalls += 1;
        return {
          status: "promoted" as const,
          verification: {
            candidate_id: c.candidate_id,
            status: "verified" as const,
            recipe_fingerprint: "lambda3-safe-fingerprint",
            capability: c.capability,
            provider: c.provider,
            verified_at: "2026-09-02T00:00:00.000Z",
            runs: [],
            reason: null,
            recipe: null,
          },
          promotion: { promoted: true, reason: null, recipe: null },
        };
      },
    });

    expect(result.status).toBe("promoted");
    expect(result.recipe_fingerprint).toBe("lambda3-safe-fingerprint");
    expect(safeCalls).toBe(1);
    expect(standardCalls).toBe(0);
    expect(result.trace.some(step => step.status === "safe_post_promoted")).toBe(true);
  });

  it("keeps Lambda.2 ready state inert when Lambda.3 is disabled", async () => {
    delete process.env.MISSING_SAFE_POST_REPLAY_ENABLED;
    recordDemand("Validate item", null, "a2a");
    const l = lead();
    const compiled: OpenApiCompileResult = {
      status: "candidate_ready_for_safe_post_replay",
      lead: l,
      operation: { method: "POST", path: "/items", operation_id: "validateItem", summary: "Validate item", score: 1, matched_terms: ["validate", "item"] },
      candidate: candidate("https://sandbox.items.example"),
      verification_input_evidence: [],
      provider_readiness: { credentials_required: [], response_schema_missing: false },
      safe_post_verification: assessment({ signals: [{ kind: "sandbox_server", sufficient: true, source: "server_url", detail: "sandbox" }], input_overrides: {}, generated_headers: [] }),
      missing: [],
      reason: "ready",
    };
    let safeCalls = 0;
    const result = await runThetaOrchestrator({
      discoverFn: async () => [l],
      compileFn: async () => compiled,
      safePostAcquireFn: async () => {
        safeCalls += 1;
        throw new Error("must stay inert");
      },
    });
    expect(result.status).toBe("candidate_ready_for_safe_post_replay");
    expect(safeCalls).toBe(0);
  });

  it("accepts Lambda POST terminal states in the trusted worker client", async () => {
    const token = "x".repeat(32);
    for (const status of ["needs_safe_verification", "candidate_ready_for_safe_post_replay"] as const) {
      const result = await runTrustedWorkerCycle({
        runtimeUrl: "https://missing.example",
        token,
        fetchFn: async () => new Response(JSON.stringify({ status }), { status: 200, headers: { "content-type": "application/json" } }),
      });
      expect(result.status).toBe(status);
    }
  });
});
