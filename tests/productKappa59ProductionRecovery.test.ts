import { afterEach, describe, expect, it, vi } from "vitest";
import { attemptRecipe, renderRecipeRequest } from "../src/runtime/executor.js";
import { providerRecoveryPolicy, stableProviderIdempotencyKey, stableSettlementIntentId } from "../src/runtime/recoveryPolicy.js";
import type { VerifiedRecipe } from "../src/runtime/types.js";

const recipe: VerifiedRecipe = {
  capability: "kappa59_test",
  family: "kappa59",
  provider: "test-provider",
  provider_candidate_id: "k59-test",
  recipe_fingerprint: "k59-test-fingerprint",
  method: "POST",
  base_url: "https://provider.test",
  path_template: "/write",
  path_bindings: {},
  query_bindings: {},
  body_bindings: { value: "$input.value" },
  projection: { ok: { op: "FIELD", path: "ok" } },
  required: ["ok"],
  example_input: { value: "x" },
  verification: {
    status: "replay_verified",
    source: "product_live",
    verification_inputs: [{ value: "x" }],
    verified_at: "2026-09-02",
    evidence_url: "https://example.invalid/k59",
    safe_post: {
      policy: "lambda2",
      signals: [{ kind: "idempotency_key", sufficient: true, source: "test", detail: "deduplicated", location: "header", name: "Idempotency-Key" }],
      input_overrides: {},
      generated_headers: ["Idempotency-Key"],
    },
  },
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Product Kappa.5.9 production recovery primitives", () => {
  it("injects the exact durable idempotency key into a provider request", () => {
    const key = stableProviderIdempotencyKey("payment-a", recipe.recipe_fingerprint);
    const rendered = renderRecipeRequest(recipe, { value: "hello" }, { headerOverrides: { "Idempotency-Key": key } });
    const headers = new Headers(rendered.init.headers);
    expect(headers.get("idempotency-key")).toBe(key);
    expect(rendered.init.method).toBe("POST");
  });

  it("uses a caller-supplied durable key instead of regenerating a write identity", async () => {
    const key = stableProviderIdempotencyKey("payment-b", recipe.recipe_fingerprint);
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      expect(new Headers(init?.headers).get("idempotency-key")).toBe(key);
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "content-type": "application/json" } });
    });
    vi.stubGlobal("fetch", fetchMock);
    const result = await attemptRecipe(recipe, { value: "hello" }, 1000, { headerOverrides: { "Idempotency-Key": key } });
    expect(result.output).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("keeps provider and settlement recovery identities deterministic", () => {
    expect(providerRecoveryPolicy(recipe)).toMatchObject({ mode: "idempotent", idempotency_header: "Idempotency-Key" });
    expect(stableProviderIdempotencyKey("payment-c", recipe.recipe_fingerprint)).toBe(stableProviderIdempotencyKey("payment-c", recipe.recipe_fingerprint));
    expect(stableSettlementIntentId("payment-c", "request-c")).toBe(stableSettlementIntentId("payment-c", "request-c"));
    expect(stableSettlementIntentId("payment-c", "request-c")).not.toBe(stableSettlementIntentId("payment-c", "request-d"));
  });
});
