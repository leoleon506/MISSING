import { setTimeout as sleep } from "node:timers/promises";
import {
  closeDistributedMoney,
  distributedMoneySnapshot,
  failDistributedPayment,
  initializeDistributedMoney,
  markDistributedPaymentExecuting,
  reserveDistributedPayment,
} from "./runtime/distributedMoney.js";

const [mode, paymentHash, requestHash, executionId, capability, providerUrl, idempotencyKey = ""] = process.argv.slice(2);

if (!mode || !paymentHash || !requestHash || !executionId || !capability) {
  throw new Error("OR4 worker requires mode, paymentHash, requestHash, executionId, capability");
}

process.env.MISSING_DISTRIBUTED_MONEY_ENABLED = "1";
process.env.MISSING_TRANSACTIONAL_RESPONSE_CACHE_ENABLED = "0";
process.env.MISSING_X402_RECOVERY_LEASE_MS = process.env.MISSING_X402_RECOVERY_LEASE_MS ?? "1200";
process.env.MISSING_POSTGRES_POOL_MAX = process.env.MISSING_POSTGRES_POOL_MAX ?? "2";

function emit(value: Record<string, unknown>) {
  process.stdout.write(`${JSON.stringify(value)}\n`);
}

async function waitForGo() {
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("OR4 worker timed out waiting for GO")), 60_000);
    process.stdin.setEncoding("utf8");
    process.stdin.once("data", value => {
      clearTimeout(timeout);
      if (String(value).includes("GO")) resolve();
      else reject(new Error(`OR4 worker received unexpected barrier input: ${String(value).trim()}`));
    });
  });
}

async function holdUntilKilled() {
  while (true) await sleep(60_000);
}

async function providerCall(recoveryMode: "idempotent" | "ambiguous") {
  if (!providerUrl) throw new Error("OR4 provider crash mode requires provider URL");
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (recoveryMode === "idempotent") {
    if (!idempotencyKey) throw new Error("OR4 idempotent mode requires idempotency key");
    headers["idempotency-key"] = idempotencyKey;
  }
  const response = await fetch(providerUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({ payment_hash: paymentHash, recovery_mode: recoveryMode }),
  });
  if (!response.ok) throw new Error(`OR4 provider returned HTTP ${response.status}`);
  return await response.json();
}

await initializeDistributedMoney();
emit({ type: "ready", mode, payment_hash: paymentHash, pid: process.pid });
await waitForGo();

if (mode === "transient_pg") {
  const reservation = await reserveDistributedPayment({ paymentHash, requestHash, executionId, capability });
  if (!reservation.reserved || !reservation.leaseFence) throw new Error("OR4 transient worker could not reserve after backend termination");
  const failed = await failDistributedPayment({
    paymentHash,
    executionId,
    reason: "or4_transient_pg_probe_complete",
    from: "reserved",
    leaseToken: executionId,
    leaseFence: reservation.leaseFence,
  });
  emit({
    type: "result",
    mode,
    reserved: reservation.reserved,
    failed: failed.changed,
    snapshot_ready: distributedMoneySnapshot().ready,
  });
  closeDistributedMoney();
  process.exit(0);
}

const reservation = await reserveDistributedPayment({ paymentHash, requestHash, executionId, capability });
if (!reservation.reserved || !reservation.leaseFence) throw new Error(`OR4 ${mode} worker could not reserve`);

if (mode === "crash_reserved") {
  emit({ type: "armed", mode, payment_hash: paymentHash, lease_fence: reservation.leaseFence });
  await holdUntilKilled();
}

if (mode === "crash_idempotent_provider" || mode === "crash_ambiguous_provider") {
  const recoveryMode = mode === "crash_idempotent_provider" ? "idempotent" : "ambiguous";
  const executing = await markDistributedPaymentExecuting({
    paymentHash,
    executionId,
    recipeFingerprint: recoveryMode === "idempotent" ? "or4-idempotent-provider" : "or4-ambiguous-provider",
    recoveryMode,
    providerIdempotencyKey: recoveryMode === "idempotent" ? idempotencyKey : null,
    leaseToken: executionId,
    leaseFence: reservation.leaseFence,
  });
  if (!executing.changed) throw new Error(`OR4 ${mode} worker could not enter executing`);
  const provider = await providerCall(recoveryMode);
  emit({
    type: "armed",
    mode,
    payment_hash: paymentHash,
    lease_fence: reservation.leaseFence,
    provider,
  });
  await holdUntilKilled();
}

throw new Error(`Unknown OR4 worker mode: ${mode}`);
