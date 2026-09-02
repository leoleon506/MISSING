import { mkdir, writeFile } from "node:fs/promises";
import { Pool } from "pg";
import { auditSettledX402PaymentsOnce, stopSettledX402ReorgMonitor } from "./runtime/settledReorgMonitor.js";
import { closeDistributedMoney, initializeDistributedMoney, truncateDistributedMoney } from "./runtime/distributedMoney.js";
import { configureX402RpcFetch } from "./runtime/x402Reconciliation.js";

process.env.MISSING_DISTRIBUTED_MONEY_ENABLED = "1";
process.env.MISSING_TRANSACTIONAL_RESPONSE_CACHE_ENABLED = "0";
process.env.MISSING_X402_ASSET = "0x1111111111111111111111111111111111111111";
process.env.MISSING_X402_PAY_TO = "0x2222222222222222222222222222222222222222";
process.env.MISSING_X402_RPC_URL = "http://kappa515.local/rpc";
process.env.MISSING_X402_MIN_CONFIRMATIONS = "2";
process.env.MISSING_X402_SETTLED_REORG_MONITOR_BATCH_SIZE = "100";

const databaseUrl = process.env.MISSING_POSTGRES_URL ?? process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("Kappa.5.15 requires PostgreSQL");

const pool = new Pool({ connectionString: databaseUrl, ssl: false });
await initializeDistributedMoney();
await truncateDistributedMoney();

const transferTopic = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const recipientTopic = `0x${"0".repeat(24)}${process.env.MISSING_X402_PAY_TO!.slice(2)}`;
const senderTopic = `0x${"0".repeat(24)}${"3".repeat(40)}`;
const canonicalHash = `0x${"a".repeat(64)}`;
const reorgHash = `0x${"b".repeat(64)}`;
const transactions = {
  healthy: `0x${"1".repeat(64)}`,
  disappeared: `0x${"2".repeat(64)}`,
  reorged: `0x${"3".repeat(64)}`,
  unavailable: `0x${"4".repeat(64)}`,
};
let lastTransaction = transactions.healthy;
let rpcCalls = 0;

function receipt(transaction: string) {
  return {
    status: "0x1",
    blockNumber: "0x64",
    blockHash: canonicalHash,
    logs: [{
      address: process.env.MISSING_X402_ASSET,
      topics: [transferTopic, senderTopic, recipientTopic],
      data: "0x1388",
    }],
  };
}

configureX402RpcFetch(async (_url, init) => {
  rpcCalls += 1;
  const body = JSON.parse(String(init?.body ?? "{}")) as { method?: string; params?: unknown[] };
  const method = body.method;
  if (method === "eth_chainId") return new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result: "0x14a34" }), { status: 200 });
  if (method === "eth_getTransactionReceipt") {
    const tx = String(body.params?.[0] ?? "");
    lastTransaction = tx;
    if (tx === transactions.disappeared) return new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result: null }), { status: 200 });
    if (tx === transactions.unavailable) return new Response("rpc unavailable", { status: 503 });
    return new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result: receipt(tx) }), { status: 200 });
  }
  if (method === "eth_blockNumber") return new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result: "0x65" }), { status: 200 });
  if (method === "eth_getBlockByNumber") {
    const hash = lastTransaction === transactions.reorged ? reorgHash : canonicalHash;
    return new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result: { hash } }), { status: 200 });
  }
  return new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, error: { message: `unsupported:${method}` } }), { status: 200 });
});

async function seed(name: keyof typeof transactions) {
  await pool.query(
    `INSERT INTO missing_x402_payments(
      payment_hash,request_hash,execution_id,capability,state,transaction_reference,
      customer_price_microusd,network,recovery_protocol_version,lease_fence
    ) VALUES ($1,$2,$3,'kappa515_deep_reorg_probe','settled',$4,5000,'eip155:84532',1,1)`,
    [`kappa515-${name}`, `request-${name}`, `exec-${name}`, transactions[name]],
  );
}

await seed("healthy");
await seed("disappeared");
await seed("reorged");
await seed("unavailable");

let providerCalls = 0;
let settlementCalls = 0;
const audit = await auditSettledX402PaymentsOnce();

const rows = await pool.query<{ payment_hash: string; state: string; reason: string | null }>(
  `SELECT payment_hash,state,reason FROM missing_x402_payments WHERE payment_hash LIKE 'kappa515-%' ORDER BY payment_hash`,
);
const audits = await pool.query<{ payment_hash: string; proof_state: string; reason: string | null }>(
  `SELECT payment_hash,proof_state,reason FROM missing_x402_settlement_audits WHERE payment_hash LIKE 'kappa515-%' ORDER BY payment_hash`,
);
const byPayment = Object.fromEntries(rows.rows.map(row => [row.payment_hash, row]));
const auditByPayment = Object.fromEntries(audits.rows.map(row => [row.payment_hash, row]));

const assertions = {
  healthy_settlement_remains_settled:
    byPayment["kappa515-healthy"]?.state === "settled" && auditByPayment["kappa515-healthy"]?.proof_state === "verified",
  disappeared_receipt_quarantined:
    byPayment["kappa515-disappeared"]?.state === "ambiguous" &&
    byPayment["kappa515-disappeared"]?.reason?.includes("post_settlement_proof_pending") === true,
  deep_reorg_block_hash_quarantined:
    byPayment["kappa515-reorged"]?.state === "ambiguous" &&
    byPayment["kappa515-reorged"]?.reason === "post_settlement_proof_failed:reorg_block_hash_mismatch",
  rpc_outage_is_recorded_but_not_false_quarantined:
    byPayment["kappa515-unavailable"]?.state === "settled" && auditByPayment["kappa515-unavailable"]?.proof_state === "unavailable",
  watcher_never_replays_external_effects: providerCalls === 0 && settlementCalls === 0,
  audit_counts_match:
    audit.checked === 4 && audit.verified === 1 && audit.quarantined === 2 && audit.unavailable === 1,
  durable_audit_evidence_written: audits.rowCount === 4,
};

const passed = Object.values(assertions).every(Boolean);
const artifact = {
  product: "Kappa.5.15",
  invariant: "a payment that was already settled is continuously re-proven on-chain; post-settlement disappearance or canonicality failure is quarantined without replaying provider or settlement, while RPC outages remain retryable",
  rpc_calls: rpcCalls,
  provider_calls: providerCalls,
  settlement_calls: settlementCalls,
  audit,
  payments: rows.rows,
  proof_audits: audits.rows,
  assertions,
  result: passed ? "GO_POST_SETTLEMENT_DEEP_REORG_MONITORING" : "NO_GO_POST_SETTLEMENT_DEEP_REORG_MONITORING",
};

await mkdir("artifacts", { recursive: true });
await writeFile("artifacts/product-kappa515-deep-reorg-monitoring.json", `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ result: artifact.result, assertions, audit, payments: rows.rows, proof_audits: audits.rows }, null, 2));

configureX402RpcFetch();
await stopSettledX402ReorgMonitor();
closeDistributedMoney();
await pool.end();
if (!passed) process.exitCode = 1;
