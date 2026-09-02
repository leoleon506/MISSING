import { mkdir, writeFile } from "node:fs/promises";
import { handleAgentPaidResolution } from "./runtime/agentPayments.js";
import {
  closeDistributedMoney,
  initializeDistributedMoney,
  truncateDistributedMoney,
} from "./runtime/distributedMoney.js";
import {
  settledReorgMonitorSnapshot,
  startSettledX402ReorgMonitor,
  stopSettledX402ReorgMonitor,
} from "./runtime/settledReorgMonitor.js";
import {
  configureX402Fetch,
  productionAdmissionSnapshot,
  x402Ready,
} from "./runtime/x402.js";
import { readinessPayload } from "./mcp/http.js";

const BASE_RELEASE = "fa388df6417bc5ab4fadf7a5b21f963a64af08ba";
const asset = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
const payTo = "0x209693Bc6afc0C5328bA36FaF03C514EF312287C";
const network = "eip155:84532";

Object.assign(process.env, {
  MISSING_PRODUCTION_ADMISSION_ENABLED: "1",
  MISSING_AGENT_PAYMENTS_ENABLED: "1",
  MISSING_X402_ENABLED: "1",
  MISSING_X402_NETWORK: network,
  MISSING_X402_ASSET: asset,
  MISSING_X402_PAY_TO: payTo,
  MISSING_X402_FACILITATOR_URL: "https://facilitator.or5.invalid",
  MISSING_X402_FACILITATOR_IDEMPOTENCY: "1",
  MISSING_X402_RPC_URL: "http://127.0.0.1:18545",
  MISSING_X402_FINALITY_POLICIES: JSON.stringify({ [network]: 2 }),
  MISSING_DISTRIBUTED_MONEY_ENABLED: "1",
  MISSING_TRANSACTIONAL_RESPONSE_CACHE_ENABLED: "0",
  MISSING_X402_SETTLED_REORG_MONITOR_ENABLED: "1",
  MISSING_X402_SETTLED_REORG_MONITOR_INTERVAL_MS: "60000",
  MISSING_X402_SETTLED_REORG_MONITOR_BATCH_SIZE: "10",
});

type Scenario = { name: string; pass: boolean; details: Record<string, unknown> };
const scenarios: Scenario[] = [];
const record = (name: string, pass: boolean, details: Record<string, unknown>) => scenarios.push({ name, pass, details });
const resetPolicy = () => {
  process.env.MISSING_X402_NETWORK = network;
  process.env.MISSING_X402_FINALITY_POLICIES = JSON.stringify({ [network]: 2 });
  process.env.MISSING_X402_FACILITATOR_IDEMPOTENCY = "1";
  process.env.MISSING_X402_RPC_URL = "http://127.0.0.1:18545";
  process.env.MISSING_DISTRIBUTED_MONEY_ENABLED = "1";
  process.env.MISSING_TRANSACTIONAL_RESPONSE_CACHE_ENABLED = "0";
  process.env.MISSING_X402_SETTLED_REORG_MONITOR_ENABLED = "1";
};

await initializeDistributedMoney();
await truncateDistributedMoney();
startSettledX402ReorgMonitor();
// The monitor marks itself running synchronously; give its first empty audit cycle
// time to initialize the audit table and prove it has not entered an error state.
await new Promise(resolve => setTimeout(resolve, 100));

{
  const admission = productionAdmissionSnapshot();
  record("healthy_production_configuration_admits", admission.ready && x402Ready(), {
    admission,
    monitor: settledReorgMonitorSnapshot(),
  });
}

{
  process.env.MISSING_X402_NETWORK = "eip155:999999";
  const admission = productionAdmissionSnapshot();
  record("missing_chain_finality_policy_fails_closed", !admission.ready && admission.reasons.includes("finality_policy_not_ready") && !x402Ready(), { admission });
  resetPolicy();
}

{
  process.env.MISSING_X402_FINALITY_POLICIES = "{malformed";
  const admission = productionAdmissionSnapshot();
  record("malformed_finality_policy_fails_closed", !admission.ready && admission.reasons.includes("finality_policy_not_ready") && !x402Ready(), { admission });
  resetPolicy();
}

{
  process.env.MISSING_X402_FACILITATOR_IDEMPOTENCY = "0";
  const admission = productionAdmissionSnapshot();
  record("missing_facilitator_idempotency_contract_fails_closed", !admission.ready && admission.reasons.includes("facilitator_idempotency_contract_not_enabled"), { admission });
  resetPolicy();
}

{
  delete process.env.MISSING_X402_RPC_URL;
  const admission = productionAdmissionSnapshot();
  record("missing_rpc_fails_closed", !admission.ready && admission.reasons.includes("x402_rpc_not_configured"), { admission });
  resetPolicy();
}

{
  process.env.MISSING_TRANSACTIONAL_RESPONSE_CACHE_ENABLED = "1";
  const admission = productionAdmissionSnapshot();
  record("unsafe_transactional_response_cache_fails_closed", !admission.ready && admission.reasons.includes("transactional_response_cache_not_disabled"), { admission });
  resetPolicy();
}

{
  process.env.MISSING_X402_SETTLED_REORG_MONITOR_ENABLED = "0";
  const admission = productionAdmissionSnapshot();
  record("disabled_post_settlement_monitor_fails_closed", !admission.ready && admission.reasons.includes("settled_reorg_monitor_not_enabled"), { admission });
  resetPolicy();
}

{
  await stopSettledX402ReorgMonitor();
  const admission = productionAdmissionSnapshot();
  record("stopped_post_settlement_monitor_fails_closed", !admission.ready && admission.reasons.includes("settled_reorg_monitor_not_running"), { admission });
}

{
  closeDistributedMoney();
  const admission = productionAdmissionSnapshot();
  record("distributed_backend_not_ready_fails_closed", !admission.ready && admission.reasons.includes("distributed_money_not_ready"), { admission });
  await initializeDistributedMoney();
  startSettledX402ReorgMonitor();
  await new Promise(resolve => setTimeout(resolve, 100));
}

{
  let facilitatorCalls = 0;
  configureX402Fetch((async () => {
    facilitatorCalls += 1;
    return new Response(JSON.stringify({ isValid: true }), { status: 200 });
  }) as typeof fetch);
  process.env.MISSING_X402_NETWORK = "eip155:999999";
  const signature = Buffer.from(JSON.stringify({ payment: "or5" }), "utf8").toString("base64url");
  const result = await handleAgentPaidResolution({
    request: { capability: "country_alpha_metadata", input: { country_code: "CR" } },
    paymentSignature: signature,
    resourceUrl: "https://missing.or5.test/v1/agent/resolve",
  });
  record("rejected_paid_request_stops_before_payment_verification_and_provider", result.status === 503 && facilitatorCalls === 0, {
    status: result.status,
    body: result.body,
    facilitator_calls: facilitatorCalls,
  });
  configureX402Fetch();
  resetPolicy();
}

{
  process.env.MISSING_X402_FINALITY_POLICIES = "{malformed";
  const readiness = readinessPayload("https://missing.or5.test");
  record("readiness_exposes_machine_readable_admission_failure", readiness.status === "not_ready" && !readiness.production_admission.ready && readiness.production_admission.reasons.includes("finality_policy_not_ready"), {
    status: readiness.status,
    production_admission: readiness.production_admission,
  });
  resetPolicy();
}

{
  const admission = productionAdmissionSnapshot();
  record("final_healthy_state_is_ready", admission.ready && admission.reasons.length === 0 && x402Ready(), { admission });
}

const assertions = {
  all_scenarios_pass: scenarios.every(item => item.pass),
  rejected_configs_fail_closed: scenarios.filter(item => item.name.includes("fails_closed")).every(item => item.pass),
  paid_rejection_occurs_before_external_verification: scenarios.find(item => item.name === "rejected_paid_request_stops_before_payment_verification_and_provider")?.pass === true,
  readiness_is_machine_readable: scenarios.find(item => item.name === "readiness_exposes_machine_readable_admission_failure")?.pass === true,
  healthy_configuration_admits: scenarios.find(item => item.name === "final_healthy_state_is_ready")?.pass === true,
};

const passed = Object.values(assertions).every(Boolean);
const evidence = {
  product: "Operational Readiness 5",
  base_release: BASE_RELEASE,
  invariant: "production paid traffic is admitted only when durable x402 safety prerequisites are healthy before external work",
  result: passed ? "GO_OPERATIONAL_FAIL_CLOSED_ADMISSION_READINESS" : "NO_GO_OPERATIONAL_FAIL_CLOSED_ADMISSION_READINESS",
  assertions,
  scenarios,
};

await mkdir("artifacts", { recursive: true });
await writeFile("artifacts/operational-readiness-5-fail-closed-admission-readiness.json", `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ result: evidence.result, base_release: BASE_RELEASE, assertions, scenarios: scenarios.map(item => ({ name: item.name, pass: item.pass })) }, null, 2));

await stopSettledX402ReorgMonitor();
closeDistributedMoney();
configureX402Fetch();
if (!passed) process.exitCode = 1;
