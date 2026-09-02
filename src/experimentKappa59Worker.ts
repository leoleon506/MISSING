import { closeDistributedMoney } from "./runtime/distributedMoney.js";
import { configureAgentPaymentCrashHookForTest, handleAgentPaidResolution, type AgentPaymentCrashPoint } from "./runtime/agentPayments.js";
import { VERIFIED_RECIPES } from "./runtime/recipes.js";
import type { VerifiedRecipe } from "./runtime/types.js";

const [capability, paymentSignature, providerBaseUrl, recipeKind, crashAtRaw = ""] = process.argv.slice(2);
if (!capability || !paymentSignature || !providerBaseUrl || (recipeKind !== "idempotent" && recipeKind !== "ambiguous")) {
  throw new Error("usage: experimentKappa59Worker <capability> <paymentSignature> <providerBaseUrl> <idempotent|ambiguous> [crashPoint]");
}

const fingerprint = recipeKind === "idempotent"
  ? `kappa59-idempotent-${capability}`
  : `kappa59-ambiguous-${capability}`;
const idempotencyHeader = "Idempotency-Key";
const recipe: VerifiedRecipe = {
  capability,
  family: "kappa59",
  provider: `Kappa59 ${recipeKind}`,
  provider_candidate_id: `kappa59-${recipeKind}`,
  recipe_fingerprint: fingerprint,
  method: "POST",
  base_url: providerBaseUrl,
  path_template: recipeKind === "idempotent" ? "/idempotent" : "/ambiguous",
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
    evidence_url: "https://example.invalid/kappa59",
    ...(recipeKind === "idempotent" ? {
      safe_post: {
        policy: "lambda2" as const,
        signals: [{
          kind: "idempotency_key" as const,
          sufficient: true,
          source: "kappa59-production-proof",
          detail: "local provider deduplicates writes by a verified idempotency header",
          location: "header" as const,
          name: idempotencyHeader,
        }],
        input_overrides: {},
        generated_headers: [idempotencyHeader],
      },
    } : {}),
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

const crashAt = crashAtRaw as AgentPaymentCrashPoint | "";
if (crashAt) {
  configureAgentPaymentCrashHookForTest(point => {
    if (point === crashAt) {
      // Deliberately kill the process inside handleAgentPaidResolution after the named production side effect.
      process.exit(point === "after_reservation" ? 91 : point === "after_provider_effect" ? 92 : 93);
    }
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
