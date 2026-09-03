import { mkdir, writeFile } from "node:fs/promises";
import {
  dependencyBackpressureSnapshot,
  resetDependencyBackpressureForTest,
} from "./runtime/dependencyBackpressure.js";
import {
  configureX402Fetch,
  settleX402Payment,
  verifyX402Payment,
  type X402Requirements,
} from "./runtime/x402.js";
import {
  configureX402RpcFetch,
  x402SettlementProof,
} from "./runtime/x402Reconciliation.js";

const BASE_RELEASE = "628261e6291c717a15a98dc7f9642beb73818970";
const ARTIFACT = "artifacts/operational-readiness-9-dependency-deadlines-hung-call.json";
const NETWORK = "eip155:84532";
const ASSET = "0x1111111111111111111111111111111111111111";
const PAY_TO = "0x2222222222222222222222222222222222222222";
const TX = "0x" + "cd".repeat(32);
const BLOCK_HASH = "0x" + "ab".repeat(32);
const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

const REQUIREMENTS: X402Requirements = {
  scheme: "exact",
  network: NETWORK,
  amount: "1000",
  asset: ASSET,
  payTo: PAY_TO,
  maxTimeoutSeconds: 60,
  extra: { name: "USDC", version: "2" },
};

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function paymentSignature(index: number) {
  return Buffer.from(JSON.stringify({ payer: `payer-${index}`, nonce: index }), "utf8").toString("base64url");
}

function topicAddress(address: string) {
  return "0x" + address.slice(2).padStart(64, "0");
}

function rpcResponse(result: unknown) {
  return new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function hungFetchCounters() {
  let calls = 0;
  let aborted = 0;
  const fn: typeof fetch = async (_input, init) => {
    calls += 1;
    return new Promise<Response>((_resolve, reject) => {
      const signal = init?.signal;
      if (!signal) {
        reject(new Error("missing_abort_signal"));
        return;
      }
      const abort = () => {
        aborted += 1;
        reject(signal.reason instanceof Error ? signal.reason : new Error("aborted"));
      };
      if (signal.aborted) abort();
      else signal.addEventListener("abort", abort, { once: true });
    });
  };
  return { fn, calls: () => calls, aborted: () => aborted };
}

async function facilitatorVerifyScenario() {
  resetDependencyBackpressureForTest();
  const hung = hungFetchCounters();
  configureX402Fetch(hung.fn);

  const count = 30;
  const startedAt = Date.now();
  const results = await Promise.allSettled(Array.from({ length: count }, (_, index) => verifyX402Payment({
    paymentSignature: paymentSignature(index + 1),
    requirements: REQUIREMENTS,
  })));
  const elapsedMs = Date.now() - startedAt;
  const state = (dependencyBackpressureSnapshot() as any).dependencies.facilitator_verify;
  const rejected = results.filter(result => result.status === "rejected").length;
  const callsBeforeProbe = hung.calls();
  const probe = await Promise.allSettled(Array.from({ length: 10 }, (_, index) => verifyX402Payment({
    paymentSignature: paymentSignature(1000 + index),
    requirements: REQUIREMENTS,
  })));
  const callsAfterProbe = hung.calls();
  const afterProbe = (dependencyBackpressureSnapshot() as any).dependencies.facilitator_verify;

  await sleep(550);
  configureX402Fetch(async () => new Response(JSON.stringify({ isValid: true, payer: "payer-recovered" }), {
    status: 200,
    headers: { "content-type": "application/json" },
  }));
  const recovered = await verifyX402Payment({ paymentSignature: paymentSignature(9999), requirements: REQUIREMENTS });
  const afterRecovery = (dependencyBackpressureSnapshot() as any).dependencies.facilitator_verify;

  const pass =
    hung.calls() === 3
    && hung.aborted() === 3
    && state.timedOut === 3
    && state.inFlight === 0
    && state.circuit_open === true
    && state.rejectedSaturated >= 27
    && rejected === count
    && elapsedMs < 500
    && callsAfterProbe === callsBeforeProbe
    && afterProbe.rejectedCircuitOpen >= 10
    && probe.every(result => result.status === "rejected")
    && recovered.valid === true
    && afterRecovery.circuit_open === false
    && afterRecovery.inFlight === 0;

  return {
    name: "hung_facilitator_verify_calls_abort_release_and_recover",
    pass,
    details: {
      requests: count,
      external_calls: hung.calls(),
      aborted_calls: hung.aborted(),
      timed_out: state.timedOut,
      rejected_saturated: state.rejectedSaturated,
      elapsed_ms: elapsedMs,
      in_flight_after_timeout: state.inFlight,
      circuit_open_after_timeout: state.circuit_open,
      probe_external_calls_before: callsBeforeProbe,
      probe_external_calls_after: callsAfterProbe,
      rejected_circuit_open: afterProbe.rejectedCircuitOpen,
      recovered_valid: recovered.valid,
      circuit_open_after_recovery: afterRecovery.circuit_open,
    },
  };
}

async function facilitatorSettleScenario() {
  resetDependencyBackpressureForTest();
  const hung = hungFetchCounters();
  configureX402Fetch(hung.fn);

  const count = 30;
  const startedAt = Date.now();
  const results = await Promise.allSettled(Array.from({ length: count }, (_, index) => settleX402Payment({
    paymentPayload: { payer: `payer-${index}`, nonce: index },
    requirements: REQUIREMENTS,
    settlementIntentId: `or9-settlement-${index}`,
  })));
  const elapsedMs = Date.now() - startedAt;
  const state = (dependencyBackpressureSnapshot() as any).dependencies.facilitator_settle;
  const rejected = results.filter(result => result.status === "rejected").length;
  const callsBeforeProbe = hung.calls();
  const probe = await Promise.allSettled(Array.from({ length: 10 }, (_, index) => settleX402Payment({
    paymentPayload: { payer: `probe-${index}` },
    requirements: REQUIREMENTS,
    settlementIntentId: `or9-probe-${index}`,
  })));
  const callsAfterProbe = hung.calls();
  const afterProbe = (dependencyBackpressureSnapshot() as any).dependencies.facilitator_settle;

  await sleep(550);
  configureX402Fetch(async () => new Response(JSON.stringify({ success: true, transaction: TX, network: NETWORK }), {
    status: 200,
    headers: { "content-type": "application/json" },
  }));
  const recovered = await settleX402Payment({
    paymentPayload: { payer: "recovered" },
    requirements: REQUIREMENTS,
    settlementIntentId: "or9-settlement-recovered",
  });
  const afterRecovery = (dependencyBackpressureSnapshot() as any).dependencies.facilitator_settle;

  const pass =
    hung.calls() === 3
    && hung.aborted() === 3
    && state.timedOut === 3
    && state.inFlight === 0
    && state.circuit_open === true
    && state.rejectedSaturated >= 27
    && rejected === count
    && elapsedMs < 500
    && callsAfterProbe === callsBeforeProbe
    && afterProbe.rejectedCircuitOpen >= 10
    && probe.every(result => result.status === "rejected")
    && recovered.success === true
    && afterRecovery.circuit_open === false
    && afterRecovery.inFlight === 0;

  return {
    name: "hung_facilitator_settle_calls_abort_release_and_recover",
    pass,
    details: {
      requests: count,
      external_calls: hung.calls(),
      aborted_calls: hung.aborted(),
      timed_out: state.timedOut,
      rejected_saturated: state.rejectedSaturated,
      elapsed_ms: elapsedMs,
      in_flight_after_timeout: state.inFlight,
      circuit_open_after_timeout: state.circuit_open,
      probe_external_calls_before: callsBeforeProbe,
      probe_external_calls_after: callsAfterProbe,
      rejected_circuit_open: afterProbe.rejectedCircuitOpen,
      recovered_success: recovered.success,
      circuit_open_after_recovery: afterRecovery.circuit_open,
    },
  };
}

async function rpcScenario() {
  resetDependencyBackpressureForTest();
  const hung = hungFetchCounters();
  configureX402RpcFetch(hung.fn);

  const count = 30;
  const startedAt = Date.now();
  const results = await Promise.all(Array.from({ length: count }, (_, index) => x402SettlementProof({
    transaction: "0x" + (index + 1).toString(16).padStart(64, "0"),
    network: NETWORK,
    asset: ASSET,
    payTo: PAY_TO,
    amount: "1000",
  })));
  const elapsedMs = Date.now() - startedAt;
  const state = (dependencyBackpressureSnapshot() as any).dependencies.rpc;
  const callsBeforeProbe = hung.calls();
  const probe = await Promise.all(Array.from({ length: 10 }, (_, index) => x402SettlementProof({
    transaction: "0x" + (1000 + index).toString(16).padStart(64, "0"),
    network: NETWORK,
    asset: ASSET,
    payTo: PAY_TO,
    amount: "1000",
  })));
  const callsAfterProbe = hung.calls();
  const afterProbe = (dependencyBackpressureSnapshot() as any).dependencies.rpc;

  await sleep(550);
  let recoveryCalls = 0;
  configureX402RpcFetch(async (_input, init) => {
    recoveryCalls += 1;
    const body = JSON.parse(String(init?.body ?? "{}")) as { method?: string };
    if (body.method === "eth_chainId") return rpcResponse("0x14a34");
    if (body.method === "eth_getTransactionReceipt") {
      return rpcResponse({
        status: "0x1",
        blockNumber: "0x64",
        blockHash: BLOCK_HASH,
        logs: [{
          address: ASSET,
          topics: [TRANSFER_TOPIC, topicAddress("0x3333333333333333333333333333333333333333"), topicAddress(PAY_TO)],
          data: "0x3e8",
        }],
      });
    }
    if (body.method === "eth_blockNumber") return rpcResponse("0x70");
    if (body.method === "eth_getBlockByNumber") return rpcResponse({ hash: BLOCK_HASH });
    return rpcResponse(null);
  });
  const recovered = await x402SettlementProof({ transaction: TX, network: NETWORK, asset: ASSET, payTo: PAY_TO, amount: "1000" });
  const afterRecovery = (dependencyBackpressureSnapshot() as any).dependencies.rpc;

  const pass =
    hung.calls() === 3
    && hung.aborted() === 3
    && state.timedOut === 3
    && state.inFlight === 0
    && state.circuit_open === true
    && state.rejectedSaturated >= 27
    && results.every(result => result.state === "unavailable")
    && elapsedMs < 500
    && callsAfterProbe === callsBeforeProbe
    && afterProbe.rejectedCircuitOpen >= 10
    && probe.every(result => result.state === "unavailable")
    && recovered.state === "verified"
    && recoveryCalls === 5
    && afterRecovery.circuit_open === false
    && afterRecovery.inFlight === 0;

  return {
    name: "hung_rpc_calls_abort_release_and_exact_proof_recovers",
    pass,
    details: {
      requests: count,
      external_calls: hung.calls(),
      aborted_calls: hung.aborted(),
      timed_out: state.timedOut,
      rejected_saturated: state.rejectedSaturated,
      elapsed_ms: elapsedMs,
      in_flight_after_timeout: state.inFlight,
      circuit_open_after_timeout: state.circuit_open,
      probe_external_calls_before: callsBeforeProbe,
      probe_external_calls_after: callsAfterProbe,
      rejected_circuit_open: afterProbe.rejectedCircuitOpen,
      recovered_state: recovered.state,
      recovery_external_calls: recoveryCalls,
      circuit_open_after_recovery: afterRecovery.circuit_open,
    },
  };
}

async function main() {
  process.env.MISSING_X402_ENABLED = "1";
  process.env.MISSING_X402_NETWORK = NETWORK;
  process.env.MISSING_X402_ASSET = ASSET;
  process.env.MISSING_X402_PAY_TO = PAY_TO;
  process.env.MISSING_X402_FACILITATOR_URL = "https://or9-facilitator.invalid";
  process.env.MISSING_X402_FACILITATOR_IDEMPOTENCY = "1";
  process.env.MISSING_X402_RPC_URL = "https://or9-rpc.invalid";
  process.env.MISSING_X402_FINALITY_POLICIES = JSON.stringify({ [NETWORK]: 1 });
  process.env.MISSING_DEPENDENCY_BACKPRESSURE_ENABLED = "1";
  process.env.MISSING_DEPENDENCY_DEADLINES_ENABLED = "1";
  process.env.MISSING_FACILITATOR_MAX_IN_FLIGHT = "3";
  process.env.MISSING_RPC_MAX_IN_FLIGHT = "3";
  process.env.MISSING_FACILITATOR_CIRCUIT_FAILURE_THRESHOLD = "2";
  process.env.MISSING_RPC_CIRCUIT_FAILURE_THRESHOLD = "2";
  process.env.MISSING_FACILITATOR_CIRCUIT_COOLDOWN_MS = "500";
  process.env.MISSING_RPC_CIRCUIT_COOLDOWN_MS = "500";
  process.env.MISSING_FACILITATOR_TIMEOUT_MS = "50";
  process.env.MISSING_RPC_TIMEOUT_MS = "50";

  const scenarios = [
    await facilitatorVerifyScenario(),
    await facilitatorSettleScenario(),
    await rpcScenario(),
  ];
  const allScenariosPass = scenarios.every(scenario => scenario.pass);
  const finalSnapshot = dependencyBackpressureSnapshot();
  const evidence = {
    result: allScenariosPass
      ? "GO_OPERATIONAL_DEPENDENCY_DEADLINES_HUNG_CALL_CONTAINMENT"
      : "NO_GO_OPERATIONAL_DEPENDENCY_DEADLINES_HUNG_CALL_CONTAINMENT",
    base_release: BASE_RELEASE,
    assertions: {
      all_scenarios_pass: allScenariosPass,
      hung_facilitator_verify_is_aborted_and_releases_capacity: scenarios[0].pass,
      hung_facilitator_settle_is_aborted_and_releases_capacity: scenarios[1].pass,
      hung_rpc_is_aborted_and_exact_proof_recovers: scenarios[2].pass,
    },
    configuration: {
      facilitator_timeout_ms: 50,
      rpc_timeout_ms: 50,
      max_in_flight: 3,
      failure_threshold: 2,
      cooldown_ms: 500,
      deadlines_enabled: (finalSnapshot as any).deadlines_enabled,
    },
    scenarios,
  };

  await mkdir("artifacts", { recursive: true });
  await writeFile(ARTIFACT, JSON.stringify(evidence, null, 2) + "\n", "utf8");
  console.log(JSON.stringify(evidence, null, 2));
  configureX402Fetch();
  configureX402RpcFetch();
  if (!allScenariosPass) process.exitCode = 1;
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
