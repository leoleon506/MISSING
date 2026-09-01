import { createServer, type Server } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { attemptRecipe, renderRecipeRequest } from "../src/runtime/executor.js";
import { compileOpenApiLead } from "../src/runtime/openApiCompiler.js";
import { appendPromotedRecipe, configureSupplyLedger, readPromotedRecipes } from "../src/runtime/supplyLedger.js";
import type { VerifiedRecipe } from "../src/runtime/types.js";

const tempDirs: string[] = [];
const servers: Server[] = [];
const credentialEnv = "MISSING_CREDENTIAL_TEST_PROVIDER_API_KEY";

function recipe(overrides: Partial<VerifiedRecipe> = {}): VerifiedRecipe {
  return {
    capability: "lambda_echo",
    family: "test",
    provider: "Lambda Test Provider",
    provider_candidate_id: "lambda_test_provider",
    recipe_fingerprint: "lambda-test-fingerprint",
    method: "POST",
    base_url: "https://example.invalid",
    path_template: "/echo",
    path_bindings: {},
    query_bindings: {},
    body_bindings: { message: "$input.message" },
    projection: { echoed: { op: "FIELD", path: "echoed" } },
    required: ["echoed"],
    example_input: { message: "hello" },
    verification: {
      status: "replay_verified",
      source: "product_live",
      verification_inputs: [{ message: "hello" }, { message: "world" }],
      verified_at: "2026-09-01T00:00:00.000Z",
      evidence_url: "https://example.invalid/openapi.json",
    },
    ...overrides,
  };
}

async function localServer(handler: Parameters<typeof createServer>[0]) {
  const server = createServer(handler);
  servers.push(server);
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("test server did not bind a TCP port");
  return `http://127.0.0.1:${address.port}`;
}

afterEach(async () => {
  delete process.env[credentialEnv];
  configureSupplyLedger(undefined);
  for (const server of servers.splice(0)) await new Promise<void>(resolve => server.close(() => resolve()));
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("Product Lambda HTTP capability core", () => {
  it("executes a replay-verified POST recipe with JSON body and runtime credential", async () => {
    let observedMethod = "";
    let observedAuthorization = "";
    let observedBody = "";
    const base = await localServer(async (req, res) => {
      observedMethod = req.method ?? "";
      observedAuthorization = String(req.headers.authorization ?? "");
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(Buffer.from(chunk));
      observedBody = Buffer.concat(chunks).toString("utf8");
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ echoed: JSON.parse(observedBody).message }));
    });

    process.env[credentialEnv] = "super-secret-test-value";
    const verified = recipe({
      base_url: base,
      static_headers: { "x-client-version": "lambda" },
      credential_bindings: [{ location: "header", name: "Authorization", credential_key: "test_provider.api_key", prefix: "Bearer " }],
    });

    const result = await attemptRecipe(verified, { message: "hello-post" });
    expect(result.attempt.ok).toBe(true);
    expect(result.output).toEqual({ echoed: "hello-post" });
    expect(observedMethod).toBe("POST");
    expect(observedAuthorization).toBe("Bearer super-secret-test-value");
    expect(JSON.parse(observedBody)).toEqual({ message: "hello-post" });
    expect(JSON.stringify(verified)).not.toContain("super-secret-test-value");
    expect(JSON.stringify(result.attempt)).not.toContain("super-secret-test-value");
  });

  it("fails before network when a referenced credential is unavailable", async () => {
    let requests = 0;
    const base = await localServer((_req, res) => {
      requests += 1;
      res.writeHead(200, { "content-type": "application/json" });
      res.end('{"echoed":"unexpected"}');
    });
    const verified = recipe({
      base_url: base,
      credential_bindings: [{ location: "header", name: "X-API-Key", credential_key: "test_provider.api_key" }],
    });
    const result = await attemptRecipe(verified, { message: "hello" });
    expect(result.attempt.ok).toBe(false);
    expect(result.attempt.error).toBe("Missing runtime credential: test_provider.api_key");
    expect(requests).toBe(0);
  });

  it("rejects sensitive static headers and requires credential references", () => {
    const verified = recipe({ static_headers: { "X-API-Key": "must-not-be-persisted" } });
    expect(() => renderRecipeRequest(verified, { message: "hello" })).toThrow(/must use a credential binding/i);
  });

  it("keeps existing GET recipes body-free", () => {
    const verified = recipe({
      method: "GET",
      body_bindings: undefined,
      path_template: "/items/{id}",
      path_bindings: { id: "$input.id" },
      query_bindings: { q: "$input.query" },
    });
    const rendered = renderRecipeRequest(verified, { id: "a/b", query: "hello world" });
    expect(rendered.url).toContain("/items/a%2Fb");
    expect(rendered.url).toContain("q=hello+world");
    expect(rendered.init.method).toBe("GET");
    expect(rendered.init.body).toBeUndefined();
  });

  it("round-trips a POST recipe through the persistent supply ledger without secrets", () => {
    const dir = mkdtempSync(join(tmpdir(), "missing-lambda-"));
    tempDirs.push(dir);
    configureSupplyLedger(join(dir, "supply.jsonl"));
    const verified = recipe({
      static_headers: { "x-client-version": "lambda" },
      credential_bindings: [{ location: "header", name: "Authorization", credential_key: "test_provider.api_key", prefix: "Bearer " }],
    });
    appendPromotedRecipe(verified, "2026-09-01T00:00:00.000Z");
    expect(readPromotedRecipes()).toEqual([verified]);
  });

  it("keeps autonomous OpenAPI acquisition GET-only for side-effect safety", async () => {
    const lead = {
      directory_id: "lambda-post-only",
      provider: "POST Only Provider",
      spec_url: "https://provider.example/openapi.json",
      demand_intent: "create an item",
      normalized_intent: "create item",
      matched_terms: ["create", "item"],
      score: 1,
      source: "apis_guru" as const,
    };
    const spec = {
      openapi: "3.0.0",
      servers: [{ url: "https://provider.example" }],
      paths: {
        "/items": {
          post: {
            operationId: "createItem",
            responses: { "200": { content: { "application/json": { schema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] } } } } },
          },
        },
      },
    };
    const compiled = await compileOpenApiLead(lead, {
      fetchFn: async () => new Response(JSON.stringify(spec), { status: 200, headers: { "content-type": "application/json" } }),
    });
    expect(compiled.status).toBe("unsupported");
    expect(compiled.missing).toContain("get_operation");
    expect(compiled.candidate).toBeNull();
  });
});
