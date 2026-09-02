import { createHash, randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { mkdir, writeFile } from "node:fs/promises";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { Pool } from "pg";
import {
  claimDistributedRecovery,
  closeDistributedMoney,
  distributedPayment,
  initializeDistributedMoney,
  markDistributedPaymentAmbiguous,
  markDistributedProviderDone,
  truncateDistributedMoney,
} from "./runtime/distributedMoney.js";
import { agentRequestHash } from "./runtime/requestBinding.js";

process.env.MISSING_DISTRIBUTED_MONEY_ENABLED = "1";
process.env.MISSING_TRANSACTIONAL_RESPONSE_CACHE_ENABLED = "0";
process.env.MISSING_X402_RECOVERY_LEASE_MS = "1200";
process.env.MISSING_POSTGRES_POOL_MAX = "4";

const capability = "or4_failure_recovery";
const requestHash = agentRequestHash(capability, { stable: true });
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const payment = (label: string) => createHash("sha256").update(`OR4:${label}`).digest("hex");

const providerEffects = new Map<string, number>();
const providerCalls = new Map<string, number>();
const provider = createServer(async (req, res) => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  const body = JSON.parse(Buffer.concat(chunks).toString("utf8")) as { payment_hash: string; recovery_mode: string };
  const key = String(req.headers["idempotency-key"] ?? `ambiguous:${randomUUID()}`);
  providerCalls.set(body.payment_hash, (providerCalls.get(body.payment_hash) ?? 0) + 1);
  if (!providerEffects.has(key)) providerEffects.set(key, 1);
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify({ ok: true, key, recovery_mode: body.recovery_mode }));
});
await new Promise<void>(resolve => provider.listen(0, "127.0.0.1", resolve));
const address = provider.address();
if (!address || typeof address === "string") throw new Error("unable to bind OR4 provider");
const providerUrl = `http://127.0.0.1:${address.port}`;

function spawnWorker(args: string[]): ChildProcessWithoutNullStreams {
  return spawn(process.execPath, ["--import", "tsx", "src/operationalReadiness4Worker.ts", ...args], {
    env: process.env,
    stdio: ["pipe", "pipe", "pipe"],
  });
}

async function waitForLine(child: ChildProcessWithoutNullStreams, type: string): Promise<any> {
  return await new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    const timeout = setTimeout(() => reject(new Error(`timeout waiting for ${type}: ${stderr}`)), 60_000);
    child.stderr.on("data", chunk => { stderr += String(chunk); });
    child.stdout.on("data", chunk => {
      stdout += String(chunk);
      const lines = stdout.split(/\r?\n/);
      stdout = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const parsed = JSON.parse(line);
          if (parsed.type === type) {
            clearTimeout(timeout);
            resolve(parsed);
            return;
          }
        } catch {}
      }
    });
    child.on("error", error => { clearTimeout(timeout); reject(error); });
  });
}

async function killArmedWorker(mode: string, p: string, executionId: string, key = "") {
  const child = spawnWorker([mode, p, requestHash, executionId, capability, providerUrl, key]);
  await waitForLine(child, "ready");
  child.stdin.write("GO\n");
  const armed = await waitForLine(child, "armed");
  child.kill("SIGKILL");
  await new Promise<void>(resolve => child.once("exit", () => resolve()));
  return armed;
}

async function dualClaim(p: string) {
  const [a, b] = await Promise.all([
    claimDistributedRecovery({ paymentHash: p, requestHash, leaseToken: `or4-recovery-a-${randomUUID()}` }),
    claimDistributedRecovery({ paymentHash: p, requestHash, leaseToken: `or4-recovery-b-${randomUUID()}` }),
  ]);
  return [a, b];
}

await initializeDistributedMoney();
await truncateDistributedMoney();
const scenarios: any[] = [];

// 1. SIGKILL after reservation: exactly one concurrent recovery claimant wins.
{
  const p = payment("reserved-crash");
  await killArmedWorker("crash_reserved", p, "or4-reserved-owner");
  await sleep(1350);
  const claims = await dualClaim(p);
  const winners = claims.filter(item => item.claimed);
  const row = await distributedPayment(p);
  scenarios.push({
    name: "sigkill_after_reservation_single_recovery_owner",
    claim_winners: winners.length,
    fence: row?.lease_fence ?? null,
    state: row?.state ?? null,
    pass: winners.length === 1 && row?.lease_fence === 2 && row.state === "reserved",
  });
}

// 2. SIGKILL after an idempotent provider effect: two recovery claimants race,
// winner replays same key and provider still records one external effect.
{
  const p = payment("idempotent-provider-crash");
  const key = `or4-idem-${p}`;
  await killArmedWorker("crash_idempotent_provider", p, "or4-idem-owner", key);
  await sleep(1350);
  const claims = await dualClaim(p);
  const winner = claims.find(item => item.claimed);
  if (!winner?.record || !winner.leaseFence || !winner.leaseToken) throw new Error("OR4 idempotent recovery had no winner");
  const response = await fetch(providerUrl, { method: "POST", headers: { "content-type": "application/json", "idempotency-key": winner.record.provider_idempotency_key ?? "" }, body: JSON.stringify({ payment_hash: p, recovery_mode: "idempotent" }) });
  if (!response.ok) throw new Error("OR4 idempotent replay failed");
  const done = await markDistributedProviderDone({
    paymentHash: p,
    executionId: winner.record.execution_id,
    customerPriceMicrousd: 5000,
    providerCostMicrousd: 1000,
    grossMarginMicrousd: 4000,
    providerAttempts: providerCalls.get(p) ?? 0,
    unknownProviderCostAttempts: 0,
    resolution: { status: "resolved", recovery: "or4" },
    network: "eip155:84532",
    leaseToken: winner.leaseToken,
    leaseFence: winner.leaseFence,
  });
  const row = await distributedPayment(p);
  scenarios.push({
    name: "idempotent_effect_replayed_once_after_sigkill",
    claim_winners: claims.filter(item => item.claimed).length,
    provider_calls: providerCalls.get(p) ?? 0,
    provider_effects: providerEffects.get(key) ?? 0,
    final_state: row?.state ?? null,
    pass: claims.filter(item => item.claimed).length === 1 && (providerCalls.get(p) ?? 0) === 2 && (providerEffects.get(key) ?? 0) === 1 && done.changed === true && row?.state === "provider_done",
  });
}

// 3. SIGKILL after a non-idempotent/ambiguous provider effect: recovery quarantines,
// never replays external work.
{
  const p = payment("ambiguous-provider-crash");
  await killArmedWorker("crash_ambiguous_provider", p, "or4-ambiguous-owner");
  await sleep(1350);
  const claims = await dualClaim(p);
  const winner = claims.find(item => item.claimed);
  if (!winner?.record || !winner.leaseFence || !winner.leaseToken) throw new Error("OR4 ambiguous recovery had no winner");
  const quarantined = await markDistributedPaymentAmbiguous({
    paymentHash: p,
    executionId: winner.record.execution_id,
    reason: "or4_unknown_non_idempotent_provider_outcome",
    from: "executing",
    leaseToken: winner.leaseToken,
    leaseFence: winner.leaseFence,
  });
  const row = await distributedPayment(p);
  scenarios.push({
    name: "ambiguous_effect_quarantined_without_replay",
    claim_winners: claims.filter(item => item.claimed).length,
    provider_calls: providerCalls.get(p) ?? 0,
    final_state: row?.state ?? null,
    pass: claims.filter(item => item.claimed).length === 1 && (providerCalls.get(p) ?? 0) === 1 && quarantined.changed === true && row?.state === "ambiguous",
  });
}

// 4. Kill an actual PostgreSQL backend used by the application and prove the
// pool can reconnect and complete fresh durable work without process restart.
{
  const pool = new Pool({ connectionString: process.env.MISSING_POSTGRES_URL ?? process.env.DATABASE_URL, max: 1 });
  const pidRow = await pool.query<{ pid: number }>(`SELECT pid FROM pg_stat_activity WHERE application_name='missing-distributed-money' ORDER BY backend_start LIMIT 1`);
  const targetPid = pidRow.rows[0]?.pid ?? null;
  let terminated = false;
  if (targetPid !== null) {
    const result = await pool.query<{ terminated: boolean }>(`SELECT pg_terminate_backend($1) AS terminated`, [targetPid]);
    terminated = result.rows[0]?.terminated === true;
  }
  await pool.end();
  await sleep(150);
  const p = payment("postgres-backend-termination");
  const child = spawnWorker(["transient_pg", p, requestHash, "or4-transient-worker", capability, providerUrl, ""]);
  await waitForLine(child, "ready");
  child.stdin.write("GO\n");
  const result = await waitForLine(child, "result");
  await new Promise<void>(resolve => child.once("exit", () => resolve()));
  const row = await distributedPayment(p);
  scenarios.push({
    name: "postgres_backend_termination_recovers_without_process_restart",
    backend_terminated: terminated,
    worker_result: result,
    final_state: row?.state ?? null,
    pass: terminated === true && result.reserved === true && result.failed === true && row?.state === "failed",
  });
}

const pool = new Pool({ connectionString: process.env.MISSING_POSTGRES_URL ?? process.env.DATABASE_URL, max: 1 });
const active = await pool.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM missing_x402_payments WHERE state IN ('reserved','executing','provider_done','settling')`);
const duplicateHashes = await pool.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM (SELECT payment_hash FROM missing_x402_payments GROUP BY payment_hash HAVING COUNT(*) > 1) d`);
await pool.end();

const assertions = {
  all_failure_scenarios_pass: scenarios.every(item => item.pass === true),
  no_duplicate_payment_hashes: duplicateHashes.rows[0]?.count === "0",
  no_unexpected_active_payments: active.rows[0]?.count === "2", // reserved + provider_done are deliberate recovered terminal-for-drill states
};
const go = Object.values(assertions).every(Boolean);
const evidence = {
  result: go ? "GO_OPERATIONAL_FAILURE_INJECTION_RECOVERY_ENVELOPE" : "NO_GO_OPERATIONAL_FAILURE_INJECTION_RECOVERY_ENVELOPE",
  base_release: "b1037a6850a43bf173c6cd0de4dd9a52ef918a9f",
  assertions,
  scenarios,
  active_payment_count: Number(active.rows[0]?.count ?? -1),
};
await mkdir("artifacts", { recursive: true });
await writeFile("artifacts/operational-readiness-4-failure-injection-recovery.json", `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
console.log(JSON.stringify(evidence, null, 2));
closeDistributedMoney();
provider.close();
if (!go) process.exitCode = 1;
