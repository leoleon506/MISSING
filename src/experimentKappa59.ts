import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import {
  closeDistributedMoney,
  distributedPayment,
  initializeDistributedMoney,
  truncateDistributedMoney,
} from "./runtime/distributedMoney.js";
import { agentRequestHash } from "./runtime/requestBinding.js";
import { stableSettlementIntentId } from "./runtime/recoveryPolicy.js";

process.env.MISSING_AGENT_PAYMENTS_ENABLED = "1";
process.env.MISSING_DISTRIBUTED_MONEY_ENABLED = "1";
process.env.MISSING_TRANSACTIONAL_RESPONSE_CACHE_ENABLED = "0";
process.env.MISSING_X402_RECOVERY_LEASE_MS = "100";
process.env.MISSING_X402_ENABLED = "1";
process.env.MISSING_X402_NETWORK = "eip155:84532";
process.env.MISSING_X402_ASSET = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
process.env.MISSING_X402_PAY_TO = "0x209693Bc6afc0C5328bA36FaF03C514EF312287C";
process.env.MISSING_X402_MIN_CONFIRMATIONS = "2";

const asset = process.env.MISSING_X402_ASSET;
const payTo = process.env.MISSING_X402_PAY_TO;
const transferTopic = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const from = "0x1111111111111111111111111111111111111111";
const blockHash = `0x${"b".repeat(64)}`;
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const topic = (address: string) => `0x${"0".repeat(24)}${address.slice(2).toLowerCase()}`;
const word = (value: bigint) => `0x${value.toString(16).padStart(64, "0")}`;
const paymentSignature = (name: string) => Buffer.from(JSON.stringify({ payment: `kappa59-${name}` }), "utf8").toString("base64url");
const paymentHash = (signature: string) => createHash("sha256").update(signature, "utf8").digest("hex");

const providerCalls = new Map<string, number>();
const providerEffects = new Map<string, number>();
const providerKeys = new Map<string, string[]>();
const idempotentSeen = new Set<string>();

const provider = createServer(async (req, res) => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  const body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}") as { scenario?: string };
  const scenario = String(body.scenario ?? "unknown");
  const key = String(req.headers["idempotency-key"] ?? "");
  providerCalls.set(scenario, (providerCalls.get(scenario) ?? 0) + 1);
  providerKeys.set(scenario, [...(providerKeys.get(scenario) ?? []), key]);
  if (req.url === "/idempotent") {
    if (!key) {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: "missing idempotency key" }));
      return;
    }
    if (!idempotentSeen.has(key)) {
      idempotentSeen.add(key);
      providerEffects.set(scenario, (providerEffects.get(scenario) ?? 0) + 1);
    }
  } else {
    providerEffects.set(scenario, (providerEffects.get(scenario) ?? 0) + 1);
  }
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify({ ok: true, scenario }));
});
await new Promise<void>(resolve => provider.listen(0, "127.0.0.1", resolve));
const providerAddress = provider.address();
if (!providerAddress || typeof providerAddress === "string") throw new Error("unable to bind provider");
const providerBaseUrl = `http://127.0.0.1:${providerAddress.port}`;

const settlementCalls = new Map<string, number>();
const settlementEffects = new Map<string, number>();
const settlementTransactions = new Map<string, string>();
const facilitator = createServer(async (req, res) => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  if (req.url === "/verify") {
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ isValid: true, payer: "0x1111111111111111111111111111111111111111" }));
    return;
  }
  if (req.url !== "/settle") {
    res.statusCode = 404;
    res.end();
    return;
  }
  const key = String(req.headers["idempotency-key"] ?? "");
  if (!key) {
    res.statusCode = 400;
    res.end(JSON.stringify({ error: "missing settlement idempotency" }));
    return;
  }
  settlementCalls.set(key, (settlementCalls.get(key) ?? 0) + 1);
  let transaction = settlementTransactions.get(key);
  if (!transaction) {
    transaction = `0x${createHash("sha256").update(`tx:${key}`).digest("hex")}`;
    settlementTransactions.set(key, transaction);
    settlementEffects.set(key, 1);
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
      logs: [{ address: asset, topics: [transferTopic, topic(from), topic(payTo!)], data: word(5000n), logIndex: "0x0" }],
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

const dir = mkdtempSync(join(tmpdir(), "missing-k59-"));
process.env.MISSING_PROVIDER_COST_LEDGER = join(dir, "provider-costs.jsonl");

function worker(args: string[], expectedExit = 0): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["--import", "tsx", "src/experimentKappa59Worker.ts", ...args], {
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

function args(capability: string, signature: string, kind: "idempotent" | "ambiguous", crash = "") {
  return [capability, signature, providerBaseUrl, kind, crash];
}

function parsed(stdout: string) {
  return JSON.parse(stdout.trim()) as { status: number; body: any };
}

await initializeDistributedMoney();
await truncateDistributedMoney();

const evidence: any = {
  product: "Kappa.5.9",
  invariant: "the production paid-resolution path recovers crashes without duplicate provider or settlement effects",
  scenarios: [],
};

// 1. A crash after reservation is recoverable because no provider effect has started.
{
  const capability = "kappa59_reservation_restart";
  const signature = paymentSignature(capability);
  const hash = paymentHash(signature);
  await worker(args(capability, signature, "idempotent", "after_reservation"), 91);
  await sleep(140);
  const response = parsed((await worker(args(capability, signature, "idempotent"))).stdout);
  const row = await distributedPayment(hash);
  evidence.scenarios.push({
    name: "production_crash_after_reservation",
    response_status: response.status,
    provider_calls: providerCalls.get(capability) ?? 0,
    provider_effects: providerEffects.get(capability) ?? 0,
    final_state: row?.state ?? null,
    pass: response.status === 200 && (providerCalls.get(capability) ?? 0) === 1 && (providerEffects.get(capability) ?? 0) === 1 && row?.state === "settled",
  });
}

// 2. A POST that crashed after its external effect replays the exact recipe with the same provider idempotency key.
{
  const capability = "kappa59_idempotent_provider_restart";
  const signature = paymentSignature(capability);
  const hash = paymentHash(signature);
  await worker(args(capability, signature, "idempotent", "after_provider_effect"), 92);
  await sleep(140);
  const response = parsed((await worker(args(capability, signature, "idempotent"))).stdout);
  const row = await distributedPayment(hash);
  const keys = providerKeys.get(capability) ?? [];
  evidence.scenarios.push({
    name: "production_idempotent_provider_replay",
    response_status: response.status,
    provider_calls: providerCalls.get(capability) ?? 0,
    provider_effects: providerEffects.get(capability) ?? 0,
    same_idempotency_key: keys.length === 2 && Boolean(keys[0]) && keys[0] === keys[1],
    durable_key_matches: row?.provider_idempotency_key === keys[0],
    final_state: row?.state ?? null,
    pass: response.status === 200 && (providerCalls.get(capability) ?? 0) === 2 && (providerEffects.get(capability) ?? 0) === 1 && keys.length === 2 && keys[0] === keys[1] && row?.provider_idempotency_key === keys[0] && row.state === "settled",
  });
}

// 3. A POST without a verified recovery contract is quarantined instead of retried.
{
  const capability = "kappa59_ambiguous_provider_restart";
  const signature = paymentSignature(capability);
  const hash = paymentHash(signature);
  await worker(args(capability, signature, "ambiguous", "after_provider_effect"), 92);
  await sleep(140);
  const response = parsed((await worker(args(capability, signature, "ambiguous"))).stdout);
  const row = await distributedPayment(hash);
  evidence.scenarios.push({
    name: "production_ambiguous_provider_quarantine",
    response_status: response.status,
    response_error: response.body?.error ?? null,
    provider_calls: providerCalls.get(capability) ?? 0,
    provider_effects: providerEffects.get(capability) ?? 0,
    final_state: row?.state ?? null,
    pass: response.status === 409 && response.body?.error === "payment_outcome_ambiguous" && (providerCalls.get(capability) ?? 0) === 1 && (providerEffects.get(capability) ?? 0) === 1 && row?.state === "ambiguous",
  });
}

// 4. A crash after facilitator settlement but before transaction persistence resubmits the same durable settlement intent.
{
  const capability = "kappa59_settlement_restart";
  const signature = paymentSignature(capability);
  const hash = paymentHash(signature);
  const requestHash = agentRequestHash(capability, { scenario: capability });
  const intent = stableSettlementIntentId(hash, requestHash);
  await worker(args(capability, signature, "idempotent", "after_settlement_effect"), 93);
  await sleep(140);
  const response = parsed((await worker(args(capability, signature, "idempotent"))).stdout);
  const row = await distributedPayment(hash);
  evidence.scenarios.push({
    name: "production_settlement_intent_replay",
    response_status: response.status,
    provider_calls: providerCalls.get(capability) ?? 0,
    provider_effects: providerEffects.get(capability) ?? 0,
    facilitator_calls: settlementCalls.get(intent) ?? 0,
    settlement_effects: settlementEffects.get(intent) ?? 0,
    durable_intent_matches: row?.settlement_intent_id === intent,
    transaction_matches: row?.transaction_reference === settlementTransactions.get(intent),
    final_state: row?.state ?? null,
    pass: response.status === 200 && (providerCalls.get(capability) ?? 0) === 1 && (providerEffects.get(capability) ?? 0) === 1 && (settlementCalls.get(intent) ?? 0) === 2 && (settlementEffects.get(intent) ?? 0) === 1 && row?.settlement_intent_id === intent && row.transaction_reference === settlementTransactions.get(intent) && row.state === "settled",
  });
}

const passed = evidence.scenarios.every((scenario: any) => scenario.pass === true);
evidence.result = passed ? "GO_PRODUCTION_END_TO_END_RECOVERY" : "NO_GO_PRODUCTION_END_TO_END_RECOVERY";
await mkdir("artifacts", { recursive: true });
await writeFile("artifacts/product-kappa59-production-recovery.json", `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ result: evidence.result, scenarios: evidence.scenarios }, null, 2));

closeDistributedMoney();
provider.close();
facilitator.close();
rpc.close();
rmSync(dir, { recursive: true, force: true });
if (!passed) process.exitCode = 1;
