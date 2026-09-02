import { describe, expect, it } from "vitest";
import { providerRecoveryPolicy, stableProviderIdempotencyKey, stableSettlementIntentId } from "../src/runtime/recoveryPolicy.js";
import type { VerifiedRecipe } from "../src/runtime/types.js";

function recipe(method: "GET" | "POST", extra: Partial<VerifiedRecipe> = {}): VerifiedRecipe {
  return {
    capability: "test", family: "test", provider: "test", provider_candidate_id: "test", recipe_fingerprint: "fp",
    method, base_url: "https://example.test", path_template: "/", path_bindings: {}, query_bindings: {}, projection: {}, required: [], example_input: {},
    verification: { status: "replay_verified", source: "product_live", verification_inputs: [{}], verified_at: "2026-09-02", evidence_url: "https://example.test" },
    ...extra,
  };
}

describe("Product Kappa.5.8 ambiguous outcome recovery policy", () => {
  it("classifies GET as replayable read-only", () => {
    expect(providerRecoveryPolicy(recipe("GET"))).toMatchObject({ mode: "read_only", idempotency_header: null });
  });

  it("classifies verified POST idempotency evidence as recoverable", () => {
    const r = recipe("POST", {
      verification: {
        status: "replay_verified", source: "product_live", verification_inputs: [{}], verified_at: "2026-09-02", evidence_url: "https://example.test",
        safe_post: { policy: "lambda2", signals: [{ kind: "idempotency_key", sufficient: true, source: "docs", detail: "deduplicates writes", location: "header", name: "Idempotency-Key" }], input_overrides: {}, generated_headers: ["Idempotency-Key"] },
      },
    });
    expect(providerRecoveryPolicy(r)).toMatchObject({ mode: "idempotent", idempotency_header: "Idempotency-Key" });
  });

  it("quarantines POST without a verified recovery contract", () => {
    expect(providerRecoveryPolicy(recipe("POST"))).toMatchObject({ mode: "ambiguous", idempotency_header: null });
  });

  it("derives stable provider and settlement identities", () => {
    expect(stableProviderIdempotencyKey("payment", "recipe")).toBe(stableProviderIdempotencyKey("payment", "recipe"));
    expect(stableProviderIdempotencyKey("payment", "recipe")).not.toBe(stableProviderIdempotencyKey("payment2", "recipe"));
    expect(stableSettlementIntentId("payment", "request")).toBe(stableSettlementIntentId("payment", "request"));
  });
});
