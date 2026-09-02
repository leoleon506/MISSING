import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import {
  closeDistributedMoney,
  distributedPayment,
  initializeDistributedMoney,
  truncateDistributedMoney,
} from "./runtime/distributedMoney.js";
import { agentRequestHash } from "./runtime/requestBinding.js";

process.env.MISSING_DISTRIBUTED_MONEY_ENABLED = "1";
process.env.MISSING_TRANSACTIONAL_RESPONSE_CACHE_ENABLED = "0";
process.env.MISSING_X402_MIN_CONFIRMATIONS = "2";

const capability = "country_alpha_metadata";
const input = { country_code: "CR" };
const requestHash = agentRequestHash(capability, input);
const asset = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
const payTo = "0x209693Bc6afc0C5328bA36FaF03C514EF312287C";
const amount = "5000";
const transferTopic = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const from = "0x1111111111111111111111111111111111111111";
const blockHash = `0x${"b".repeat(64)}`;

function topic(address: string) {
  return `0x${"0".repeat(24)}${address.slice(2).toLowerCase()}`;
}
function word(value: bigint) {
  return `0x${value.toString(16).padStart(64, "0")}`;
}
function tx(name: string) {
  return `0x${createHash("sha256").update(name).digest("hex")}`;
}
function payment(name: string) {
  return createHash("sha256").update(`k57:${name}:${Date.now()}:${process.pid}`).digest("hex");
}

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
      logs: [{ address: asset, topics: [transferTopic, topic(from), topic(payTo)], data: word(BigInt(amount)), logIndex: "0x0" }],
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
const address = rpc.address();
if (!address || typeof address === "string") throw new Error("unable to bind Kappa.5.7 RPC server");
process.env.MISSING_X402_RPC_URL = `http://127.0.0.1:${address.port}`;

const dir = mkdtempSync(join(tmpdir(), "missing-k57-"));
const probePath = join(dir, "provider-probe.tsv");
writeFileSync(probePath, "", "utf8");

function providerCount(paymentHash: string) {
  return readFileSync(probePath, "utf8").split(/\r?\n/).filter(line => line.startsWith(`${paymentHash}\t`)).length;
}

function worker(args: string[], expectedExit = 0): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["--import", "tsx", "src/experimentKappa57Worker.ts", ...args], {
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
      if (actual !== expectedExit) reject(new Error(`worker ${args[0]} exited ${actual}, expected ${expectedExit}: ${stderr}`));
      else resolve({ code: actual, stdout, stderr });
    });
  });
}

function baseArgs(mode: string, paymentHash: string, executionId: string, transaction = "") {
  return [mode, paymentHash, requestHash, executionId, capability, probePath, transaction, asset, payTo, amount];
}

await initializeDistributedMoney();
await truncateDistributedMoney();

const evidence: any = {
  product: "Kappa.5.7",
  invariant: "restart never re-executes an ambiguously completed provider effect or settlement",
  response_cache_enabled: false,
  scenarios: [],
};

// 1. Crash immediately after authoritative reservation: retry must not win.
{
  const p = payment("reserved");
  await worker(baseArgs("crash_reserved", p, "k57-reserved-owner"), 91);
  const retry = JSON.parse((await worker(baseArgs("retry", p, "k57-reserved-retry"))).stdout);
  const row = await distributedPayment(p);
  evidence.scenarios.push({ name: "crash_after_reservation", retry, provider_effects: providerCount(p), final_state: row?.state ?? null,
    pass: retry.reserved === false && providerCount(p) === 0 && row?.state === "reserved" });
}

// 2. Provider effect happened but process died before settling: retry stays blocked.
{
  const p = payment("provider");
  await worker(baseArgs("crash_after_provider", p, "k57-provider-owner"), 92);
  const retry = JSON.parse((await worker(baseArgs("retry", p, "k57-provider-retry"))).stdout);
  const row = await distributedPayment(p);
  evidence.scenarios.push({ name: "crash_after_provider_effect", retry, provider_effects: providerCount(p), final_state: row?.state ?? null,
    pass: retry.reserved === false && providerCount(p) === 1 && row?.state === "reserved" });
}

// 3. Resolution persisted in settling but no transaction reference exists: retry stays blocked and no new provider effect occurs.
{
  const p = payment("settling");
  await worker(baseArgs("crash_settling", p, "k57-settling-owner"), 93);
  const retry = JSON.parse((await worker(baseArgs("retry", p, "k57-settling-retry"))).stdout);
  const row = await distributedPayment(p);
  evidence.scenarios.push({ name: "crash_in_settling_before_transaction", retry, provider_effects: providerCount(p), transaction: row?.transaction_reference ?? null, final_state: row?.state ?? null,
    pass: retry.reserved === false && providerCount(p) === 1 && row?.state === "settling" && row.transaction_reference === null });
}

// 4. Transaction reference was durably recorded before crash. Two restart reconcilers may prove it, but only one may commit settled.
{
  const p = payment("pending-tx");
  const transaction = tx("k57-pending-tx");
  await worker(baseArgs("crash_pending_tx", p, "k57-pending-owner", transaction), 94);
  const retry = JSON.parse((await worker(baseArgs("retry", p, "k57-pending-retry", transaction))).stdout);
  const [a, b] = await Promise.all([
    worker(baseArgs("reconcile", p, "k57-reconcile-a", transaction)),
    worker(baseArgs("reconcile", p, "k57-reconcile-b", transaction)),
  ]);
  const reconciliations = [JSON.parse(a.stdout), JSON.parse(b.stdout)];
  const row = await distributedPayment(p);
  evidence.scenarios.push({ name: "crash_after_transaction_persisted", retry, provider_effects: providerCount(p), reconciliations, transaction: row?.transaction_reference ?? null, final_state: row?.state ?? null,
    pass: retry.reserved === false && providerCount(p) === 1 && reconciliations.filter(item => item.proof === "verified").length === 2 && reconciliations.filter(item => item.changed === true).length === 1 && row?.state === "settled" && row.transaction_reference === transaction });
}

// 5. Crash after authoritative settled commit but before client response: restart cannot reserve or repeat provider work.
{
  const p = payment("after-commit");
  const transaction = tx("k57-after-commit");
  await worker(baseArgs("crash_after_commit", p, "k57-commit-owner", transaction), 95);
  const retry = JSON.parse((await worker(baseArgs("retry", p, "k57-commit-retry", transaction))).stdout);
  const row = await distributedPayment(p);
  evidence.scenarios.push({ name: "crash_after_settled_commit_before_response", retry, provider_effects: providerCount(p), transaction: row?.transaction_reference ?? null, final_state: row?.state ?? null,
    pass: retry.reserved === false && providerCount(p) === 1 && row?.state === "settled" && row.transaction_reference === transaction });
}

const passed = evidence.scenarios.every((scenario: any) => scenario.pass === true);
evidence.result = passed ? "GO_CRASH_CONSISTENCY_RESTART_RECOVERY" : "NO_GO_CRASH_CONSISTENCY_RESTART_RECOVERY";

const artifactPath = "artifacts/product-kappa57-crash-consistency-restart-recovery.json";
await import("node:fs/promises").then(fs => fs.mkdir("artifacts", { recursive: true }).then(() => fs.writeFile(artifactPath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8")));

console.log(JSON.stringify({ result: evidence.result, scenarios: evidence.scenarios.map((s: any) => ({ name: s.name, pass: s.pass, provider_effects: s.provider_effects, final_state: s.final_state })) }, null, 2));

closeDistributedMoney();
rpc.close();
rmSync(dir, { recursive: true, force: true });
if (!passed) process.exitCode = 1;
