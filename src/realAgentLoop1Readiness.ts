import { mkdir, writeFile } from "node:fs/promises";
import type { DemandLedgerEvent } from "./runtime/demandLedger.js";
import { evaluateRealAgentPaidClosedLoop, type RealAgentLoopPaymentEvidence } from "./runtime/realAgentLoopEvidence.js";
import type { SupplyLedgerEvent } from "./runtime/supplyLedger.js";
import type { VerifiedRecipe } from "./runtime/types.js";

const ARTIFACT = "artifacts/real-agent-loop-1-readiness.json";
const BASE_RELEASE = "14dbbf0ee8c8dcf7b64d1eae42b79db6d8d80cde";
const FINGERPRINT = "a".repeat(64);

const recipe: VerifiedRecipe = {
  capability: "sample_live_capability",
  family: "sample",
  provider: "sample-provider",
  provider_candidate_id: "ral1-sample",
  recipe_fingerprint: FINGERPRINT,
  method: "GET",
  base_url: "https://provider.example",
  path_template: "/lookup/{value}",
  path_bindings: { value: "$input.value" },
  query_bindings: {},
  projection: { value: { op: "INPUT", name: "value" } },
  required: ["value"],
  example_input: { value: "alpha" },
  verification: {
    status: "replay_verified",
    source: "product_live",
    verification_inputs: [{ value: "alpha" }, { value: "beta" }],
    verified_at: "2026-09-02T10:01:00.000Z",
    evidence_url: "https://provider.example/openapi.json",
  },
};

const demand: DemandLedgerEvent = {
  version: 1,
  observed_at: "2026-09-02T10:00:00.000Z",
  intent: "Look up sample live capability",
  normalized_intent: "look up sample live capability",
  capability: null,
  source: "a2a",
};

const promotion: SupplyLedgerEvent = {
  version: 1,
  promoted_at: "2026-09-02T10:02:00.000Z",
  recipe,
  origin: {
    demand_intent: demand.intent,
    normalized_intent: demand.normalized_intent,
  },
};

function payment(index: number, requestHash: string, margin = 2000): RealAgentLoopPaymentEvidence {
  return {
    payment_hash: String(index).padStart(64, String(index)),
    request_hash: requestHash,
    execution_id: `execution-${index}`,
    capability: recipe.capability,
    state: "settled",
    created_at: `2026-09-02T10:0${2 + index}:00.000Z`,
    updated_at: `2026-09-02T10:0${3 + index}:00.000Z`,
    transaction_reference: `0x${String(index).repeat(64)}`,
    customer_price_microusd: 3000,
    provider_cost_microusd: 1000,
    gross_margin_microusd: margin,
    provider_recipe_fingerprint: FINGERPRINT,
  };
}

async function main() {
  const paid1 = payment(1, "1".repeat(64));
  const paid2 = payment(2, "2".repeat(64));
  const positive = evaluateRealAgentPaidClosedLoop({ demands: [demand], promotions: [promotion], payments: [paid1, paid2] });

  const duplicateInput = evaluateRealAgentPaidClosedLoop({
    demands: [demand], promotions: [promotion], payments: [paid1, { ...paid2, request_hash: paid1.request_hash }],
  });
  const noOrigin = evaluateRealAgentPaidClosedLoop({
    demands: [demand], promotions: [{ ...promotion, origin: undefined }], payments: [paid1, paid2],
  });
  const zeroMargin = evaluateRealAgentPaidClosedLoop({
    demands: [demand], promotions: [promotion], payments: [paid1, { ...paid2, customer_price_microusd: 1000, provider_cost_microusd: 1000, gross_margin_microusd: 0 }],
  });
  const prePromotion = evaluateRealAgentPaidClosedLoop({
    demands: [demand], promotions: [promotion], payments: [{ ...paid1, updated_at: "2026-09-02T10:01:30.000Z" }, paid2],
  });

  const assertions = {
    positive_closed_loop_qualifies: positive.qualified,
    duplicate_input_does_not_qualify: !duplicateInput.qualified,
    unlinked_promotion_does_not_qualify: !noOrigin.qualified,
    nonpositive_margin_does_not_qualify: !zeroMargin.qualified,
    prepromotion_payment_does_not_qualify: !prePromotion.qualified,
    ci_cannot_emit_live_go: true,
  };
  const ready = Object.values(assertions).every(Boolean);
  const evidence = {
    result: ready ? "READY_REAL_AGENT_PAID_CLOSED_LOOP_PROOF" : "NOT_READY_REAL_AGENT_PAID_CLOSED_LOOP_PROOF",
    base_release: BASE_RELEASE,
    proof_boundary: "synthetic_ci_readiness_only",
    live_go_allowed: false,
    live_go_string_reserved: "GO_REAL_AGENT_PAID_CLOSED_LOOP",
    assertions,
    positive_fixture: positive,
  };

  await mkdir("artifacts", { recursive: true });
  await writeFile(ARTIFACT, JSON.stringify(evidence, null, 2) + "\n", "utf8");
  console.log(JSON.stringify(evidence, null, 2));
  if (!ready) process.exitCode = 1;
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
