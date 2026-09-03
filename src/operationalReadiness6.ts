import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import {
  closeDistributedMoney,
  distributedPayment,
  initializeDistributedMoney,
  truncateDistributedMoney,
} from "./runtime/distributedMoney.js";
import { handleAgentPaidResolution } from "./runtime/agentPayments.js";
import { configureX402Fetch } from "./runtime/x402.js";
import { configureX402RpcFetch } from "./runtime/x402Reconciliation.js";
import {
  configureX402RpcIdentityFetch,
  refreshX402RpcNetworkIdentity,
} from "./runtime/x402RpcIdentity.js";
import { startSettledX402ReorgMonitor, stopSettledX402ReorgMonitor } from "./runtime/settledReorgMonitor.js";

const BASE_RELEASE = "5b686a2ee116542ed58d3670980357a26d36395d";
const capability = "country_alpha_metadata";
const input = { country_code: "CR" };
const network = "eip155:84532";
const asset = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
const payTo = "0x209693Bc6afc0C5328bA36FaF03C514EF312287C";
const recipeFingerprint = "c0a7d71e636f89ac19a5f652680f0f004d0dbf0d6452b894f96818825462a017";
const amount = 5000;
const tx = `0x${createHash("sha256").update("OR6:settlement").digest("hex")}`;
const blockHash = `0x${createHash("sha256").update("OR6:block").digest("hex")}`;
const transferTopic = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const addressTopic = (address: string) => `0x${"0".repeat(24)}${address.slice(2).toLowerCase()}`;
const hexAmount = `0x${BigInt(amount).toString(16)}`;
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

Object.assign(process.env, {
  MISSING_PRODUCTION_ADMISSION_ENABLED: "1",
  MISSING_AGENT_PAYMENTS_ENABLED: "1",
  MISSING_X402_ENABLED: "1",
  MISSING_X402_NETWORK: network,
  MISSING_X402_ASSET: asset,
  MISSING_X402_PAY_TO: payTo,
  MISSING_X402_FACILITATOR_URL: "https://facilitator.or6.invalid",
  MISSING_X402_FACILITATOR_IDEMPOTENCY: "1",
  MISSING_X402_RPC_URL: "http://rpc.or6.invalid",
  MISSING_X402_FINALITY_POLICIES: JSON.stringify({ [network]: 2 }),
  MISSING_DISTRIBUTED_MONEY_ENABLED: "1",
  MISSING_TRANSACTIONAL_RESPONSE_CACHE_ENABLED: "0",
  MISSING_X402_RECOVERY_LEASE_MS: "600",
  MISSING_X402_LEASE_HEARTBEAT_MS: "150",
  MISSING_X402_SETTLED_REORG_MONITOR_ENABLED: "1",
  MISSING_X402_SETTLED_REORG_MONITOR_INTERVAL_MS: "60000",
  MISSING_X402_SETTLED_REORG_MONITOR_BATCH_SIZE: "10",
  MISSING_ECONOMICS_ENFORCEMENT_ENABLED: "1",
  MISSING_MIN_MARGIN_MICROUSD: "1",
  MISSING_ECONOMICS_JSON: JSON.stringify({
    recipes: {
      [recipeFingerprint]: {
        provider_cost_microusd: 1000,
        customer_price_microusd: amount,
      },
    },
  }),
});

type Scenario = { name: string; pass: boolean; details: Record<string, unknown> };
const scenarios: Scenario[] = [];
const record = (name: string, pass: boolean, details: Record<string, unknown>) => scenarios.push({ name, pass, details });

let providerCalls = 0;
const originalFetch = globalThis.fetch;
globalThis.fetch = (async (url: string | URL | Request) => {
  const target = typeof url === "string" ? url : url instanceof URL ? url.toString() : url.url;
  if (target.startsWith("https://countries.dev/alpha/")) {
    providerCalls += 1;
    return new Response(JSON.stringify({ alpha2Code: "CR", region: "Americas", name: "Costa Rica" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }
  throw new Error(`OR6 unexpected global fetch: ${target}`);
}) as typeof fetch;

let verificationOutage = false;
let settlementOutage = false;
let verifyCalls = 0;
let settleCalls = 0;
const settlementIntentHeaders: string[] = [];
configureX402Fetch((async (url: string | URL | Request, init?: RequestInit) => {
  const target = typeof url === "string" ? url : url instanceof URL ? url.toString() : url.url;
  if (target.endsWith("/verify")) {
    verifyCalls += 1;
    if (verificationOutage) throw new Error("OR6 facilitator verify outage");
    return new Response(JSON.stringify({ isValid: true, payer: "0x1111111111111111111111111111111111111111" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }
  if (target.endsWith("/settle")) {
    settleCalls += 1;
    const headers = new Headers(init?.headers);
    settlementIntentHeaders.push(headers.get("idempotency-key") ?? "");
    if (settlementOutage) throw new Error("OR6 facilitator settle outage");
    return new Response(JSON.stringify({ success: true, transaction: tx, network }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }
  throw new Error(`OR6 unexpected facilitator fetch: ${target}`);
}) as typeof fetch);

// Admission identity is an independent precondition. Keep it healthy throughout
// OR6 so each scenario can exercise the intended downstream dependency outage.
configureX402RpcIdentityFetch((async (_url: string | URL | Request, init?: RequestInit) => {
  const body = JSON.parse(String(init?.body ?? "{}")) as { method?: string };
  if (body.method !== "eth_chainId") throw new Error(`OR6 unexpected admission RPC method: ${body.method}`);
  return new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result: "0x14a34" }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}) as typeof fetch);

let rpcOutage = false;
let rpcCalls = 0;
configureX402RpcFetch((async (_url: string | URL | Request, init?: RequestInit) => {
  rpcCalls += 1;
  if (rpcOutage) throw new Error("OR6 RPC outage");
  const body = JSON.parse(String(init?.body ?? "{}")) as { method?: string };
  let result: unknown;
  if (body.method === "eth_chainId") result = "0x14a34";
  else if (body.method === "eth_blockNumber") result = "0x65";
  else if (body.method === "eth_getBlockByNumber") result = { hash: blockHash };
  else if (body.method === "eth_getTransactionReceipt") result = {
    status: "0x1",
    blockNumber: "0x64",
    blockHash,
    logs: [{
      address: asset,
      topics: [transferTopic, addressTopic("0x1111111111111111111111111111111111111111"), addressTopic(payTo)],
      data: hexAmount,
    }],
  };
  else throw new Error(`OR6 unexpected RPC method: ${body.method}`);
  return new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}) as typeof fetch);

const signatureFor = (label: string) => Buffer.from(JSON.stringify({ payment: `or6-${label}` }), "utf8").toString("base64url");
const paymentHashFor = (signature: string) => createHash("sha256").update(signature, "utf8").digest("hex");
const requestFor = (signature: string) => handleAgentPaidResolution({
  request: { capability, input },
  paymentSignature: signature,
  resourceUrl: "https://missing.or6.test/v1/agent/resolve",
});

await initializeDistributedMoney();
await truncateDistributedMoney();
startSettledX402ReorgMonitor();
await sleep(100);
await refreshX402RpcNetworkIdentity();

// 1. Verification dependency outage must stop before durable reservation/provider work,
// and traffic must recover when the facilitator returns.
{
  const signature = signatureFor("verify-outage");
  const paymentHash = paymentHashFor(signature);
  verificationOutage = true;
  const failed = await requestFor(signature);
  const during = await distributedPayment(paymentHash);
  const providerCallsDuring = providerCalls;
  verificationOutage = false;
  const recovered = await requestFor(signature);
  const after = await distributedPayment(paymentHash);
  record("verification_outage_fails_before_money_or_provider_and_recovers", failed.status === 502
    && during === null
    && providerCallsDuring === 0
    && recovered.status === 200
    && after?.state === "settled", {
    failed_status: failed.status,
    provider_calls_during_outage: providerCallsDuring,
    durable_row_during_outage: during?.state ?? null,
    recovered_status: recovered.status,
    final_state: after?.state ?? null,
  });
}

await truncateDistributedMoney();
providerCalls = 0;
verifyCalls = 0;
settleCalls = 0;
settlementIntentHeaders.length = 0;

// 2. Settlement facilitator outage happens after the provider effect. A retry must
// be able to take a fresh durable fence without process restart, must not rerun the
// provider, and must reuse exactly the same settlement intent.
{
  const signature = signatureFor("settle-outage");
  const paymentHash = paymentHashFor(signature);
  settlementOutage = true;
  const failed = await requestFor(signature);
  const during = await distributedPayment(paymentHash);
  const firstIntent = settlementIntentHeaders[0] ?? null;
  const providerCallsAfterFailure = providerCalls;
  await sleep(1200); // > lease_ms; a leaked heartbeat would keep ownership alive.
  settlementOutage = false;
  const recovered = await requestFor(signature);
  const after = await distributedPayment(paymentHash);
  const secondIntent = settlementIntentHeaders[1] ?? null;
  record("settlement_outage_releases_lease_and_recovers_without_duplicate_provider_effect", failed.status === 503
    && during?.state === "settling"
    && providerCallsAfterFailure === 1
    && recovered.status === 200
    && providerCalls === 1
    && settleCalls === 2
    && Boolean(firstIntent)
    && firstIntent === secondIntent
    && after?.state === "settled"
    && (after?.lease_fence ?? 0) >= 2, {
    failed_status: failed.status,
    state_during_outage: during?.state ?? null,
    provider_calls_after_failure: providerCallsAfterFailure,
    recovered_status: recovered.status,
    provider_calls_total: providerCalls,
    settle_calls: settleCalls,
    first_settlement_intent: firstIntent,
    second_settlement_intent: secondIntent,
    final_state: after?.state ?? null,
    final_fence: after?.lease_fence ?? null,
  });
}

await truncateDistributedMoney();
providerCalls = 0;
verifyCalls = 0;
settleCalls = 0;
settlementIntentHeaders.length = 0;
rpcCalls = 0;

// 3. RPC outage after a successful settlement response must preserve the known tx
// and allow owned reconciliation after recovery without re-submitting settlement.
{
  const signature = signatureFor("rpc-outage");
  const paymentHash = paymentHashFor(signature);
  rpcOutage = true;
  const failed = await requestFor(signature);
  const during = await distributedPayment(paymentHash);
  const settleCallsAfterFailure = settleCalls;
  const providerCallsAfterFailure = providerCalls;
  await sleep(1200);
  rpcOutage = false;
  const recovered = await requestFor(signature);
  const after = await distributedPayment(paymentHash);
  record("rpc_outage_preserves_known_tx_and_reconciles_without_resettlement", failed.status === 503
    && during?.state === "settling"
    && during.transaction_reference === tx
    && providerCallsAfterFailure === 1
    && settleCallsAfterFailure === 1
    && recovered.status === 200
    && providerCalls === 1
    && settleCalls === 1
    && after?.state === "settled", {
    failed_status: failed.status,
    state_during_outage: during?.state ?? null,
    transaction_during_outage: during?.transaction_reference ?? null,
    provider_calls_after_failure: providerCallsAfterFailure,
    settle_calls_after_failure: settleCallsAfterFailure,
    recovered_status: recovered.status,
    provider_calls_total: providerCalls,
    settle_calls_total: settleCalls,
    rpc_calls_total: rpcCalls,
    final_state: after?.state ?? null,
  });
}

const assertions = {
  all_scenarios_pass: scenarios.every(item => item.pass),
  verification_outage_has_zero_provider_effects: scenarios.find(item => item.name.startsWith("verification_outage"))?.pass === true,
  settlement_outage_does_not_duplicate_provider_effect: scenarios.find(item => item.name.startsWith("settlement_outage"))?.pass === true,
  rpc_outage_reconciles_known_transaction_without_resettlement: scenarios.find(item => item.name.startsWith("rpc_outage"))?.pass === true,
};
const go = Object.values(assertions).every(Boolean);
const evidence = {
  result: go ? "GO_OPERATIONAL_EXTERNAL_DEPENDENCY_OUTAGE_RECOVERY" : "NO_GO_OPERATIONAL_EXTERNAL_DEPENDENCY_OUTAGE_RECOVERY",
  base_release: BASE_RELEASE,
  assertions,
  scenarios,
};
await mkdir("artifacts", { recursive: true });
await writeFile("artifacts/operational-readiness-6-external-dependency-outage-recovery.json", `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
console.log(JSON.stringify(evidence, null, 2));

await stopSettledX402ReorgMonitor();
closeDistributedMoney();
configureX402Fetch();
configureX402RpcFetch();
configureX402RpcIdentityFetch();
globalThis.fetch = originalFetch;
if (!go) process.exitCode = 1;
