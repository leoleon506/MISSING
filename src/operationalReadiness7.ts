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

const BASE_RELEASE = "59d8680f5874a73822f041be27c9ba207683a328";
const ARTIFACT = "artifacts/operational-readiness-7-dependency-backpressure-retry-storm.json";

const requirements: X402Requirements = {
  scheme: "exact",
  network: "eip155:84532",
  amount: "1000",
  asset: "0x1111111111111111111111111111111111111111",
  payTo: "0x2222222222222222222222222222222222222222",
  maxTimeoutSeconds: 60,
  extra: { name: "USDC", version: "2" },
};

function signature(index: number) {
  return Buffer.from(JSON.stringify({ payer: `0x${String(index).padStart(40, "0")}` }), "utf8").toString("base64url");
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  process.env.MISSING_X402_ENABLED = "1";
  process.env.MISSING_X402_NETWORK = requirements.network;
  process.env.MISSING_X402_ASSET = requirements.asset;
  process.env.MISSING_X402_PAY_TO = requirements.payTo;
  process.env.MISSING_X402_FACILITATOR_URL = "https://or7.invalid";
  process.env.MISSING_X402_FACILITATOR_IDEMPOTENCY = "1";
  process.env.MISSING_DEPENDENCY_BACKPRESSURE_ENABLED = "1";
  process.env.MISSING_FACILITATOR_MAX_IN_FLIGHT = "4";
  process.env.MISSING_FACILITATOR_CIRCUIT_FAILURE_THRESHOLD = "3";
  process.env.MISSING_FACILITATOR_CIRCUIT_COOLDOWN_MS = "150";

  resetDependencyBackpressureForTest();
  let externalCalls = 0;
  let healthy = false;
  configureX402Fetch(async (input, init) => {
    externalCalls += 1;
    const url = String(input);
    await sleep(40);
    if (!healthy) return new Response(JSON.stringify({ error: "outage" }), { status: 503, headers: { "content-type": "application/json" } });
    if (url.endsWith("/verify")) return new Response(JSON.stringify({ isValid: true, payer: "0x3333333333333333333333333333333333333333" }), { status: 200, headers: { "content-type": "application/json" } });
    return new Response(JSON.stringify({ success: true, transaction: "0x" + "ab".repeat(32), network: requirements.network }), { status: 200, headers: { "content-type": "application/json" } });
  });

  const verifyStormSize = 60;
  const verifyResults = await Promise.allSettled(Array.from({ length: verifyStormSize }, (_, index) =>
    verifyX402Payment({ paymentSignature: signature(index), requirements })
  ));
  const verifyCallsDuringStorm = externalCalls;
  const verifySnapshot = dependencyBackpressureSnapshot() as any;
  const verifyState = verifySnapshot.dependencies.facilitator_verify;
  const verifyStormPass =
    verifyCallsDuringStorm <= 4
    && verifyState.rejectedSaturated >= verifyStormSize - 4
    && verifyResults.filter(result => result.status === "rejected").length >= verifyStormSize - 4;

  const callsBeforeCircuitProbe = externalCalls;
  const circuitProbeResults = await Promise.allSettled(Array.from({ length: 20 }, (_, index) =>
    verifyX402Payment({ paymentSignature: signature(1000 + index), requirements })
  ));
  const callsAfterCircuitProbe = externalCalls;
  const verifyAfterProbe = (dependencyBackpressureSnapshot() as any).dependencies.facilitator_verify;
  const circuitPass =
    verifyAfterProbe.circuit_open === true
    && callsAfterCircuitProbe === callsBeforeCircuitProbe
    && circuitProbeResults.every(result => result.status === "rejected");

  await sleep(200);
  healthy = true;
  const recoveredVerify = await verifyX402Payment({ paymentSignature: signature(9999), requirements });
  const recoveredVerifyState = (dependencyBackpressureSnapshot() as any).dependencies.facilitator_verify;
  const recoveryPass = recoveredVerify.valid === true && recoveredVerifyState.circuit_open === false;

  resetDependencyBackpressureForTest();
  healthy = false;
  externalCalls = 0;
  const settleStormSize = 50;
  const settleResults = await Promise.allSettled(Array.from({ length: settleStormSize }, () =>
    settleX402Payment({ paymentPayload: { payer: "or7" }, requirements, settlementIntentId: "or7-stable-settlement-intent" })
  ));
  const settleSnapshot = dependencyBackpressureSnapshot() as any;
  const settleState = settleSnapshot.dependencies.facilitator_settle;
  const settleStormPass =
    externalCalls <= 4
    && settleState.rejectedSaturated >= settleStormSize - 4
    && settleResults.filter(result => result.status === "rejected").length >= settleStormSize - 4;

  const allScenariosPass = verifyStormPass && circuitPass && recoveryPass && settleStormPass;
  const evidence = {
    result: allScenariosPass
      ? "GO_OPERATIONAL_DEPENDENCY_BACKPRESSURE_RETRY_STORM_CONTAINMENT"
      : "NO_GO_OPERATIONAL_DEPENDENCY_BACKPRESSURE_RETRY_STORM_CONTAINMENT",
    base_release: BASE_RELEASE,
    assertions: {
      all_scenarios_pass: allScenariosPass,
      verification_storm_external_calls_are_bounded: verifyStormPass,
      circuit_breaker_suppresses_retry_storm: circuitPass,
      dependency_recovers_after_cooldown: recoveryPass,
      settlement_storm_external_calls_are_bounded: settleStormPass,
    },
    scenarios: [
      {
        name: "verification_outage_concurrency_is_bounded",
        pass: verifyStormPass,
        details: {
          requests: verifyStormSize,
          external_calls: verifyCallsDuringStorm,
          rejected_saturated: verifyState.rejectedSaturated,
          max_in_flight: verifyState.max_in_flight,
        },
      },
      {
        name: "open_circuit_suppresses_additional_external_calls",
        pass: circuitPass,
        details: {
          probe_requests: 20,
          external_calls_before: callsBeforeCircuitProbe,
          external_calls_after: callsAfterCircuitProbe,
          rejected_circuit_open: verifyAfterProbe.rejectedCircuitOpen,
          circuit_open: verifyAfterProbe.circuit_open,
        },
      },
      {
        name: "cooldown_restores_dependency_traffic",
        pass: recoveryPass,
        details: {
          recovered_valid: recoveredVerify.valid,
          circuit_open_after_recovery: recoveredVerifyState.circuit_open,
        },
      },
      {
        name: "settlement_outage_concurrency_is_bounded",
        pass: settleStormPass,
        details: {
          requests: settleStormSize,
          external_calls: externalCalls,
          rejected_saturated: settleState.rejectedSaturated,
          max_in_flight: settleState.max_in_flight,
        },
      },
    ],
  };

  await mkdir("artifacts", { recursive: true });
  await writeFile(ARTIFACT, JSON.stringify(evidence, null, 2) + "\n", "utf8");
  console.log(JSON.stringify(evidence, null, 2));
  configureX402Fetch();
  if (!allScenariosPass) process.exitCode = 1;
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
