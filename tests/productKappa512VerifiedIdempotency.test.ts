import { afterEach, describe, expect, it } from "vitest";
import { providerRecoveryPolicy } from "../src/runtime/recoveryPolicy.js";
import {
  configureX402Fetch,
  settleX402Payment,
  x402FacilitatorIdempotencyEnabled,
  type X402Requirements,
} from "../src/runtime/x402.js";
import type { VerifiedRecipe } from "../src/runtime/types.js";

function recipe(extra: Partial<VerifiedRecipe> = {}): VerifiedRecipe {
  return {
    capability: "kappa512_test",
    family: "kappa512",
    provider: "test",
    provider_candidate_id: "test",
    recipe_fingerprint: "kappa512-fp",
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
      verification_inputs: [{ value: "verified" }],
      verified_at: "2026-09-02",
      evidence_url: "https://example.test/evidence",
    },
    ...extra,
  };
}

const requirements: X402Requirements = {
  scheme: "exact",
  network: "eip155:84532",
  amount: "5000",
  asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
  payTo: "0x209693Bc6afc0C5328bA36FaF03C514EF312287C",
  maxTimeoutSeconds: 60,
  extra: { name: "USDC", version: "2" },
};

afterEach(() => {
  delete process.env.MISSING_X402_FACILITATOR_IDEMPOTENCY;
  delete process.env.MISSING_X402_FACILITATOR_URL;
  configureX402Fetch();
});

describe("Product Kappa.5.12 verified idempotency contracts", () => {
  it("does not treat an idempotency-shaped generated header as replay evidence", () => {
    const generatedOnly = recipe({
      generated_headers: [{ location: "header", name: "Idempotency-Key", generator: "uuid_v4" }],
    });
    expect(providerRecoveryPolicy(generatedOnly)).toMatchObject({
      mode: "ambiguous",
      idempotency_header: null,
    });
  });

  it("accepts only sufficient product_live safe_post idempotency evidence", () => {
    const verified = recipe({
      verification: {
        status: "replay_verified",
        source: "product_live",
        verification_inputs: [{ value: "verified" }],
        verified_at: "2026-09-02",
        evidence_url: "https://example.test/evidence",
        safe_post: {
          policy: "lambda2",
          signals: [{
            kind: "idempotency_key",
            sufficient: true,
            source: "provider-contract",
            detail: "same key deduplicates the external write",
            location: "header",
            name: "Idempotency-Key",
          }],
          input_overrides: {},
          generated_headers: ["Idempotency-Key"],
        },
      },
    });
    expect(providerRecoveryPolicy(verified)).toMatchObject({
      mode: "idempotent",
      idempotency_header: "Idempotency-Key",
    });
  });

  it("fails closed before facilitator settlement when the idempotency contract is disabled", async () => {
    process.env.MISSING_X402_FACILITATOR_URL = "https://facilitator.test";
    let calls = 0;
    configureX402Fetch((async () => {
      calls += 1;
      return new Response(JSON.stringify({ success: true, transaction: "0x1" }), { status: 200 });
    }) as typeof fetch);

    expect(x402FacilitatorIdempotencyEnabled()).toBe(false);
    await expect(settleX402Payment({
      paymentPayload: { payment: "p" },
      requirements,
      settlementIntentId: "intent-1",
    })).rejects.toThrow("idempotency contract is not enabled");
    expect(calls).toBe(0);
  });

  it("replays a durable settlement intent only when the facilitator contract is explicitly enabled", async () => {
    process.env.MISSING_X402_FACILITATOR_URL = "https://facilitator.test";
    process.env.MISSING_X402_FACILITATOR_IDEMPOTENCY = "1";
    const keys: string[] = [];
    configureX402Fetch((async (_input: string | URL | Request, init?: RequestInit) => {
      keys.push(new Headers(init?.headers).get("idempotency-key") ?? "");
      return new Response(JSON.stringify({ success: true, transaction: "0xsame", network: requirements.network }), { status: 200 });
    }) as typeof fetch);

    const first = await settleX402Payment({ paymentPayload: { payment: "p" }, requirements, settlementIntentId: "intent-1" });
    const second = await settleX402Payment({ paymentPayload: { payment: "p" }, requirements, settlementIntentId: "intent-1" });

    expect(x402FacilitatorIdempotencyEnabled()).toBe(true);
    expect(keys).toEqual(["intent-1", "intent-1"]);
    expect(first.transaction).toBe("0xsame");
    expect(second.transaction).toBe(first.transaction);
  });
});
