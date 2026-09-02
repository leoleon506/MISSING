import { closeDistributedMoney } from "./runtime/distributedMoney.js";
import { configureAgentPaymentCrashHookForTest, handleAgentPaidResolution } from "./runtime/agentPayments.js";
import { VERIFIED_RECIPES } from "./runtime/recipes.js";
import type { VerifiedRecipe } from "./runtime/types.js";

const [capability, paymentSignature, providerBaseUrl, crash = "0"] = process.argv.slice(2);
if (!capability || !paymentSignature || !providerBaseUrl) {
  throw new Error("usage: experimentKappa513Worker <capability> <paymentSignature> <providerBaseUrl> [crash]");
}

const fingerprint = `kappa513-owned-known-tx-${capability}`;
const recipe: VerifiedRecipe = {
  capability,
  family: "kappa513",
  provider: "Kappa513 owned known-tx provider",
  provider_candidate_id: "kappa513-owned-known-tx",
  recipe_fingerprint: fingerprint,
  method: "POST",
  base_url: providerBaseUrl,
  path_template: "/write",
  path_bindings: {},
  query_bindings: {},
  body_bindings: { scenario: "$input.scenario" },
  projection: { ok: { op: "FIELD", path: "ok" }, scenario: { op: "FIELD", path: "scenario" } },
  required: ["ok", "scenario"],
  example_input: { scenario: "example" },
  verification: {
    status: "replay_verified",
    source: "product_live",
    verification_inputs: [{ scenario: "verified" }],
    verified_at: "2026-09-02",
    evidence_url: "https://example.invalid/kappa513",
    safe_post: {
      policy: "lambda2",
      signals: [{
        kind: "idempotency_key",
        sufficient: true,
        source: "kappa513-production-proof",
        detail: "local provider deduplicates writes by the verified idempotency header",
        location: "header",
        name: "Idempotency-Key",
      }],
      input_overrides: {},
      generated_headers: ["Idempotency-Key"],
    },
  },
};
VERIFIED_RECIPES.push(recipe);

process.env.MISSING_ECONOMICS_JSON = JSON.stringify({
  recipes: {
    [fingerprint]: { provider_cost_microusd: 1000, customer_price_microusd: 5000 },
  },
});
process.env.MISSING_ECONOMICS_ENFORCEMENT_ENABLED = "1";
process.env.MISSING_MIN_MARGIN_MICROUSD = "0";

if (crash === "1") {
  configureAgentPaymentCrashHookForTest(point => {
    if (point === "after_settlement_transaction_persisted") process.exit(94);
  });
}

const result = await handleAgentPaidResolution({
  request: { capability, input: { scenario: capability } },
  paymentSignature,
  resourceUrl: `https://missing.test/agent/resolve/${capability}`,
});
console.log(JSON.stringify(result));
configureAgentPaymentCrashHookForTest();
closeDistributedMoney();
