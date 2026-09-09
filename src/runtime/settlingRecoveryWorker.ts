import { randomUUID } from "node:crypto";
import { Pool, type PoolClient } from "pg";
import {
  CURRENT_DISTRIBUTED_RECOVERY_PROTOCOL_VERSION,
  claimDistributedRecovery,
  distributedMoneyDatabaseUrl,
  distributedMoneyEnabled,
  distributedPayment,
  failDistributedPayment,
  initializeDistributedMoney,
  settleDistributedPayment,
  type DistributedPaymentRecord,
} from "./distributedMoney.js";
import { releaseRecoverableDistributedLease } from "./recoverableLease.js";
import { VERIFIED_RECIPES } from "./recipes.js";
import type { ResolveResult } from "./types.js";
import { x402PaymentResponseHeader } from "./x402.js";
import { recordX402Settlement } from "./x402Ledger.js";
import { x402SettlementProof } from "./x402Reconciliation.js";

export interface SettlingRecoveryCycleResult {
  scanned: number;
  claimed: number;
  settled: number;
  pending: number;
  unavailable: number;
  failed: number;
  skipped: number;
}

type CandidateLister = (limit: number) => Promise<string[]>;

let workerPool: Pool | null = null;
let workerTimer: ReturnType<typeof setInterval> | null = null;
let workerRunning = false;
let cycleRunning = false;
let lastCycle: SettlingRecoveryCycleResult | null = null;
let lastError: string | null = null;
let candidateListerOverride: CandidateLister | null = null;

function positiveInteger(value: string | undefined, fallback: number, minimum: number): number {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= minimum ? parsed : fallback;
}

export function settlingRecoveryWorkerEnabled(): boolean {
  return distributedMoneyEnabled() && process.env.MISSING_X402_SETTLING_RECOVERY_ENABLED !== "0";
}

export function settlingRecoveryWorkerIntervalMs(): number {
  return positiveInteger(process.env.MISSING_X402_SETTLING_RECOVERY_INTERVAL_MS, 5_000, 1_000);
}

export function settlingRecoveryWorkerBatchSize(): number {
  return positiveInteger(process.env.MISSING_X402_SETTLING_RECOVERY_BATCH_SIZE, 25, 1);
}

/** Test-only candidate source. Production always scans PostgreSQL. */
export function configureSettlingRecoveryCandidateListerForTest(fn?: CandidateLister) {
  candidateListerOverride = fn ?? null;
}

function pool(): Pool {
  if (workerPool) return workerPool;
  const connectionString = distributedMoneyDatabaseUrl();
  if (!connectionString) throw new Error("settling recovery worker requires PostgreSQL");
  workerPool = new Pool({
    connectionString,
    max: 1,
    application_name: "missing-x402-settling-recovery-worker",
  });
  return workerPool;
}

async function postgresCandidates(limit: number): Promise<string[]> {
  const client = await pool().connect();
  try {
    const result = await client.query<{ payment_hash: string }>(`
      SELECT payment_hash
        FROM missing_x402_payments
       WHERE state='settling'
         AND transaction_reference IS NOT NULL
         AND request_hash IS NOT NULL
         AND recovery_protocol_version=$1
         AND (lease_expires_at IS NULL OR lease_expires_at <= NOW())
       ORDER BY updated_at ASC
       LIMIT $2
    `, [CURRENT_DISTRIBUTED_RECOVERY_PROTOCOL_VERSION, limit]);
    return result.rows.map(row => row.payment_hash);
  } finally {
    client.release();
  }
}

async function candidatePaymentHashes(limit: number): Promise<string[]> {
  return candidateListerOverride ? candidateListerOverride(limit) : postgresCandidates(limit);
}

function reconstructedResponse(record: DistributedPaymentRecord) {
  if (!record.transaction_reference || record.customer_price_microusd === null || !record.resolution_json) return null;
  let resolution: ResolveResult;
  try {
    resolution = JSON.parse(record.resolution_json) as ResolveResult;
  } catch {
    return null;
  }
  if (resolution.status !== "resolved") return null;

  const settlement = {
    success: true,
    transaction: record.transaction_reference,
    network: record.network ?? undefined,
  };
  const headers = {
    "PAYMENT-RESPONSE": x402PaymentResponseHeader(settlement),
    "Cache-Control": "private, no-store",
  };
  const body = {
    status: "resolved",
    payment: {
      rail: "x402",
      settled: true,
      amount_microusd: record.customer_price_microusd,
      transaction: record.transaction_reference,
      provider_attempts: record.provider_attempts ?? 0,
      provider_cost_microusd: record.provider_cost_microusd,
      unknown_provider_cost_attempts: record.unknown_provider_cost_attempts ?? 0,
      realized_gross_margin_microusd: record.gross_margin_microusd,
    },
    resolution,
  };
  return { settlement, headers, body, resolution };
}

async function releaseLease(record: DistributedPaymentRecord, leaseToken: string, leaseFence: number) {
  try {
    await releaseRecoverableDistributedLease({
      paymentHash: record.payment_hash,
      executionId: record.execution_id,
      leaseToken,
      leaseFence,
    });
  } catch {
    // Lease expiry remains a safe fallback. A failed release cannot authorize a
    // second owner because every authoritative mutation is fence-checked.
  }
}

export type SettlingRecoveryOutcome = "settled" | "pending" | "unavailable" | "failed" | "skipped";

/**
 * Reconcile one already-observed settlement transaction without invoking the
 * facilitator or provider again. The durable request binding and recovery
 * protocol are revalidated by claimDistributedRecovery(), then the canonical
 * on-chain proof gates the only terminal state transition.
 */
export async function recoverKnownSettlingX402Payment(paymentHash: string): Promise<SettlingRecoveryOutcome> {
  if (!settlingRecoveryWorkerEnabled()) return "skipped";
  const prior = await distributedPayment(paymentHash);
  if (!prior || prior.state !== "settling" || !prior.transaction_reference || !prior.request_hash) return "skipped";

  const leaseToken = randomUUID();
  const claim = await claimDistributedRecovery({
    paymentHash: prior.payment_hash,
    requestHash: prior.request_hash,
    leaseToken,
  });
  if (!claim.claimed || !claim.record || !claim.leaseFence) return "skipped";

  const record = claim.record;
  const leaseFence = claim.leaseFence;
  const asset = process.env.MISSING_X402_ASSET?.trim();
  const payTo = process.env.MISSING_X402_PAY_TO?.trim();
  if (
    record.state !== "settling"
    || !record.transaction_reference
    || !record.network
    || record.customer_price_microusd === null
    || !asset
    || !payTo
  ) {
    await releaseLease(record, leaseToken, leaseFence);
    return "skipped";
  }

  let proof;
  try {
    proof = await x402SettlementProof({
      transaction: record.transaction_reference,
      network: record.network,
      asset,
      payTo,
      amount: String(record.customer_price_microusd),
    });
  } catch {
    await releaseLease(record, leaseToken, leaseFence);
    return "unavailable";
  }

  if (proof.state === "pending") {
    await releaseLease(record, leaseToken, leaseFence);
    return "pending";
  }
  if (proof.state === "unavailable") {
    await releaseLease(record, leaseToken, leaseFence);
    return "unavailable";
  }
  if (proof.state === "failed") {
    const failed = await failDistributedPayment({
      paymentHash: record.payment_hash,
      executionId: record.execution_id,
      reason: `settlement_proof_${proof.reason ?? "failed"}`,
      from: "settling",
      leaseToken,
      leaseFence,
    });
    if (!failed.changed) await releaseLease(record, leaseToken, leaseFence);
    return failed.changed ? "failed" : "skipped";
  }

  const reconstructed = reconstructedResponse(record);
  if (!reconstructed) {
    await releaseLease(record, leaseToken, leaseFence);
    return "skipped";
  }

  const committed = await settleDistributedPayment({
    paymentHash: record.payment_hash,
    executionId: record.execution_id,
    transactionReference: record.transaction_reference,
    responseStatus: 200,
    responseHeaders: reconstructed.headers,
    responseBody: reconstructed.body,
    leaseToken,
    leaseFence,
  });
  if (!committed.changed) {
    const latest = await distributedPayment(record.payment_hash);
    if (latest?.state === "settled") return "settled";
    await releaseLease(record, leaseToken, leaseFence);
    return "skipped";
  }

  const fingerprint = record.provider_recipe_fingerprint ?? reconstructed.resolution.recipe_fingerprint;
  const recipe = VERIFIED_RECIPES.find(item => item.recipe_fingerprint === fingerprint) ?? null;
  if (recipe) {
    try {
      recordX402Settlement({
        paymentHash: record.payment_hash,
        transactionReference: record.transaction_reference,
        network: record.network ?? undefined,
        capability: record.capability,
        recipe,
        customerPriceMicrousd: record.customer_price_microusd,
        realizedProviderCostMicrousd: record.provider_cost_microusd,
      });
    } catch {
      // Settlement is already durably committed. Startup telemetry reconciliation
      // will backfill an event if local telemetry persistence was unavailable.
    }
  }
  return "settled";
}

export async function runSettlingRecoveryCycleOnce(): Promise<SettlingRecoveryCycleResult> {
  const result: SettlingRecoveryCycleResult = {
    scanned: 0,
    claimed: 0,
    settled: 0,
    pending: 0,
    unavailable: 0,
    failed: 0,
    skipped: 0,
  };
  if (!settlingRecoveryWorkerEnabled()) return result;
  await initializeDistributedMoney();

  const hashes = await candidatePaymentHashes(settlingRecoveryWorkerBatchSize());
  result.scanned = hashes.length;
  for (const paymentHash of hashes) {
    const before = await distributedPayment(paymentHash);
    const outcome = await recoverKnownSettlingX402Payment(paymentHash);
    if (before?.state === "settling" && outcome !== "skipped") result.claimed += 1;
    result[outcome] += 1;
  }
  lastCycle = result;
  lastError = null;
  return result;
}

export function settlingRecoveryWorkerSnapshot() {
  return {
    enabled: settlingRecoveryWorkerEnabled(),
    running: workerRunning,
    interval_ms: settlingRecoveryWorkerIntervalMs(),
    batch_size: settlingRecoveryWorkerBatchSize(),
    last_cycle: lastCycle,
    last_error: lastError,
  };
}

export function startSettlingX402RecoveryWorker(): () => Promise<void> {
  if (!settlingRecoveryWorkerEnabled() || workerTimer) return stopSettlingX402RecoveryWorker;
  workerRunning = true;
  const cycle = async () => {
    if (cycleRunning) return;
    cycleRunning = true;
    try {
      await runSettlingRecoveryCycleOnce();
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    } finally {
      cycleRunning = false;
    }
  };
  void cycle();
  workerTimer = setInterval(() => { void cycle(); }, settlingRecoveryWorkerIntervalMs());
  workerTimer.unref?.();
  return stopSettlingX402RecoveryWorker;
}

export async function stopSettlingX402RecoveryWorker() {
  if (workerTimer) clearInterval(workerTimer);
  workerTimer = null;
  workerRunning = false;
  cycleRunning = false;
  candidateListerOverride = null;
  const current = workerPool;
  workerPool = null;
  if (current) await current.end();
}
