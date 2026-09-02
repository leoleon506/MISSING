import { createHash, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import {
  claimDistributedRecovery,
  closeDistributedMoney,
  distributedPayment,
  initializeDistributedMoney,
  markDistributedPaymentExecuting,
  markDistributedPaymentSettling,
  markDistributedProviderDone,
  markDistributedSettlementPending,
  reserveDistributedPayment,
  settleDistributedPayment,
  truncateDistributedMoney,
} from "./runtime/distributedMoney.js";
import { agentRequestHash } from "./runtime/requestBinding.js";

const LEASE_MS = 1000;
const EXPIRY_WAIT_MS = LEASE_MS + 250;
process.env.MISSING_DISTRIBUTED_MONEY_ENABLED = "1";
process.env.MISSING_TRANSACTIONAL_RESPONSE_CACHE_ENABLED = "0";
process.env.MISSING_X402_RECOVERY_LEASE_MS = String(LEASE_MS);

const capability = "country_alpha_metadata";
const input = { country_code: "CR" };
const requestHash = agentRequestHash(capability, input);
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const payment = (name: string) => createHash("sha256").update(`k510:${name}:${Date.now()}:${Math.random()}`).digest("hex");
const resolution = { status: "resolved", recipe_fingerprint: "k510-proof", output: { ok: true } };

await initializeDistributedMoney();
await truncateDistributedMoney();

const evidence: any = {
  product: "Kappa.5.10",
  invariant: "an expired or superseded lease owner cannot mutate authoritative payment state",
  lease_ms: LEASE_MS,
  scenarios: [],
};

// 1) Normal token rotation: after takeover, the old token cannot commit provider completion.
{
  const p = payment("rotated-token");
  const executionId = randomUUID();
  const reserved = await reserveDistributedPayment({ paymentHash: p, requestHash, executionId, capability });
  if (!reserved.reserved || reserved.leaseFence !== 1) throw new Error("expected initial fence 1");
  const executing = await markDistributedPaymentExecuting({
    paymentHash: p,
    executionId,
    recipeFingerprint: "k510-proof",
    recoveryMode: "idempotent",
    providerIdempotencyKey: "k510-key",
    leaseToken: executionId,
    leaseFence: 1,
  });
  if (!executing.changed) throw new Error("initial owner could not enter executing");
  await sleep(EXPIRY_WAIT_MS);
  const nextToken = randomUUID();
  const claimed = await claimDistributedRecovery({ paymentHash: p, requestHash, leaseToken: nextToken });
  if (!claimed.claimed || claimed.leaseFence !== 2) throw new Error("expected takeover fence 2");
  const stale = await markDistributedProviderDone({
    paymentHash: p,
    executionId,
    customerPriceMicrousd: 5000,
    providerCostMicrousd: 1000,
    grossMarginMicrousd: 4000,
    providerAttempts: 1,
    unknownProviderCostAttempts: 0,
    resolution,
    network: "eip155:84532",
    leaseToken: executionId,
    leaseFence: 1,
  });
  const current = await markDistributedProviderDone({
    paymentHash: p,
    executionId,
    customerPriceMicrousd: 5000,
    providerCostMicrousd: 1000,
    grossMarginMicrousd: 4000,
    providerAttempts: 1,
    unknownProviderCostAttempts: 0,
    resolution,
    network: "eip155:84532",
    leaseToken: nextToken,
    leaseFence: 2,
  });
  const row = await distributedPayment(p);
  evidence.scenarios.push({
    name: "rotated_token_fences_old_owner",
    initial_fence: 1,
    takeover_fence: claimed.leaseFence,
    stale_changed: stale.changed,
    current_changed: current.changed,
    final_state: row?.state ?? null,
    pass: stale.changed === false && current.changed === true && row?.state === "provider_done" && row.lease_fence === 2,
  });
}

// 2) ABA defense: even if the same lease token string is reused after expiry,
// the old generation is fenced out while the new generation may continue.
{
  const p = payment("same-token-new-generation");
  const executionId = randomUUID();
  const token = `stable-token-${randomUUID()}`;
  const reserved = await reserveDistributedPayment({ paymentHash: p, requestHash, executionId, capability });
  if (!reserved.reserved) throw new Error("unable to reserve ABA scenario");
  // Move ownership from the reservation token to the stable test token via an expired takeover.
  await sleep(EXPIRY_WAIT_MS);
  const firstClaim = await claimDistributedRecovery({ paymentHash: p, requestHash, leaseToken: token });
  if (!firstClaim.claimed || firstClaim.leaseFence !== 2) throw new Error("expected first stable-token fence 2");
  const executing = await markDistributedPaymentExecuting({
    paymentHash: p,
    executionId,
    recipeFingerprint: "k510-proof",
    recoveryMode: "idempotent",
    providerIdempotencyKey: "k510-aba",
    leaseToken: token,
    leaseFence: 2,
  });
  if (!executing.changed) throw new Error("fence 2 owner could not enter executing");
  await sleep(EXPIRY_WAIT_MS);
  const secondClaim = await claimDistributedRecovery({ paymentHash: p, requestHash, leaseToken: token });
  if (!secondClaim.claimed || secondClaim.leaseFence !== 3) throw new Error("expected same-token fence 3");
  const staleSameToken = await markDistributedProviderDone({
    paymentHash: p,
    executionId,
    customerPriceMicrousd: 5000,
    providerCostMicrousd: 1000,
    grossMarginMicrousd: 4000,
    providerAttempts: 1,
    unknownProviderCostAttempts: 0,
    resolution,
    network: "eip155:84532",
    leaseToken: token,
    leaseFence: 2,
  });
  const currentSameToken = await markDistributedProviderDone({
    paymentHash: p,
    executionId,
    customerPriceMicrousd: 5000,
    providerCostMicrousd: 1000,
    grossMarginMicrousd: 4000,
    providerAttempts: 1,
    unknownProviderCostAttempts: 0,
    resolution,
    network: "eip155:84532",
    leaseToken: token,
    leaseFence: 3,
  });
  const row = await distributedPayment(p);
  evidence.scenarios.push({
    name: "same_token_old_generation_fenced",
    old_fence: 2,
    new_fence: secondClaim.leaseFence,
    stale_changed: staleSameToken.changed,
    current_changed: currentSameToken.changed,
    final_state: row?.state ?? null,
    pass: staleSameToken.changed === false && currentSameToken.changed === true && row?.lease_fence === 3 && row.state === "provider_done",
  });
}

// 3) Expiry itself fences the owner even before another replica performs takeover.
{
  const p = payment("expired-no-takeover");
  const executionId = randomUUID();
  const reserved = await reserveDistributedPayment({ paymentHash: p, requestHash, executionId, capability });
  if (!reserved.reserved) throw new Error("unable to reserve expiry scenario");
  await sleep(EXPIRY_WAIT_MS);
  const expiredWrite = await markDistributedPaymentExecuting({
    paymentHash: p,
    executionId,
    recipeFingerprint: "k510-proof",
    recoveryMode: "read_only",
    leaseToken: executionId,
    leaseFence: 1,
  });
  const token2 = randomUUID();
  const claimed = await claimDistributedRecovery({ paymentHash: p, requestHash, leaseToken: token2 });
  const recoveredWrite = claimed.leaseFence ? await markDistributedPaymentExecuting({
    paymentHash: p,
    executionId,
    recipeFingerprint: "k510-proof",
    recoveryMode: "read_only",
    leaseToken: token2,
    leaseFence: claimed.leaseFence,
  }) : { changed: false };
  evidence.scenarios.push({
    name: "expired_owner_cannot_write_before_takeover",
    expired_changed: expiredWrite.changed,
    takeover_fence: claimed.leaseFence,
    recovered_changed: recoveredWrite.changed,
    pass: expiredWrite.changed === false && claimed.claimed === true && claimed.leaseFence === 2 && recoveredWrite.changed === true,
  });
}

// 4) Fencing applies at settlement too: stale reconcilers cannot persist a tx or commit settled.
{
  const p = payment("settlement-fencing");
  const executionId = randomUUID();
  const reserved = await reserveDistributedPayment({ paymentHash: p, requestHash, executionId, capability });
  if (!reserved.reserved) throw new Error("unable to reserve settlement scenario");
  const settling = await markDistributedPaymentSettling({
    paymentHash: p,
    executionId,
    customerPriceMicrousd: 5000,
    providerCostMicrousd: 1000,
    grossMarginMicrousd: 4000,
    providerAttempts: 1,
    unknownProviderCostAttempts: 0,
    resolution,
    network: "eip155:84532",
    settlementIntentId: `intent-${p}`,
    leaseToken: executionId,
    leaseFence: 1,
  });
  if (!settling.changed) throw new Error("unable to enter settling");
  await sleep(EXPIRY_WAIT_MS);
  const token2 = randomUUID();
  const claim2 = await claimDistributedRecovery({ paymentHash: p, requestHash, leaseToken: token2 });
  if (!claim2.claimed || claim2.leaseFence !== 2) throw new Error("expected settlement fence 2");
  const tx = `0x${createHash("sha256").update(p).digest("hex")}`;
  const stalePending = await markDistributedSettlementPending({
    paymentHash: p,
    executionId,
    transactionReference: tx,
    reason: "stale",
    leaseToken: executionId,
    leaseFence: 1,
  });
  const currentPending = await markDistributedSettlementPending({
    paymentHash: p,
    executionId,
    transactionReference: tx,
    reason: "current",
    leaseToken: token2,
    leaseFence: 2,
  });
  if (!currentPending.changed) throw new Error("current owner could not persist transaction");
  await sleep(EXPIRY_WAIT_MS);
  const token3 = randomUUID();
  const claim3 = await claimDistributedRecovery({ paymentHash: p, requestHash, leaseToken: token3 });
  if (!claim3.claimed || claim3.leaseFence !== 3) throw new Error("expected settlement fence 3");
  const staleCommit = await settleDistributedPayment({
    paymentHash: p,
    executionId,
    transactionReference: tx,
    responseStatus: 200,
    responseHeaders: {},
    responseBody: { stale: true },
    leaseToken: token2,
    leaseFence: 2,
  });
  const currentCommit = await settleDistributedPayment({
    paymentHash: p,
    executionId,
    transactionReference: tx,
    responseStatus: 200,
    responseHeaders: {},
    responseBody: { settled: true },
    leaseToken: token3,
    leaseFence: 3,
  });
  const row = await distributedPayment(p);
  evidence.scenarios.push({
    name: "stale_settlement_owner_fenced",
    stale_pending_changed: stalePending.changed,
    current_pending_changed: currentPending.changed,
    stale_commit_changed: staleCommit.changed,
    current_commit_changed: currentCommit.changed,
    final_fence: row?.lease_fence ?? null,
    final_state: row?.state ?? null,
    pass: stalePending.changed === false && currentPending.changed === true && staleCommit.changed === false && currentCommit.changed === true && row?.state === "settled" && row.lease_fence === 3,
  });
}

const passed = evidence.scenarios.every((scenario: any) => scenario.pass === true);
evidence.result = passed ? "GO_LEASE_FENCING_STALE_OWNER_EXCLUSION" : "NO_GO_LEASE_FENCING_STALE_OWNER_EXCLUSION";
await mkdir("artifacts", { recursive: true });
await writeFile("artifacts/product-kappa510-lease-fencing.json", `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ result: evidence.result, scenarios: evidence.scenarios }, null, 2));
closeDistributedMoney();
if (!passed) process.exitCode = 1;
