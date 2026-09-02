import { createHash } from "node:crypto";
import { performance } from "node:perf_hooks";
import { agentRequestHash } from "./runtime/requestBinding.js";
import {
  closeDistributedMoney,
  distributedMoneySnapshot,
  initializeDistributedMoney,
  reserveDistributedPayment,
} from "./runtime/distributedMoney.js";

const [workerIdRaw, workerCountRaw, keyCountRaw, contendersRaw, hotContendersRaw] = process.argv.slice(2);
const workerId = Number(workerIdRaw);
const workerCount = Number(workerCountRaw);
const keyCount = Number(keyCountRaw);
const contendersPerKey = Number(contendersRaw);
const hotContenders = Number(hotContendersRaw);

for (const [name, value, minimum] of [
  ["workerId", workerId, 0],
  ["workerCount", workerCount, 1],
  ["keyCount", keyCount, 1],
  ["contendersPerKey", contendersPerKey, 1],
  ["hotContenders", hotContenders, 1],
] as const) {
  if (!Number.isSafeInteger(value) || value < minimum) throw new Error(`invalid ${name}: ${value}`);
}
if (workerId >= workerCount) throw new Error(`workerId ${workerId} must be < workerCount ${workerCount}`);

process.env.MISSING_DISTRIBUTED_MONEY_ENABLED = "1";
process.env.MISSING_TRANSACTIONAL_RESPONSE_CACHE_ENABLED = "0";
process.env.MISSING_X402_RECOVERY_LEASE_MS = process.env.MISSING_X402_RECOVERY_LEASE_MS ?? "600000";
process.env.MISSING_POSTGRES_POOL_MAX = process.env.MISSING_POSTGRES_POOL_MAX ?? "8";
process.env.MISSING_POSTGRES_APPLICATION_NAME = `missing-or1-worker-${workerId}`;

function digest(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function waitForGo(): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("timed out waiting for GO barrier")), 60_000);
    process.stdin.setEncoding("utf8");
    process.stdin.once("data", value => {
      clearTimeout(timeout);
      if (!String(value).includes("GO")) reject(new Error(`unexpected barrier input: ${String(value).trim()}`));
      else resolve();
    });
  });
}

type AttemptResult = {
  key: string;
  contender: number;
  won: boolean;
  latency_ms: number;
  prior_state: string | null;
  error: string | null;
};

async function reservationAttempt(key: string, contender: number): Promise<AttemptResult> {
  const capability = "operational_readiness_reservation_load";
  const paymentHash = digest(`MISSING:OR1:payment:${key}`);
  const requestHash = agentRequestHash(capability, { key, stable: true });
  const executionId = `or1-${key}-${contender}-w${workerId}-p${process.pid}`;
  const started = performance.now();
  try {
    const reservation = await reserveDistributedPayment({ paymentHash, requestHash, executionId, capability });
    return {
      key,
      contender,
      won: reservation.reserved,
      latency_ms: Number((performance.now() - started).toFixed(3)),
      prior_state: reservation.prior?.state ?? null,
      error: null,
    };
  } catch (error) {
    return {
      key,
      contender,
      won: false,
      latency_ms: Number((performance.now() - started).toFixed(3)),
      prior_state: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

await initializeDistributedMoney();
process.stdout.write(`${JSON.stringify({ type: "ready", worker_id: workerId, pid: process.pid })}\n`);
await waitForGo();

let maxPoolTotal = 0;
let maxPoolIdle = 0;
let maxPoolWaiting = 0;
const sampler = setInterval(() => {
  const snapshot = distributedMoneySnapshot();
  maxPoolTotal = Math.max(maxPoolTotal, snapshot.pool_total);
  maxPoolIdle = Math.max(maxPoolIdle, snapshot.pool_idle);
  maxPoolWaiting = Math.max(maxPoolWaiting, snapshot.pool_waiting);
}, 5);
sampler.unref?.();

const startedAt = performance.now();
const jobs: Array<Promise<AttemptResult>> = [];
for (let keyIndex = 0; keyIndex < keyCount; keyIndex += 1) {
  const key = `key-${keyIndex}`;
  for (let contender = workerId; contender < contendersPerKey; contender += workerCount) {
    jobs.push(reservationAttempt(key, contender));
  }
}
for (let contender = workerId; contender < hotContenders; contender += workerCount) {
  jobs.push(reservationAttempt("hot-key", contender));
}
const attempts = await Promise.all(jobs);
const durationMs = performance.now() - startedAt;
clearInterval(sampler);

const finalSnapshot = distributedMoneySnapshot();
maxPoolTotal = Math.max(maxPoolTotal, finalSnapshot.pool_total);
maxPoolIdle = Math.max(maxPoolIdle, finalSnapshot.pool_idle);
maxPoolWaiting = Math.max(maxPoolWaiting, finalSnapshot.pool_waiting);

process.stdout.write(`${JSON.stringify({
  type: "result",
  worker_id: workerId,
  pid: process.pid,
  duration_ms: Number(durationMs.toFixed(3)),
  attempt_count: attempts.length,
  wins: attempts.filter(item => item.won).length,
  errors: attempts.filter(item => item.error !== null).length,
  max_pool_total: maxPoolTotal,
  max_pool_idle: maxPoolIdle,
  max_pool_waiting: maxPoolWaiting,
  attempts,
})}\n`);

closeDistributedMoney();
