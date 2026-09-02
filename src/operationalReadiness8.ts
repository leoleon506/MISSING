import { mkdir, writeFile } from "node:fs/promises";
import {
  dependencyBackpressureSnapshot,
  resetDependencyBackpressureForTest,
} from "./runtime/dependencyBackpressure.js";
import {
  configureX402RpcFetch,
  x402SettlementProof,
} from "./runtime/x402Reconciliation.js";

const BASE_RELEASE = "00284c6579ece5c047c3ebd7a7eb818cd1fd5709";
const ARTIFACT = "artifacts/operational-readiness-8-rpc-backpressure-proof-storm.json";
const NETWORK = "eip155:84532";
const ASSET = "0x1111111111111111111111111111111111111111";
const PAY_TO = "0x2222222222222222222222222222222222222222";
const AMOUNT = "1000";
const BLOCK_HASH = "0x" + "ab".repeat(32);
const TX = "0x" + "cd".repeat(32);
const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
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

function proof(index: number) {
  return x402SettlementProof({
    transaction: "0x" + index.toString(16).padStart(64, "0"),
    network: NETWORK,
    asset: ASSET,
    payTo: PAY_TO,
    amount: AMOUNT,
  });
}

async function main() {
  process.env.MISSING_X402_RPC_URL = "https://or8.invalid";
  process.env.MISSING_X402_FINALITY_POLICIES = JSON.stringify({ [NETWORK]: 1 });
  process.env.MISSING_DEPENDENCY_BACKPRESSURE_ENABLED = "1";
  process.env.MISSING_RPC_MAX_IN_FLIGHT = "4";
  process.env.MISSING_RPC_CIRCUIT_FAILURE_THRESHOLD = "3";
  process.env.MISSING_RPC_CIRCUIT_COOLDOWN_MS = "150";

  resetDependencyBackpressureForTest();
  let externalCalls = 0;
  let healthy = false;
  const methodCalls: Record<string, number> = {};

  configureX402RpcFetch(async (_input, init) => {
    externalCalls += 1;
    const body = JSON.parse(String(init?.body ?? "{}")) as { method?: string };
    const method = body.method ?? "unknown";
    methodCalls[method] = (methodCalls[method] ?? 0) + 1;

    if (method === "eth_chainId") {
      await sleep(20);
      return rpcResponse("0x14a34");
    }

    await sleep(40);
    if (!healthy && method === "eth_getTransactionReceipt") {
      return new Response(JSON.stringify({ error: "rpc outage" }), {
        status: 503,
        headers: { "content-type": "application/json" },
      });
    }

    if (method === "eth_getTransactionReceipt") {
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
    if (method === "eth_blockNumber") return rpcResponse("0x70");
    if (method === "eth_getBlockByNumber") return rpcResponse({ hash: BLOCK_HASH });
    return rpcResponse(null);
  });

  const proofStormSize = 60;
  const stormResults = await Promise.all(Array.from({ length: proofStormSize }, (_, index) => proof(index + 1)));
  const callsAfterStorm = externalCalls;
  const stormMethodCalls = { ...methodCalls };
  const stormChainIdCalls = stormMethodCalls.eth_chainId ?? 0;
  const stormReceiptCalls = stormMethodCalls.eth_getTransactionReceipt ?? 0;
  const stormSnapshot = dependencyBackpressureSnapshot() as any;
  const rpcStateAfterStorm = stormSnapshot.dependencies.rpc;
  const unavailableDuringStorm = stormResults.filter(result => result.state === "unavailable").length;
  const stormPass =
    callsAfterStorm <= 8
    && stormChainIdCalls <= 4
    && stormReceiptCalls <= 4
    && rpcStateAfterStorm.rejectedSaturated >= proofStormSize - 4
    && unavailableDuringStorm === proofStormSize;

  const callsBeforeCircuitProbe = externalCalls;
  const circuitProbeResults = await Promise.all(Array.from({ length: 20 }, (_, index) => proof(1000 + index)));
  const callsAfterCircuitProbe = externalCalls;
  const rpcStateAfterProbe = (dependencyBackpressureSnapshot() as any).dependencies.rpc;
  const circuitPass =
    rpcStateAfterProbe.circuit_open === true
    && callsAfterCircuitProbe === callsBeforeCircuitProbe
    && circuitProbeResults.every(result => result.state === "unavailable")
    && rpcStateAfterProbe.rejectedCircuitOpen >= 20;

  await sleep(200);
  healthy = true;
  const callsBeforeRecovery = externalCalls;
  const recovered = await x402SettlementProof({
    transaction: TX,
    network: NETWORK,
    asset: ASSET,
    payTo: PAY_TO,
    amount: AMOUNT,
  });
  const recoveryCalls = externalCalls - callsBeforeRecovery;
  const rpcStateAfterRecovery = (dependencyBackpressureSnapshot() as any).dependencies.rpc;
  const recoveryPass =
    recovered.state === "verified"
    && recoveryCalls === 5
    && rpcStateAfterRecovery.circuit_open === false
    && rpcStateAfterRecovery.inFlight === 0;

  const allScenariosPass = stormPass && circuitPass && recoveryPass;
  const evidence = {
    result: allScenariosPass
      ? "GO_OPERATIONAL_RPC_BACKPRESSURE_PROOF_STORM_CONTAINMENT"
      : "NO_GO_OPERATIONAL_RPC_BACKPRESSURE_PROOF_STORM_CONTAINMENT",
    base_release: BASE_RELEASE,
    assertions: {
      all_scenarios_pass: allScenariosPass,
      multi_stage_proof_storm_external_calls_are_bounded: stormPass,
      rpc_circuit_breaker_suppresses_additional_proofs: circuitPass,
      exact_settlement_proof_recovers_after_cooldown: recoveryPass,
    },
    scenarios: [
      {
        name: "multi_stage_settlement_proof_outage_is_bounded",
        pass: stormPass,
        details: {
          proof_requests: proofStormSize,
          external_calls: callsAfterStorm,
          chain_id_calls: stormChainIdCalls,
          receipt_calls: stormReceiptCalls,
          rejected_saturated: rpcStateAfterStorm.rejectedSaturated,
          max_in_flight: rpcStateAfterStorm.max_in_flight,
          unavailable_results: unavailableDuringStorm,
        },
      },
      {
        name: "open_rpc_circuit_suppresses_additional_proof_traffic",
        pass: circuitPass,
        details: {
          proof_requests: 20,
          external_calls_before: callsBeforeCircuitProbe,
          external_calls_after: callsAfterCircuitProbe,
          rejected_circuit_open: rpcStateAfterProbe.rejectedCircuitOpen,
          circuit_open: rpcStateAfterProbe.circuit_open,
        },
      },
      {
        name: "cooldown_restores_full_exact_settlement_proof",
        pass: recoveryPass,
        details: {
          proof_state: recovered.state,
          recovery_external_calls: recoveryCalls,
          circuit_open_after_recovery: rpcStateAfterRecovery.circuit_open,
          in_flight_after_recovery: rpcStateAfterRecovery.inFlight,
        },
      },
    ],
  };

  await mkdir("artifacts", { recursive: true });
  await writeFile(ARTIFACT, JSON.stringify(evidence, null, 2) + "\n", "utf8");
  console.log(JSON.stringify(evidence, null, 2));
  configureX402RpcFetch();
  if (!allScenariosPass) process.exitCode = 1;
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
