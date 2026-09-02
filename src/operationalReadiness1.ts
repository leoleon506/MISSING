import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { Pool } from "pg";
import { closeDistributedMoney, initializeDistributedMoney, truncateDistributedMoney } from "./runtime/distributedMoney.js";

process.env.MISSING_DISTRIBUTED_MONEY_ENABLED = "1";
process.env.MISSING_TRANSACTIONAL_RESPONSE_CACHE_ENABLED = "0";
process.env.MISSING_X402_RECOVERY_LEASE_MS = "600000";

const workerCount = Number(process.env.MISSING_OR1_WORKERS ?? 8);
const keyCount = Number(process.env.MISSING_OR1_KEYS ?? 200);
const contendersPerKey = Number(process.env.MISSING_OR1_CONTENDERS_PER_KEY ?? 4);
const hotContenders = Number(process.env.MISSING_OR1_HOT_CONTENDERS ?? 200);

for (const [name, value] of [["workers", workerCount], ["keys", keyCount], ["contenders", contendersPerKey], ["hotContenders", hotContenders]] as const) {
  if (!Number.isSafeInteger(value) || value < 1) throw new Error(`invalid ${name}: ${value}`);
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1);
  return Number(sorted[index].toFixed(3));
}

type WorkerResult = {
  type: "result";
  worker_id: number;
  pid: number;
  duration_ms: number;
  attempt_count: number;
  wins: number;
  errors: number;
  max_pool_total: number;
  max_pool_idle: number;
  max_pool_waiting: number;
  attempts: Array<{ key: string; contender: number; won: boolean; latency_ms: number; prior_state: string | null; error: string | null }>;
};

type ChildState = { child: ChildProcessWithoutNullStreams; ready: Promise<void>; result: Promise<WorkerResult> };

function launchWorker(workerId: number): ChildState {
  const child = spawn(process.execPath, [
    "--import", "tsx",
    "src/operationalReadiness1Worker.ts",
    String(workerId), String(workerCount), String(keyCount), String(contendersPerKey), String(hotContenders),
  ], { env: process.env, stdio: ["pipe", "pipe", "pipe"] });

  let stdoutBuffer = "";
  let stderrBuffer = "";
  let readyResolve!: () => void;
  let readyReject!: (error: Error) => void;
  let resultResolve!: (value: WorkerResult) => void;
  let resultReject!: (error: Error) => void;
  const ready = new Promise<void>((resolve, reject) => { readyResolve = resolve; readyReject = reject; });
  const result = new Promise<WorkerResult>((resolve, reject) => { resultResolve = resolve; resultReject = reject; });

  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", chunk => { stderrBuffer += String(chunk); });
  child.stdout.on("data", chunk => {
    stdoutBuffer += String(chunk);
    while (true) {
      const newline = stdoutBuffer.indexOf("\n");
      if (newline < 0) break;
      const line = stdoutBuffer.slice(0, newline).trim();
      stdoutBuffer = stdoutBuffer.slice(newline + 1);
      if (!line) continue;
      try {
        const parsed = JSON.parse(line) as { type?: string } & Partial<WorkerResult>;
        if (parsed.type === "ready") readyResolve();
        if (parsed.type === "result") resultResolve(parsed as WorkerResult);
      } catch {
        // Ignore incidental stdout that is not structured worker evidence.
      }
    }
  });
  child.on("error", error => { readyReject(error); resultReject(error); });
  child.on("exit", code => {
    if (code !== 0) {
      const error = new Error(`worker ${workerId} exited ${code}: ${stderrBuffer.trim()}`);
      readyReject(error);
      resultReject(error);
    }
  });
  return { child, ready, result };
}

if (!process.env.MISSING_POSTGRES_URL && !process.env.DATABASE_URL) throw new Error("Operational Readiness 1 requires PostgreSQL");
await initializeDistributedMoney();
await truncateDistributedMoney();
closeDistributedMoney();

const children = Array.from({ length: workerCount }, (_, workerId) => launchWorker(workerId));
await Promise.all(children.map(item => item.ready));

const startedAt = performance.now();
for (const item of children) item.child.stdin.write("GO\n");
const results = await Promise.all(children.map(item => item.result));
const wallMs = performance.now() - startedAt;

for (const item of children) item.child.stdin.end();

const attempts = results.flatMap(result => result.attempts);
const expectedAttempts = keyCount * contendersPerKey + hotContenders;
const winnersByKey = new Map<string, number>();
for (const attempt of attempts) if (attempt.won) winnersByKey.set(attempt.key, (winnersByKey.get(attempt.key) ?? 0) + 1);

const databaseUrl = process.env.MISSING_POSTGRES_URL ?? process.env.DATABASE_URL!;
const pool = new Pool({ connectionString: databaseUrl, max: 2, application_name: "missing-or1-verifier" });
const countResult = await pool.query(`SELECT COUNT(*)::int AS rows, COUNT(DISTINCT payment_hash)::int AS distinct_payments FROM missing_x402_payments`);
const duplicateResult = await pool.query(`SELECT payment_hash, COUNT(*)::int AS c FROM missing_x402_payments GROUP BY payment_hash HAVING COUNT(*) > 1`);
await pool.end();

const expectedUniquePayments = keyCount + 1;
const dbRows = Number(countResult.rows[0]?.rows ?? 0);
const dbDistinct = Number(countResult.rows[0]?.distinct_payments ?? 0);
const errors = attempts.filter(attempt => attempt.error !== null);
const latencies = attempts.map(attempt => attempt.latency_ms);
const perKeyExactlyOneWinner = winnersByKey.size === expectedUniquePayments && [...winnersByKey.values()].every(value => value === 1);
const throughput = wallMs > 0 ? attempts.length / (wallMs / 1000) : 0;
const poolWaitingMax = Math.max(...results.map(result => result.max_pool_waiting), 0);
const poolTotalMaxPerWorker = Math.max(...results.map(result => result.max_pool_total), 0);

const assertions = {
  expected_attempt_volume_completed: attempts.length === expectedAttempts,
  no_worker_errors: errors.length === 0,
  exactly_one_winner_per_payment_hash: perKeyExactlyOneWinner,
  database_has_exactly_one_row_per_payment_hash: dbRows === expectedUniquePayments && dbDistinct === expectedUniquePayments && duplicateResult.rows.length === 0,
  hot_key_has_exactly_one_winner: winnersByKey.get("hot-key") === 1,
  all_workers_participated: results.length === workerCount && results.every(result => result.attempt_count > 0),
};

const passed = Object.values(assertions).every(Boolean);
const artifact = {
  product: "Operational Readiness 1",
  invariant: "under multi-process PostgreSQL reservation load, each payment hash admits at most one owner and operational latency/throughput are measured reproducibly",
  configuration: { worker_count: workerCount, key_count: keyCount, contenders_per_key: contendersPerKey, hot_contenders: hotContenders, expected_attempts: expectedAttempts },
  measurements: {
    attempts: attempts.length,
    unique_payment_hashes: expectedUniquePayments,
    wall_ms: Number(wallMs.toFixed(3)),
    throughput_attempts_per_second: Number(throughput.toFixed(2)),
    latency_ms: { p50: percentile(latencies, 0.50), p95: percentile(latencies, 0.95), p99: percentile(latencies, 0.99), max: Number(Math.max(...latencies, 0).toFixed(3)) },
    winners: attempts.filter(attempt => attempt.won).length,
    errors: errors.length,
    database_rows: dbRows,
    database_distinct_payments: dbDistinct,
    database_duplicate_payment_hashes: duplicateResult.rows.length,
    max_pool_total_per_worker: poolTotalMaxPerWorker,
    max_pool_waiting_per_worker: poolWaitingMax,
  },
  assertions,
  result: passed ? "GO_OPERATIONAL_LOAD_CONCURRENCY_BASELINE" : "NO_GO_OPERATIONAL_LOAD_CONCURRENCY_BASELINE",
};

await mkdir("artifacts", { recursive: true });
await writeFile("artifacts/operational-readiness-1-load-concurrency-baseline.json", `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ result: artifact.result, assertions, measurements: artifact.measurements }, null, 2));
if (!passed) process.exitCode = 1;
