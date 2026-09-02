import { createHash, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import {
  claimDistributedRecovery,
  closeDistributedMoney,
  distributedPayment,
  initializeDistributedMoney,
  markDistributedPaymentAmbiguous,
  markDistributedPaymentExecuting,
  markDistributedPaymentSettling,
  markDistributedProviderDone,
  markDistributedSettlementPending,
  reserveDistributedPayment,
  settleDistributedPayment,
  truncateDistributedMoney,
} from "./runtime/distributedMoney.js";
import { agentRequestHash } from "./runtime/requestBinding.js";
import { stableProviderIdempotencyKey, stableSettlementIntentId } from "./runtime/recoveryPolicy.js";
import { configureX402Fetch, settleX402Payment, type X402Requirements } from "./runtime/x402.js";

process.env.MISSING_DISTRIBUTED_MONEY_ENABLED = "1";
process.env.MISSING_TRANSACTIONAL_RESPONSE_CACHE_ENABLED = "0";
process.env.MISSING_X402_RECOVERY_LEASE_MS = "100";
process.env.MISSING_X402_ENABLED = "1";
process.env.MISSING_X402_NETWORK = "eip155:84532";
process.env.MISSING_X402_ASSET = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
process.env.MISSING_X402_PAY_TO = "0x209693Bc6afc0C5328bA36FaF03C514EF312287C";
process.env.MISSING_X402_FACILITATOR_URL = "https://facilitator.test";

const capability = "country_alpha_metadata";
const input = { country_code: "CR" };
const requestHash = agentRequestHash(capability, input);
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const payment = (name: string) => createHash("sha256").update(`k58:${name}:${Date.now()}:${Math.random()}`).digest("hex");

await initializeDistributedMoney();
await truncateDistributedMoney();

const evidence: any = {
  product: "Kappa.5.8",
  invariant: "ambiguous external outcomes are replayed only with a proven recovery contract or quarantined explicitly",
  scenarios: [],
};

// 1) A non-idempotent write that may have happened is quarantined, never replayed.
{
  const p = payment("ambiguous-post");
  const executionId = randomUUID();
  const reserved = await reserveDistributedPayment({ paymentHash: p, requestHash, executionId, capability });
  if (!reserved.reserved) throw new Error("unable to reserve ambiguous scenario");
  await markDistributedPaymentExecuting({ paymentHash: p, executionId, recipeFingerprint: "post-no-idempotency", recoveryMode: "ambiguous" });
  const providerEffects = 1; // external write happened, then process died before durable provider_done.
  await sleep(130);
  const recoveryToken = randomUUID();
  const claim = await claimDistributedRecovery({ paymentHash: p, requestHash, leaseToken: recoveryToken });
  if (!claim.claimed) throw new Error("unable to claim ambiguous recovery");
  await markDistributedPaymentAmbiguous({ paymentHash: p, executionId, reason: "provider_outcome_unknown_without_idempotency", from: "executing", leaseToken: recoveryToken });
  const row = await distributedPayment(p);
  evidence.scenarios.push({
    name: "non_idempotent_post_quarantined",
    provider_effects: providerEffects,
    provider_retries: 0,
    final_state: row?.state ?? null,
    pass: providerEffects === 1 && row?.state === "ambiguous",
  });
}

// 2) An idempotent write may be replayed with the same stable key; two calls still produce one external effect.
{
  const p = payment("idempotent-post");
  const executionId = randomUUID();
  const stableKey = stableProviderIdempotencyKey(p, "post-idempotent");
  const providerSeen = new Set<string>();
  let providerCalls = 0;
  let providerEffects = 0;
  const providerCall = (key: string) => {
    providerCalls += 1;
    if (!providerSeen.has(key)) {
      providerSeen.add(key);
      providerEffects += 1;
    }
    return { status: "resolved", recipe_fingerprint: "post-idempotent", output: { ok: true } };
  };

  const reserved = await reserveDistributedPayment({ paymentHash: p, requestHash, executionId, capability });
  if (!reserved.reserved) throw new Error("unable to reserve idempotent scenario");
  await markDistributedPaymentExecuting({ paymentHash: p, executionId, recipeFingerprint: "post-idempotent", recoveryMode: "idempotent", providerIdempotencyKey: stableKey });
  providerCall(stableKey); // write happened; crash before provider_done.
  await sleep(130);
  const recoveryToken = randomUUID();
  const claim = await claimDistributedRecovery({ paymentHash: p, requestHash, leaseToken: recoveryToken });
  if (!claim.claimed || claim.record?.provider_idempotency_key !== stableKey) throw new Error("idempotent recovery identity was not durable");
  const resolution = providerCall(claim.record.provider_idempotency_key);
  await markDistributedProviderDone({
    paymentHash: p, executionId, customerPriceMicrousd: 5000, providerCostMicrousd: 1000, grossMarginMicrousd: 4000,
    providerAttempts: providerCalls, unknownProviderCostAttempts: 0, resolution, network: "eip155:84532", leaseToken: recoveryToken,
  });
  const row = await distributedPayment(p);
  evidence.scenarios.push({
    name: "idempotent_post_replayed_with_same_key",
    stable_key_reused: true,
    provider_calls: providerCalls,
    provider_effects: providerEffects,
    final_state: row?.state ?? null,
    pass: providerCalls === 2 && providerEffects === 1 && row?.state === "provider_done" && row.provider_idempotency_key === stableKey,
  });
}

// 3) Settlement submission may be replayed after a crash because the durable settlement intent is stable.
{
  const p = payment("settlement-intent");
  const executionId = randomUUID();
  const intent = stableSettlementIntentId(p, requestHash);
  const requirements: X402Requirements = {
    scheme: "exact", network: "eip155:84532", amount: "5000", asset: process.env.MISSING_X402_ASSET!, payTo: process.env.MISSING_X402_PAY_TO!, maxTimeoutSeconds: 60, extra: { name: "USDC", version: "2" },
  };
  const facilitatorSeen = new Map<string, string>();
  let facilitatorCalls = 0;
  let settlementEffects = 0;
  configureX402Fetch((async (_input: string | URL | Request, init?: RequestInit) => {
    facilitatorCalls += 1;
    const headers = new Headers(init?.headers);
    const key = headers.get("idempotency-key") ?? "";
    if (!key) return new Response(JSON.stringify({ error: "missing idempotency" }), { status: 400 });
    let transaction = facilitatorSeen.get(key);
    if (!transaction) {
      transaction = `0x${createHash("sha256").update(key).digest("hex")}`;
      facilitatorSeen.set(key, transaction);
      settlementEffects += 1;
    }
    return new Response(JSON.stringify({ success: true, transaction, network: requirements.network }), { status: 200 });
  }) as typeof fetch);

  const reserved = await reserveDistributedPayment({ paymentHash: p, requestHash, executionId, capability });
  if (!reserved.reserved) throw new Error("unable to reserve settlement scenario");
  const resolution = { status: "resolved", recipe_fingerprint: "settlement-proof", output: { ok: true } };
  await markDistributedPaymentSettling({
    paymentHash: p, executionId, customerPriceMicrousd: 5000, providerCostMicrousd: 1000, grossMarginMicrousd: 4000,
    providerAttempts: 1, unknownProviderCostAttempts: 0, resolution, network: requirements.network, settlementIntentId: intent,
  });
  const first = await settleX402Payment({ paymentPayload: { payment: p }, requirements, settlementIntentId: intent });
  // Simulate crash here: transaction exists externally but was not persisted locally.
  await sleep(130);
  const recoveryToken = randomUUID();
  const claim = await claimDistributedRecovery({ paymentHash: p, requestHash, leaseToken: recoveryToken });
  if (!claim.claimed || claim.record?.settlement_intent_id !== intent) throw new Error("settlement recovery intent was not durable");
  const second = await settleX402Payment({ paymentPayload: { payment: p }, requirements, settlementIntentId: claim.record.settlement_intent_id });
  if (!first.transaction || first.transaction !== second.transaction) throw new Error("facilitator did not deduplicate settlement intent");
  await markDistributedSettlementPending({ paymentHash: p, executionId, transactionReference: second.transaction, reason: "recovered_from_settlement_intent", leaseToken: recoveryToken });
  await settleDistributedPayment({ paymentHash: p, executionId, transactionReference: second.transaction, responseStatus: 200, responseHeaders: {}, responseBody: { status: "resolved", recovery: "kappa58" }, leaseToken: recoveryToken });
  const row = await distributedPayment(p);
  evidence.scenarios.push({
    name: "settlement_intent_recovers_unknown_transaction",
    facilitator_calls: facilitatorCalls,
    settlement_effects: settlementEffects,
    same_transaction: first.transaction === second.transaction,
    settlement_intent_id: row?.settlement_intent_id ?? null,
    final_state: row?.state ?? null,
    pass: facilitatorCalls === 2 && settlementEffects === 1 && first.transaction === second.transaction && row?.state === "settled",
  });
}

configureX402Fetch();
const passed = evidence.scenarios.every((scenario: any) => scenario.pass === true);
evidence.result = passed ? "GO_AMBIGUOUS_OUTCOME_RECOVERY" : "NO_GO_AMBIGUOUS_OUTCOME_RECOVERY";
await mkdir("artifacts", { recursive: true });
await writeFile("artifacts/product-kappa58-ambiguous-outcome-recovery.json", `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ result: evidence.result, scenarios: evidence.scenarios }, null, 2));
closeDistributedMoney();
if (!passed) process.exitCode = 1;
