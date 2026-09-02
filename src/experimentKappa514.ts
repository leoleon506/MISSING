import { Pool } from "pg";
import { mkdir, writeFile } from "node:fs/promises";
import {
  CURRENT_DISTRIBUTED_RECOVERY_PROTOCOL_VERSION,
  claimDistributedRecovery,
  closeDistributedMoney,
  distributedPayment,
  initializeDistributedMoney,
  reserveDistributedPayment,
  truncateDistributedMoney,
} from "./runtime/distributedMoney.js";
import { agentRequestHash } from "./runtime/requestBinding.js";

process.env.MISSING_DISTRIBUTED_MONEY_ENABLED = "1";
process.env.MISSING_TRANSACTIONAL_RESPONSE_CACHE_ENABLED = "0";
process.env.MISSING_X402_RECOVERY_LEASE_MS = "100";
process.env.MISSING_X402_LEASE_HEARTBEAT_MS = "30";

const databaseUrl = process.env.MISSING_POSTGRES_URL ?? process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("Kappa.5.14 requires PostgreSQL");

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const pool = new Pool({ connectionString: databaseUrl, ssl: false });

await initializeDistributedMoney();
await truncateDistributedMoney();

async function seedActiveRow(args: { paymentHash: string; requestHash: string; executionId: string; version: number | null }) {
  await pool.query(
    `INSERT INTO missing_x402_payments(
      payment_hash, request_hash, execution_id, capability, state,
      lease_token, lease_fence, lease_expires_at, recovery_protocol_version
    ) VALUES ($1,$2,$3,'kappa514_upgrade_probe','reserved',$3,1,NOW() - INTERVAL '1 second',$4)`,
    [args.paymentHash, args.requestHash, args.executionId, args.version],
  );
}

async function quarantineScenario(name: string, version: number | null) {
  const paymentHash = `kappa514-${name}`;
  const requestHash = agentRequestHash("kappa514_upgrade_probe", { scenario: name });
  await seedActiveRow({ paymentHash, requestHash, executionId: `exec-${name}`, version });

  let providerCalls = 0;
  let settlementCalls = 0;
  const externalProvider = () => { providerCalls += 1; };
  const externalSettlement = () => { settlementCalls += 1; };

  const claimed = await claimDistributedRecovery({
    paymentHash,
    requestHash,
    leaseToken: `recovery-${name}`,
  });
  if (claimed.claimed) {
    // This branch represents the external work the orchestrator would be allowed
    // to reach only when the durable protocol is trusted.
    externalProvider();
    externalSettlement();
  }
  const final = await distributedPayment(paymentHash);
  return {
    input_version: version,
    claimed: claimed.claimed,
    returned_record: claimed.record !== null,
    quarantined_state: final?.state ?? null,
    quarantined_reason: final?.reason ?? null,
    final_fence: final?.lease_fence ?? null,
    lease_released: final?.lease_token === null && final?.lease_expires_at === null,
    provider_calls: providerCalls,
    settlement_calls: settlementCalls,
  };
}

const legacy = await quarantineScenario("legacy-null", null);
const unknown = await quarantineScenario("unknown-99", 99);

const currentHash = "kappa514-current";
const currentRequestHash = agentRequestHash("kappa514_upgrade_probe", { scenario: "current" });
const currentReservation = await reserveDistributedPayment({
  paymentHash: currentHash,
  requestHash: currentRequestHash,
  executionId: "exec-current",
  capability: "kappa514_upgrade_probe",
});
const currentBefore = await distributedPayment(currentHash);
await sleep(160);
closeDistributedMoney();
await initializeDistributedMoney();
const currentClaim = await claimDistributedRecovery({
  paymentHash: currentHash,
  requestHash: currentRequestHash,
  leaseToken: "recovery-current",
});
const currentAfter = await distributedPayment(currentHash);

const assertions = {
  new_reservation_persists_current_protocol:
    currentReservation.reserved === true && currentBefore?.recovery_protocol_version === CURRENT_DISTRIBUTED_RECOVERY_PROTOCOL_VERSION,
  legacy_null_quarantined:
    legacy.claimed === false && legacy.returned_record === false && legacy.quarantined_state === "ambiguous" && legacy.quarantined_reason === "recovery_protocol_version_untrusted:legacy",
  unknown_version_quarantined:
    unknown.claimed === false && unknown.returned_record === false && unknown.quarantined_state === "ambiguous" && unknown.quarantined_reason === "recovery_protocol_version_untrusted:99",
  legacy_quarantine_is_fenced_and_releases_lease:
    legacy.final_fence === 2 && legacy.lease_released,
  unknown_quarantine_is_fenced_and_releases_lease:
    unknown.final_fence === 2 && unknown.lease_released,
  untrusted_rows_cannot_reach_external_effects:
    legacy.provider_calls === 0 && legacy.settlement_calls === 0 && unknown.provider_calls === 0 && unknown.settlement_calls === 0,
  current_protocol_remains_recoverable:
    currentClaim.claimed === true && currentClaim.record?.recovery_protocol_version === CURRENT_DISTRIBUTED_RECOVERY_PROTOCOL_VERSION && currentAfter?.lease_fence === 2,
};

const passed = Object.values(assertions).every(Boolean);
const artifact = {
  product: "Kappa.5.14",
  invariant: "only active rows created under the current durable recovery protocol may resume external work; legacy or unknown active rows are fenced and quarantined fail-closed",
  current_protocol_version: CURRENT_DISTRIBUTED_RECOVERY_PROTOCOL_VERSION,
  legacy,
  unknown,
  current: {
    reservation_version: currentBefore?.recovery_protocol_version ?? null,
    claimed: currentClaim.claimed,
    final_state: currentAfter?.state ?? null,
    final_fence: currentAfter?.lease_fence ?? null,
  },
  assertions,
  result: passed ? "GO_DURABLE_RECOVERY_PROTOCOL_VERSIONING" : "NO_GO_DURABLE_RECOVERY_PROTOCOL_VERSIONING",
};

await mkdir("artifacts", { recursive: true });
await writeFile("artifacts/product-kappa514-durable-recovery-protocol-versioning.json", `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ result: artifact.result, assertions: artifact.assertions, legacy: artifact.legacy, unknown: artifact.unknown, current: artifact.current }, null, 2));

closeDistributedMoney();
await pool.end();
if (!passed) process.exitCode = 1;
