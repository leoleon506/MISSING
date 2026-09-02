import { Pool, type PoolClient } from "pg";
import { distributedMoneyDatabaseUrl, distributedMoneyEnabled, initializeDistributedMoney } from "./distributedMoney.js";
import { x402SettlementProof, type X402SettlementProof } from "./x402Reconciliation.js";

export interface SettledReorgAuditResult {
  checked: number;
  verified: number;
  quarantined: number;
  unavailable: number;
  skipped: number;
}

let monitorPool: Pool | null = null;
let monitorTimer: ReturnType<typeof setInterval> | null = null;
let monitorRunning = false;
let lastAudit: SettledReorgAuditResult | null = null;
let lastError: string | null = null;

export function settledReorgMonitorEnabled(): boolean {
  return process.env.MISSING_X402_SETTLED_REORG_MONITOR_ENABLED === "1";
}

function positiveInteger(value: string | undefined, fallback: number, minimum: number): number {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= minimum ? parsed : fallback;
}

export function settledReorgMonitorIntervalMs(): number {
  return positiveInteger(process.env.MISSING_X402_SETTLED_REORG_MONITOR_INTERVAL_MS, 60_000, 1_000);
}

export function settledReorgMonitorBatchSize(): number {
  return positiveInteger(process.env.MISSING_X402_SETTLED_REORG_MONITOR_BATCH_SIZE, 100, 1);
}

function pool(): Pool {
  if (monitorPool) return monitorPool;
  const connectionString = distributedMoneyDatabaseUrl();
  if (!connectionString) throw new Error("settled reorg monitor requires PostgreSQL");
  monitorPool = new Pool({
    connectionString,
    max: 2,
    application_name: "missing-x402-settled-reorg-monitor",
  });
  return monitorPool;
}

async function ensureAuditSchema(client: PoolClient) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS missing_x402_settlement_audits (
      payment_hash TEXT PRIMARY KEY,
      transaction_reference TEXT NOT NULL,
      proof_state TEXT NOT NULL,
      reason TEXT,
      block_number TEXT,
      block_hash TEXT,
      confirmations INTEGER,
      required_confirmations INTEGER,
      checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_missing_x402_settlement_audits_checked
      ON missing_x402_settlement_audits(checked_at);
  `);
}

async function recordAudit(client: PoolClient, paymentHash: string, transaction: string, proof: X402SettlementProof) {
  await client.query(
    `INSERT INTO missing_x402_settlement_audits(
      payment_hash,transaction_reference,proof_state,reason,block_number,block_hash,confirmations,required_confirmations,checked_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())
    ON CONFLICT (payment_hash) DO UPDATE SET
      transaction_reference=EXCLUDED.transaction_reference,
      proof_state=EXCLUDED.proof_state,
      reason=EXCLUDED.reason,
      block_number=EXCLUDED.block_number,
      block_hash=EXCLUDED.block_hash,
      confirmations=EXCLUDED.confirmations,
      required_confirmations=EXCLUDED.required_confirmations,
      checked_at=NOW()`,
    [paymentHash, transaction, proof.state, proof.reason ?? null, proof.block_number ?? null, proof.block_hash ?? null,
      proof.confirmations ?? null, proof.required_confirmations ?? null],
  );
}

async function quarantineSettled(client: PoolClient, paymentHash: string, transaction: string, proof: X402SettlementProof): Promise<boolean> {
  const reason = `post_settlement_proof_${proof.state}${proof.reason ? `:${proof.reason}` : ""}`;
  const result = await client.query(
    `UPDATE missing_x402_payments
       SET state='ambiguous', reason=$3, updated_at=NOW(), lease_token=NULL, lease_expires_at=NULL
     WHERE payment_hash=$1 AND state='settled' AND transaction_reference=$2`,
    [paymentHash, transaction, reason],
  );
  return (result.rowCount ?? 0) === 1;
}

export async function auditSettledX402PaymentsOnce(): Promise<SettledReorgAuditResult> {
  if (!distributedMoneyEnabled()) return { checked: 0, verified: 0, quarantined: 0, unavailable: 0, skipped: 0 };
  await initializeDistributedMoney();
  const asset = process.env.MISSING_X402_ASSET?.trim();
  const payTo = process.env.MISSING_X402_PAY_TO?.trim();
  if (!asset || !payTo) throw new Error("settled reorg monitor requires MISSING_X402_ASSET and MISSING_X402_PAY_TO");

  const client = await pool().connect();
  const result: SettledReorgAuditResult = { checked: 0, verified: 0, quarantined: 0, unavailable: 0, skipped: 0 };
  try {
    await ensureAuditSchema(client);
    const rows = await client.query<{
      payment_hash: string;
      transaction_reference: string | null;
      network: string | null;
      customer_price_microusd: string | number | null;
    }>(`
      SELECT p.payment_hash,p.transaction_reference,p.network,p.customer_price_microusd
        FROM missing_x402_payments p
        LEFT JOIN missing_x402_settlement_audits a ON a.payment_hash=p.payment_hash
       WHERE p.state='settled'
       ORDER BY a.checked_at ASC NULLS FIRST, p.updated_at ASC
       LIMIT $1`, [settledReorgMonitorBatchSize()]);

    for (const row of rows.rows) {
      if (!row.transaction_reference || !row.network || row.customer_price_microusd === null) {
        result.skipped += 1;
        continue;
      }
      result.checked += 1;
      const proof = await x402SettlementProof({
        transaction: row.transaction_reference,
        network: row.network,
        asset,
        payTo,
        amount: String(row.customer_price_microusd),
      });
      await recordAudit(client, row.payment_hash, row.transaction_reference, proof);
      if (proof.state === "verified") {
        result.verified += 1;
        continue;
      }
      if (proof.state === "unavailable") {
        // Infrastructure failure is not evidence that the already-settled payment
        // was invalidated. Keep it settled and retry on a later audit cycle.
        result.unavailable += 1;
        continue;
      }
      // A transaction that was already accepted with finality must never return to
      // pending or failed. Either outcome is evidence of a post-settlement chain
      // discontinuity and is quarantined fail-closed without replaying external work.
      if (await quarantineSettled(client, row.payment_hash, row.transaction_reference, proof)) result.quarantined += 1;
    }
    lastAudit = result;
    lastError = null;
    return result;
  } finally {
    client.release();
  }
}

export function settledReorgMonitorSnapshot() {
  return {
    enabled: settledReorgMonitorEnabled(),
    running: monitorRunning,
    interval_ms: settledReorgMonitorIntervalMs(),
    batch_size: settledReorgMonitorBatchSize(),
    last_audit: lastAudit,
    last_error: lastError,
  };
}

export function startSettledX402ReorgMonitor(): () => Promise<void> {
  if (!settledReorgMonitorEnabled() || monitorTimer) return stopSettledX402ReorgMonitor;
  monitorRunning = true;
  const cycle = async () => {
    try {
      await auditSettledX402PaymentsOnce();
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
  };
  void cycle();
  monitorTimer = setInterval(() => { void cycle(); }, settledReorgMonitorIntervalMs());
  monitorTimer.unref?.();
  return stopSettledX402ReorgMonitor;
}

export async function stopSettledX402ReorgMonitor() {
  if (monitorTimer) clearInterval(monitorTimer);
  monitorTimer = null;
  monitorRunning = false;
  const current = monitorPool;
  monitorPool = null;
  if (current) await current.end();
}
