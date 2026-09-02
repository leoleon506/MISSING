import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { agentRequestHash, requestBindingStatus } from "./runtime/requestBinding.js";
import { distributedPayment, initializeDistributedMoney, truncateDistributedMoney } from "./runtime/distributedMoney.js";

process.env.MISSING_DISTRIBUTED_MONEY_ENABLED = "1";
process.env.MISSING_TRANSACTIONAL_RESPONSE_CACHE_ENABLED = "0";

const races = Number(process.env.MISSING_KAPPA53_RACES ?? 20);
if (!Number.isInteger(races) || races < 20) throw new Error("Kappa.5.3 requires at least 20 races");
if (!process.env.MISSING_POSTGRES_URL && !process.env.DATABASE_URL) throw new Error("Kappa.5.3 requires PostgreSQL");

const artifactsDir = resolve("artifacts");
mkdirSync(artifactsDir, { recursive: true });
const probePath = resolve(artifactsDir, "kappa53-provider-probe.tsv");
rmSync(probePath, { force: true });
writeFileSync(probePath, "", "utf8");

await initializeDistributedMoney();
await truncateDistributedMoney();

function sha(value: string) { return createHash("sha256").update(value).digest("hex"); }
function worker(args: string[]) {
  return new Promise<any>((resolvePromise, reject) => {
    const child = spawn(process.execPath, ["--import", "tsx", "src/experimentKappa53Worker.ts", ...args], {
      env: { ...process.env, MISSING_DISTRIBUTED_MONEY_ENABLED: "1", MISSING_TRANSACTIONAL_RESPONSE_CACHE_ENABLED: "0" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = ""; let stderr = "";
    child.stdout.on("data", chunk => stdout += chunk);
    child.stderr.on("data", chunk => stderr += chunk);
    child.on("error", reject);
    child.on("close", code => {
      if (code !== 0) return reject(new Error(`replica exited ${code}: ${stderr}`));
      try { resolvePromise(JSON.parse(stdout)); } catch { reject(new Error(`invalid replica output: ${stdout} ${stderr}`)); }
    });
  });
}

const runs: any[] = [];
let successfulExclusions = 0;
let duplicateProviderExecutions = 0;

for (let i = 1; i <= races; i++) {
  const raceId = `k53-${String(i).padStart(2, "0")}`;
  const capability = "ip_geolocation_metadata";
  const input = { ip_address: `198.51.100.${(i % 200) + 1}`, race: i };
  const inputB64 = Buffer.from(JSON.stringify(input)).toString("base64");
  const paymentHash = sha(`kappa53-payment-${i}-${Date.now()}-${process.pid}`);
  const requestHash = agentRequestHash(capability, input);

  const [a, b] = await Promise.all([
    worker([raceId, "A", paymentHash, capability, inputB64, probePath]),
    worker([raceId, "B", paymentHash, capability, inputB64, probePath]),
  ]);

  const row = await distributedPayment(paymentHash);
  const probeLines = readFileSync(probePath, "utf8").split("\n").filter(Boolean).filter(line => line.startsWith(`${raceId}\t`));
  const winners = [a, b].filter(x => x.reservation_won);
  const duplicate = probeLines.length !== 1 || winners.length !== 1;
  if (duplicate) duplicateProviderExecutions++;
  else successfulExclusions++;

  const changedHash = agentRequestHash(capability, { ...input, changed: true });
  const changedRequestControl = row ? requestBindingStatus(row.request_hash, changedHash) : "missing";

  runs.push({
    race_id: raceId,
    replicas: [a, b],
    winning_replica: winners[0]?.replica ?? null,
    authoritative_payment_rows: row ? 1 : 0,
    authoritative_state: row?.state ?? null,
    stored_request_hash_matches: row?.request_hash === requestHash,
    global_provider_execution_count: probeLines.length,
    duplicate_execution: duplicate,
    changed_request_control: changedRequestControl,
  });
}

const first = runs[0];
let legacyControl = "not_run";
if (first) {
  legacyControl = requestBindingStatus(null, "0".repeat(64));
}

const result = duplicateProviderExecutions === 0 && successfulExclusions === races && runs.every(r => r.authoritative_payment_rows === 1 && r.stored_request_hash_matches && r.changed_request_control === "mismatch") && legacyControl === "legacy_unbound"
  ? "GO_TWO_REPLICA_PAYMENT_EXCLUSION"
  : "NO_GO_TWO_REPLICA_PAYMENT_EXCLUSION";

const artifact = {
  experiment: "Product Kappa.5.3",
  replicas: 2,
  races,
  successful_exclusions: successfulExclusions,
  duplicate_provider_executions: duplicateProviderExecutions,
  response_cache_enabled: false,
  changed_request_controls: runs.filter(r => r.changed_request_control === "mismatch").length,
  legacy_unbound_control: legacyControl,
  result,
  runs,
};

writeFileSync(resolve(artifactsDir, "product-kappa53-two-replica-exclusion.json"), JSON.stringify(artifact, null, 2) + "\n", "utf8");
console.log(JSON.stringify({ result, races, successfulExclusions, duplicateProviderExecutions, legacyControl }, null, 2));
if (result !== "GO_TWO_REPLICA_PAYMENT_EXCLUSION") process.exitCode = 1;
