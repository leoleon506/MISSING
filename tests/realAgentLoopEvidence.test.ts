import { describe, expect, it } from "vitest";
import type { DemandLedgerEvent } from "../src/runtime/demandLedger.js";
import { evaluateRealAgentPaidClosedLoop, type RealAgentLoopPaymentEvidence } from "../src/runtime/realAgentLoopEvidence.js";
import type { SupplyLedgerEvent } from "../src/runtime/supplyLedger.js";
import type { VerifiedRecipe } from "../src/runtime/types.js";

const fingerprint = "f".repeat(64);
const valueNetwork = "eip155:8453";
const recipe: VerifiedRecipe = {
  capability: "paid_loop_test",
  family: "test",
  provider: "provider",
  provider_candidate_id: "candidate",
  recipe_fingerprint: fingerprint,
  method: "GET",
  base_url: "https://provider.example",
  path_template: "/{value}",
  path_bindings: { value: "$input.value" },
  query_bindings: {},
  projection: { value: { op: "INPUT", name: "value" } },
  required: ["value"],
  example_input: { value: "a" },
  verification: {
    status: "replay_verified",
    source: "product_live",
    verification_inputs: [{ value: "a" }, { value: "b" }],
    verified_at: "2026-09-02T10:01:00.000Z",
    evidence_url: "https://provider.example/spec",
  },
};

const demand: DemandLedgerEvent = {
  version: 1,
  observed_at: "2026-09-02T10:00:00.000Z",
  intent: "Need a paid loop test",
  normalized_intent: "need a paid loop test",
  capability: null,
  source: "a2a",
};

const promotion: SupplyLedgerEvent = {
  version: 1,
  promoted_at: "2026-09-02T10:02:00.000Z",
  recipe,
  origin: { demand_intent: demand.intent, normalized_intent: demand.normalized_intent },
};

function paid(index: number, requestHash = String(index).repeat(64)): RealAgentLoopPaymentEvidence {
  return {
    payment_hash: `payment-${index}`,
    request_hash: requestHash,
    execution_id: `execution-${index}`,
    capability: recipe.capability,
    state: "settled",
    created_at: `2026-09-02T10:0${2 + index}:00.000Z`,
    updated_at: `2026-09-02T10:0${3 + index}:00.000Z`,
    transaction_reference: `tx-${index}`,
    network: valueNetwork,
    customer_price_microusd: 3000,
    provider_cost_microusd: 1000,
    gross_margin_microusd: 2000,
    provider_recipe_fingerprint: fingerprint,
  };
}

const base = { demands: [demand], promotions: [promotion], valueNetworks: [valueNetwork] };

describe("Real Agent Loop paid closed-loop evidence", () => {
  it("qualifies one externally demanded promotion reused by two distinct profitable mainnet payments", () => {
    const result = evaluateRealAgentPaidClosedLoop({ ...base, payments: [paid(1), paid(2)] });
    expect(result.qualified).toBe(true);
    expect(Object.values(result.assertions).every(Boolean)).toBe(true);
    expect(result.evidence.paid_resolutions).toHaveLength(2);
  });

  it("rejects two payments that replay the same bound request", () => {
    const first = paid(1);
    const result = evaluateRealAgentPaidClosedLoop({ ...base, payments: [first, paid(2, first.request_hash!)] });
    expect(result.qualified).toBe(false);
    expect(result.assertions.distinct_request_hashes).toBe(false);
  });

  it("rejects a promotion without durable demand origin", () => {
    const result = evaluateRealAgentPaidClosedLoop({
      demands: [demand], promotions: [{ ...promotion, origin: undefined }], payments: [paid(1), paid(2)], valueNetworks: [valueNetwork],
    });
    expect(result.qualified).toBe(false);
  });

  it("rejects nonpositive realized margin", () => {
    const second = { ...paid(2), customer_price_microusd: 1000, provider_cost_microusd: 1000, gross_margin_microusd: 0 };
    const result = evaluateRealAgentPaidClosedLoop({ ...base, payments: [paid(1), second] });
    expect(result.qualified).toBe(false);
    expect(result.assertions.positive_margin_each_resolution).toBe(false);
  });

  it("rejects payments that happened before the promotion", () => {
    const first = { ...paid(1), updated_at: "2026-09-02T10:01:30.000Z" };
    const result = evaluateRealAgentPaidClosedLoop({ ...base, payments: [first, paid(2)] });
    expect(result.qualified).toBe(false);
    expect(result.assertions.two_settled_paid_resolutions_after_promotion).toBe(false);
  });

  it("rejects settled testnet payments from the commercial proof", () => {
    const result = evaluateRealAgentPaidClosedLoop({
      ...base,
      payments: [{ ...paid(1), network: "eip155:84532" }, { ...paid(2), network: "eip155:84532" }],
    });
    expect(result.qualified).toBe(false);
    expect(result.assertions.value_bearing_network_each_resolution).toBe(false);
  });
});
