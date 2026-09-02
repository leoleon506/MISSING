import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import {
  closeDistributedMoney,
  distributedPayment,
  initializeDistributedMoney,
  truncateDistributedMoney,
} from "./runtime/distributedMoney.js";

process.env.MISSING_AGENT_PAYMENTS_ENABLED = "1";
process.env.MISSING_DISTRIBUTED_MONEY_ENABLED = "1";
process.env.MISSING_TRANSACTIONAL_RESPONSE_CACHE_ENABLED = "0";
process.env.MISSING_X402_RECOVERY_LEASE_MS = "500";
process.env.MISSING_X402_LEASE_HEARTBEAT_MS = "75";
process.env.MISSING_X402_ENABLED = "1";
process.env.MISSING_X402_FACILITATOR_IDEMPOTENCY = "1";
process.env.MISSING_X402_NETWORK = "eip155:84532";
process.env.MISSING_X402_ASSET = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
process.env.MISSING_X402_PAY_TO = "0x209693Bc6afc0C5328bA36FaF03C514EF312287C";
process.env.MISSING_X402_MIN_CONFIRMATIONS = "2";

const leaseMs = 500;
const earlyRetryMs = 100;
const recoveryWaitMs = 700;
const capability = "kappa513_known_tx_restart";
const paymentSignature = Buffer.from(JSON.stringify({ payment: capability }), "utf8").toString("base64url");
const paymentHash = createHash("sha256").update(paymentSignature, "utf8").digest("hex");
const asset = process.env.MISSING_X402_ASSET!;
const payTo = process.env.MISSING_X402_PAY_TO!;
const from = "0x1111111111111111111111111111111111111111";
const blockHash = `0x${"b".repeat(64)}`;
const transferTopic = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const topic = (address: string) => `0x${"0".repeat(24)}${address.slice(2).toLowerCase()}`;
const word = (value: bigint) => `0x${value.toString(16).padStart(64, "0")}`;
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

let providerCalls = 0;
let providerEffects = 0;
const providerKeys = new Set<string>();
const provider = createServer(async (req, res) => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  const body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}") as { scenario?: string };
  const key = String(req.headers["idempotency-key"] ?? "");
  providerCalls += 1;
  if (!key) {
    res.statusCode = 400;
    res.end(JSON.stringify({ error: "missing idempotency key" }));
    return;
  }
  if (!providerKeys.has(key)) {
    providerKeys.add(key);
    providerEffects += 1;
  }
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify({ ok: true, scenario: String(body.scenario ?? capability) }));
});
await new Promise<void>(resolve => provider.listen(0, "127.0.0.1", resolve));
const providerAddress = provider.address();
if (!providerAddress || typeof providerAddress === "string") throw new Error("unable to bind provider");
const providerBaseUrl = `http://127.0.0.1:${providerAddress.port}`;

let verifyCalls = 0;
let settleCalls = 0;
let settleEffects = 0;
const settlementTransactions = new Map<string, string>();
const facilitator = createServer(async (req, res) => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  if (req.url === "/verify") {
    verifyCalls += 1;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ isValid: true, payer: from }));
    return;
  }
  if (req.url !== "/settle") {
    res.statusCode = 404;
    res.end();
    return;
  }
  settleCalls += 1;
  const key = String(req.headers["idempotency-key"] ?? "");
  if (!key) {
    res.statusCode = 400;
    res.end(JSON.stringify({ error: "missing settlement idempotency" }));
    return;
  }
  let transaction = settlementTransactions.get(key);
  if (!transaction) {
    transaction = `0x${createHash("sha256").update(`kappa513:${key}`).digest("hex")}`;
    settlementTransactions.set(key, transaction);
    settleEffects += 1;
  }
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify({ success: true, transaction, network: process.env.MISSING_X402_NETWORK }));
});
await new Promise<void>(resolve => facilitator.listen(0, "127.0.0.1", resolve));
const facilitatorAddress = facilitator.address();
if (!facilitatorAddress || typeof facilitatorAddress === "string") throw new Error("unable to bind facilitator");
process.env.MISSING_X402_FACILITATOR_URL = `http://127.0.0.1:${facilitatorAddress.port}`;

let rpcCalls = 0;
const rpcMethods: string[] = [];
const rpc = createServer(async (req, res) => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  rpcCalls += 1;
  rpcMethods.push(String(body.method));
  let result: unknown;
  if (body.method === "eth_chainId") result = "0x14a34";
  else if (body.method === "eth_blockNumber") result = "0x65";
  else if (body.method === "eth_getBlockByNumber") result = { hash: blockHash };
  else if (body.method === "eth_getTransactionReceipt") {
    result = {
      status: "0x1",
      blockNumber: "0x64",
      blockHash,
      logs: [{ address: asset, topics: [transferTopic, topic(from), topic(payTo)], data: word(5000n), logIndex: "0x0" }],
    };
  } else {
    res.statusCode = 500;
    res.end(JSON.stringify({ error: `unexpected method ${body.method}` }));
    return;
  }
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify({ jsonrpc: "2.0", id: body.id ?? 1, result }));
});
await new Promise<void>(resolve => rpc.listen(0, "127.0.0.1", resolve));
const rpcAddress = rpc.address();
if (!rpcAddress || typeof rpcAddress === "string") throw new Error("unable to bind RPC");
process.env.MISSING_X402_RPC_URL = `http://127.0.0.1:${rpcAddress.port}`;

function worker(crash: boolean, expectedExit = 0) {
  return new Promise<{ code: number; stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(process.execPath, ["--import", "tsx", "src/experimentKappa513Worker.ts", capability, paymentSignature, providerBaseUrl, crash ? "1" : "0"], {
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", chunk => { stdout += String(chunk); });
    child.stderr.on("data", chunk => { stderr += String(chunk); });
    child.on("error", reject);
    child.on("exit", code => {
      const actual = code ?? -1;
      if (actual !== expectedExit) reject(new Error(`worker exited ${actual}, expected ${expectedExit}: ${stderr}\n${stdout}`));
      else resolve({ code: actual, stdout, stderr });
    });
  });
}

function parsed(stdout: string) {
  return JSON.parse(stdout.trim()) as { status: number; body: any };
}

await initializeDistributedMoney();
await truncateDistributedMoney();

await worker(true, 94);
const afterCrash = await distributedPayment(paymentHash);
const rpcAfterCrash = rpcCalls;
const providerAfterCrash = { calls: providerCalls, effects: providerEffects };
const settlementAfterCrash = { calls: settleCalls, effects: settleEffects };

await sleep(earlyRetryMs);
const early = parsed((await worker(false)).stdout);
const afterEarly = await distributedPayment(paymentHash);
const rpcAfterEarly = rpcCalls;

await sleep(recoveryWaitMs);
const recovered = parsed((await worker(false)).stdout);
const final = await distributedPayment(paymentHash);

const transaction = afterCrash?.transaction_reference ?? null;
const providerStable = providerCalls === providerAfterCrash.calls && providerEffects === providerAfterCrash.effects;
const facilitatorStable = settleCalls === settlementAfterCrash.calls && settleEffects === settlementAfterCrash.effects;
const earlyBlocked = early.status === 503 && early.body?.error === "payment_in_progress";
const noRpcBeforeOwnership = rpcAfterCrash === 0 && rpcAfterEarly === 0;
const ownedTakeover = afterCrash?.lease_fence === 1 && afterEarly?.lease_fence === 1 && final?.lease_fence === 2;
const exactRecovery = recovered.status === 200 && final?.state === "settled" && Boolean(transaction) && final.transaction_reference === transaction && rpcCalls > 0;

const evidence = {
  product: "Kappa.5.13",
  invariant: "a durable known settlement transaction is reconciled only by a verified process that owns the current recovery lease/fence",
  lease_ms: leaseMs,
  early_retry_ms: earlyRetryMs,
  recovery_wait_ms: recoveryWaitMs,
  after_crash: {
    state: afterCrash?.state ?? null,
    transaction_reference: transaction,
    lease_fence: afterCrash?.lease_fence ?? null,
    provider_calls: providerAfterCrash.calls,
    provider_effects: providerAfterCrash.effects,
    facilitator_calls: settlementAfterCrash.calls,
    facilitator_effects: settlementAfterCrash.effects,
    rpc_calls: rpcAfterCrash,
  },
  early_retry: {
    status: early.status,
    error: early.body?.error ?? null,
    state: afterEarly?.state ?? null,
    lease_fence: afterEarly?.lease_fence ?? null,
    rpc_calls: rpcAfterEarly,
  },
  recovered: {
    status: recovered.status,
    final_state: final?.state ?? null,
    final_fence: final?.lease_fence ?? null,
    transaction_reference: final?.transaction_reference ?? null,
    provider_calls: providerCalls,
    provider_effects: providerEffects,
    facilitator_calls: settleCalls,
    facilitator_effects: settleEffects,
    verify_calls: verifyCalls,
    rpc_calls: rpcCalls,
    rpc_methods: rpcMethods,
  },
  assertions: {
    crash_left_known_tx_settling: afterCrash?.state === "settling" && Boolean(transaction),
    no_chain_rpc_before_owned_recovery: noRpcBeforeOwnership,
    early_retry_blocked_while_lease_live: earlyBlocked,
    takeover_advanced_fence: ownedTakeover,
    provider_not_replayed: providerStable && providerCalls === 1 && providerEffects === 1,
    facilitator_not_replayed: facilitatorStable && settleCalls === 1 && settleEffects === 1,
    owned_chain_reconciliation_settled: exactRecovery,
  },
};
const passed = Object.values(evidence.assertions).every(Boolean);
const artifact = { ...evidence, result: passed ? "GO_OWNED_KNOWN_TX_RECONCILIATION" : "NO_GO_OWNED_KNOWN_TX_RECONCILIATION" };
await mkdir("artifacts", { recursive: true });
await writeFile("artifacts/product-kappa513-owned-known-tx-reconciliation.json", `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ result: artifact.result, assertions: artifact.assertions, recovered: artifact.recovered }, null, 2));

closeDistributedMoney();
provider.close();
facilitator.close();
rpc.close();
if (!passed) process.exitCode = 1;
