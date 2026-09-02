import { mkdir, writeFile } from "node:fs/promises";
import { providerRecoveryPolicy } from "./runtime/recoveryPolicy.js";
import { configureX402Fetch, settleX402Payment, type X402Requirements } from "./runtime/x402.js";
import type { VerifiedRecipe } from "./runtime/types.js";

const requirements: X402Requirements = {
  scheme: "exact",
  network: "eip155:84532",
  amount: "5000",
  asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
  payTo: "0x209693Bc6afc0C5328bA36FaF03C514EF312287C",
  maxTimeoutSeconds: 60,
  extra: { name: "USDC", version: "2" },
};

function baseRecipe(): VerifiedRecipe {
  return {
    capability: "kappa512_write",
    family: "kappa512",
    provider: "Kappa512",
    provider_candidate_id: "kappa512",
    recipe_fingerprint: "kappa512-write",
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
      evidence_url: "https://example.test/kappa512",
    },
  };
}

const evidence: any = {
  product: "Kappa.5.12",
  invariant: "automatic replay of external writes requires an explicit verified idempotency contract",
  scenarios: [],
};

const generatedOnly: VerifiedRecipe = {
  ...baseRecipe(),
  generated_headers: [{ location: "header", name: "Idempotency-Key", generator: "uuid_v4" }],
};
const generatedPolicy = providerRecoveryPolicy(generatedOnly);
evidence.scenarios.push({
  name: "generated_header_is_not_contract",
  mode: generatedPolicy.mode,
  header: generatedPolicy.idempotency_header,
  pass: generatedPolicy.mode === "ambiguous" && generatedPolicy.idempotency_header === null,
});

const verified = baseRecipe();
verified.verification = {
  ...verified.verification,
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
};
const verifiedPolicy = providerRecoveryPolicy(verified);
evidence.scenarios.push({
  name: "verified_safe_post_contract_allows_replay",
  mode: verifiedPolicy.mode,
  header: verifiedPolicy.idempotency_header,
  pass: verifiedPolicy.mode === "idempotent" && verifiedPolicy.idempotency_header === "Idempotency-Key",
});

process.env.MISSING_X402_FACILITATOR_URL = "https://facilitator.test";
delete process.env.MISSING_X402_FACILITATOR_IDEMPOTENCY;
let facilitatorCalls = 0;
configureX402Fetch((async () => {
  facilitatorCalls += 1;
  return new Response(JSON.stringify({ success: true, transaction: "0xunexpected" }), { status: 200 });
}) as typeof fetch);
let blocked = false;
try {
  await settleX402Payment({ paymentPayload: { payment: "p" }, requirements, settlementIntentId: "intent-k512" });
} catch (error) {
  blocked = error instanceof Error && error.message.includes("idempotency contract is not enabled");
}
evidence.scenarios.push({
  name: "facilitator_without_contract_is_blocked_before_http",
  facilitator_calls: facilitatorCalls,
  pass: blocked && facilitatorCalls === 0,
});

process.env.MISSING_X402_FACILITATOR_IDEMPOTENCY = "1";
const seen = new Set<string>();
const keys: string[] = [];
let settlementEffects = 0;
configureX402Fetch((async (_input: string | URL | Request, init?: RequestInit) => {
  facilitatorCalls += 1;
  const key = new Headers(init?.headers).get("idempotency-key") ?? "";
  keys.push(key);
  if (!seen.has(key)) {
    seen.add(key);
    settlementEffects += 1;
  }
  return new Response(JSON.stringify({ success: true, transaction: "0xsame", network: requirements.network }), { status: 200 });
}) as typeof fetch);
const first = await settleX402Payment({ paymentPayload: { payment: "p" }, requirements, settlementIntentId: "intent-k512" });
const second = await settleX402Payment({ paymentPayload: { payment: "p" }, requirements, settlementIntentId: "intent-k512" });
evidence.scenarios.push({
  name: "explicit_facilitator_contract_reuses_durable_intent",
  facilitator_calls: facilitatorCalls,
  settlement_effects: settlementEffects,
  keys,
  same_transaction: first.transaction === second.transaction,
  pass: keys.length === 2 && keys[0] === "intent-k512" && keys[1] === keys[0] && settlementEffects === 1 && first.transaction === second.transaction,
});

configureX402Fetch();
const passed = evidence.scenarios.every((scenario: any) => scenario.pass === true);
evidence.result = passed ? "GO_VERIFIED_IDEMPOTENCY_CONTRACTS" : "NO_GO_VERIFIED_IDEMPOTENCY_CONTRACTS";
await mkdir("artifacts", { recursive: true });
await writeFile("artifacts/product-kappa512-verified-idempotency-contracts.json", `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ result: evidence.result, scenarios: evidence.scenarios }, null, 2));
if (!passed) process.exitCode = 1;
