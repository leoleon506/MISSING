import { createHash, randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import {
  claimDistributedRecovery,
  closeDistributedMoney,
  distributedPayment,
  initializeDistributedMoney,
  truncateDistributedMoney,
} from "./runtime/distributedMoney.js";

const leaseMs = 500;
const heartbeatMs = 75;
const longOperationMs = 2_000;
const takeoverProbeMs = 900;
const crashRecoveryWaitMs = 750;

process.env.MISSING_AGENT_PAYMENTS_ENABLED = "1";
process.env.MISSING_DISTRIBUTED_MONEY_ENABLED = "1";
process.env.MISSING_TRANSACTIONAL_RESPONSE_CACHE_ENABLED = "0";
process.env.MISSING_X402_RECOVERY_LEASE_MS = String(leaseMs);
process.env.MISSING_X402_LEASE_HEARTBEAT_MS = String(heartbeatMs);
process.env.MISSING_X402_ENABLED = "1";
process.env.MISSING_X402_NETWORK = "eip155:84532";
process.env.MISSING_X402_ASSET = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
process.env.MISSING_X402_PAY_TO = "0x209693Bc6afc0C5328bA36FaF03C514EF312287C";
process.env.MISSING_X402_MIN_CONFIRMATIONS = "2";

const asset = process.env.MISSING_X402_ASSET!;
const payTo = process.env.MISSING_X402_PAY_TO!;
const transferTopic = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const from = "0x1111111111111111111111111111111111111111";
const blockHash = `0x${"b".repeat(64)}`;
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const topic = (address: string) => `0x${"0".repeat(24)}${address.slice(2).toLowerCase()}`;
const word = (value: bigint) => `0x${value.toString(16).padStart(64, "0")}`;
const signature = (name: string) => Buffer.from(JSON.stringify({ payment: `kappa511-${name}` }), "utf8").toString("base64url");
const hashOf = (value: string) => createHash("sha256").update(value, "utf8").digest("hex");

const providerCalls = new Map<string, number>();
const providerEffects = new Map<string, number>();
const providerKeys = new Set<string>();
let providerDelayMs = 0;
let settlementDelayMs = 0;
let settlementEffects = 0;

const provider = createServer(async (req, res) => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  const body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}") as { scenario?: string };
  const scenario = String(body.scenario ?? "unknown");
  const key = String(req.headers["idempotency-key"] ?? "");
  providerCalls.set(scenario, (providerCalls.get(scenario) ?? 0) + 1);
  if (providerDelayMs) await sleep(providerDelayMs);
  if (key && !providerKeys.has(key)) {
    providerKeys.add(key);
    providerEffects.set(scenario, (providerEffects.get(scenario) ?? 0) + 1);
  }
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify({ ok: true, scenario }));
});
await new Promise<void>(resolve => provider.listen(0, "127.0.0.1", resolve));
const providerAddress = provider.address();
if (!providerAddress || typeof providerAddress === "string") throw new Error("unable to bind provider");
const providerBaseUrl = `http://127.0.0.1:${providerAddress.port}`;

const settlementTransactions = new Map<string, string>();
const facilitator = createServer(async (req, res) => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  if (req.url === "/verify") {
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ isValid: true, payer: from }));
    return;
  }
  if (req.url !== "/settle") {
    res.statusCode = 404;
    res.end();
    return;
  }
  const key = String(req.headers["idempotency-key"] ?? "");
  if (settlementDelayMs) await sleep(settlementDelayMs);
  let transaction = settlementTransactions.get(key);
  if (!transaction) {
    transaction = `0x${createHash("sha256").update(`tx:${key}`).digest("hex")}`;
    settlementTransactions.set(key, transaction);
    settlementEffects += 1;
  }
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify({ success: true, transaction, network: process.env.MISSING_X402_NETWORK }));
});
await new Promise<void>(resolve => facilitator.listen(0, "127.0.0.1", resolve));
const facilitatorAddress = facilitator.address();
if (!facilitatorAddress || typeof facilitatorAddress === "string") throw new Error("unable to bind facilitator");
process.env.MISSING_X402_FACILITATOR_URL = `http://127.0.0.1:${facilitatorAddress.port}`;

const rpc = createServer(async (req, res) => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
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

function worker(capability: string, paymentSignature: string, crash = false, expectedExit = 0) {
  const started = Date.now();
  return new Promise<{ code: number; stdout: string; stderr: string; duration_ms: number }>((resolve, reject) => {
    const child = spawn(process.execPath, ["--import", "tsx", "src/experimentKappa511Worker.ts", capability, paymentSignature, providerBaseUrl, crash ? "1" : "0"], {
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
      else resolve({ code: actual, stdout, stderr, duration_ms: Date.now() - started });
    });
  });
}

function parsed(stdout: string) {
  return JSON.parse(stdout.trim()) as { status: number; body: any };
}

await initializeDistributedMoney();
await truncateDistributedMoney();

const evidence: any = {
  product: "Kappa.5.11",
  invariant: "production distributed owners carry the exact fence generation and renew leases during legitimate long provider and settlement operations",
  lease_ms: leaseMs,
  heartbeat_ms: heartbeatMs,
  long_operation_ms: longOperationMs,
  takeover_probe_ms: takeoverProbeMs,
  crash_recovery_wait_ms: crashRecoveryWaitMs,
  scenarios: [],
};

// 1) Provider latency spans four lease TTLs. Ownership must remain on fence 1 throughout.
{
  const capability = "kappa511_slow_provider";
  const paymentSignature = signature(capability);
  providerDelayMs = longOperationMs;
  settlementDelayMs = 0;
  const result = await worker(capability, paymentSignature);
  const response = parsed(result.stdout);
  const row = await distributedPayment(hashOf(paymentSignature));
  evidence.scenarios.push({
    name: "slow_provider_heartbeat_keeps_fence",
    duration_ms: result.duration_ms,
    response_status: response.status,
    provider_calls: providerCalls.get(capability) ?? 0,
    provider_effects: providerEffects.get(capability) ?? 0,
    final_state: row?.state ?? null,
    final_fence: row?.lease_fence ?? null,
    pass: result.duration_ms > longOperationMs && response.status === 200 && (providerCalls.get(capability) ?? 0) === 1 && (providerEffects.get(capability) ?? 0) === 1 && row?.state === "settled" && row.lease_fence === 1,
  });
}

// 2) Settlement latency also spans four lease TTLs and must retain the same fence.
{
  const capability = "kappa511_slow_settlement";
  const paymentSignature = signature(capability);
  providerDelayMs = 0;
  settlementDelayMs = longOperationMs;
  const beforeEffects = settlementEffects;
  const result = await worker(capability, paymentSignature);
  const response = parsed(result.stdout);
  const row = await distributedPayment(hashOf(paymentSignature));
  evidence.scenarios.push({
    name: "slow_settlement_heartbeat_keeps_fence",
    duration_ms: result.duration_ms,
    response_status: response.status,
    settlement_effects: settlementEffects - beforeEffects,
    final_state: row?.state ?? null,
    final_fence: row?.lease_fence ?? null,
    pass: result.duration_ms > longOperationMs && response.status === 200 && settlementEffects - beforeEffects === 1 && row?.state === "settled" && row.lease_fence === 1,
  });
}

// 3) Probe well after the original TTL. Without heartbeat the lease would be claimable; with heartbeat takeover must fail.
{
  const capability = "kappa511_takeover_blocked";
  const paymentSignature = signature(capability);
  const paymentHash = hashOf(paymentSignature);
  providerDelayMs = longOperationMs;
  settlementDelayMs = 0;
  const running = worker(capability, paymentSignature);
  await sleep(takeoverProbeMs);
  const attempted = await claimDistributedRecovery({ paymentHash, requestHash: (await distributedPayment(paymentHash))?.request_hash ?? "", leaseToken: randomUUID() });
  const result = await running;
  const response = parsed(result.stdout);
  const row = await distributedPayment(paymentHash);
  evidence.scenarios.push({
    name: "heartbeat_blocks_premature_takeover",
    takeover_claimed: attempted.claimed,
    probe_after_original_ttl: takeoverProbeMs > leaseMs,
    response_status: response.status,
    final_state: row?.state ?? null,
    final_fence: row?.lease_fence ?? null,
    pass: takeoverProbeMs > leaseMs && attempted.claimed === false && response.status === 200 && row?.state === "settled" && row.lease_fence === 1,
  });
}

// 4) Process death stops heartbeat. After more than one TTL another replica must claim fence 2.
{
  const capability = "kappa511_crashed_owner_takeover";
  const paymentSignature = signature(capability);
  const paymentHash = hashOf(paymentSignature);
  providerDelayMs = 0;
  settlementDelayMs = 0;
  await worker(capability, paymentSignature, true, 92);
  const before = await distributedPayment(paymentHash);
  await sleep(crashRecoveryWaitMs);
  const claimed = await claimDistributedRecovery({ paymentHash, requestHash: before?.request_hash ?? "", leaseToken: randomUUID() });
  const row = await distributedPayment(paymentHash);
  evidence.scenarios.push({
    name: "heartbeat_stops_on_process_death_and_takeover_advances_fence",
    prior_state: before?.state ?? null,
    prior_fence: before?.lease_fence ?? null,
    waited_beyond_ttl: crashRecoveryWaitMs > leaseMs,
    takeover_claimed: claimed.claimed,
    takeover_fence: claimed.leaseFence,
    final_fence: row?.lease_fence ?? null,
    pass: crashRecoveryWaitMs > leaseMs && before?.state === "executing" && before.lease_fence === 1 && claimed.claimed === true && claimed.leaseFence === 2 && row?.lease_fence === 2,
  });
}

const passed = evidence.scenarios.every((scenario: any) => scenario.pass === true);
evidence.result = passed ? "GO_PRODUCTION_FENCE_HEARTBEAT" : "NO_GO_PRODUCTION_FENCE_HEARTBEAT";
await mkdir("artifacts", { recursive: true });
await writeFile("artifacts/product-kappa511-production-fence-heartbeat.json", `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ result: evidence.result, scenarios: evidence.scenarios }, null, 2));

closeDistributedMoney();
provider.close();
facilitator.close();
rpc.close();
if (!passed) process.exitCode = 1;
