import { closeDistributedMoney } from "./runtime/distributedMoney.js";
import { configureAgentPaymentCrashHookForTest, handleAgentPaidResolution } from "./runtime/agentPayments.js";
import { VERIFIED_RECIPES } from "./runtime/recipes.js";
import type { VerifiedRecipe } from "./runtime/types.js";

const [capability, paymentSignature, providerBaseUrl, crashAfterProvider = "0"] = process.argv.slice(2);
if (!capability || !paymentSignature || !providerBaseUrl) {
  throw new Error("usage: experimentKappa511Worker <capability> <paymentSignature> <providerBaseUrl> [crashAfterProvider]");
}

const fingerprint = `kappa511-${capability}`;
const recipe: VerifiedRecipe = {
  capability,
  family: "kappa511",
  provider: "Kappa511 heartbeat provider",
  provider_candidate_id: "kappa511-heartbeat",
  recipe_fingerprint: fingerprint,
  method: "POST",
  base_url: providerBaseUrl,
  path_template: "/idempotent",
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
    evidence_url: "https://example.invalid/kappa511",
    safe_post: {
      policy: "lambda2",
      signals: [{
        kind: "idempotency_key",
        sufficient: true,
        source: "kappa511-production-proof",
        detail: "local provider deduplicates writes by a verified idempotency header",
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

if (crashAfterProvider === "1") {
  configureAgentPaymentCrashHookForTest(point => {
    if (point === "after_provider_effect") process.exit(92);
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
