import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { Pool } from "pg";
import { migrateDeploymentSchema, deploymentMigrationStatus } from "./runtime/deploymentMigrations.js";
import { closeDistributedMoney, initializeDistributedMoney, reserveDistributedPayment, distributedPayment, truncateDistributedMoney } from "./runtime/distributedMoney.js";
import { agentRequestHash } from "./runtime/requestBinding.js";

const PREVIOUS_RELEASE = process.env.MISSING_OR3_PREVIOUS_RELEASE_SHA ?? "b0f4336d91a7abf0a76ae9bea9a2c6cb831c7f4e";
const repo = process.cwd();

function paymentHash(label: string) {
  return createHash("sha256").update(`OR3:${label}`).digest("hex");
}

async function runGit(...args: string[]) {
  await new Promise<void>((resolve, reject) => {
    const child = spawn("git", args, { cwd: repo, stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    child.stderr.on("data", chunk => { stderr += String(chunk); });
    child.on("exit", code => code === 0 ? resolve() : reject(new Error(`git ${args.join(" ")} failed: ${stderr}`)));
  });
}

async function runPreviousReleaseProbe(worktree: string, hashes: { before: string; after: string }) {
  const script = `
process.env.MISSING_DISTRIBUTED_MONEY_ENABLED="1";
process.env.MISSING_TRANSACTIONAL_RESPONSE_CACHE_ENABLED="0";
const mod = await import("./src/runtime/distributedMoney.ts");
await mod.initializeDistributedMoney();
const before = await mod.distributedPayment(${JSON.stringify(hashes.before)});
const after = await mod.distributedPayment(${JSON.stringify(hashes.after)});
const duplicate = await mod.reserveDistributedPayment({
  paymentHash:${JSON.stringify(hashes.after)},
  requestHash:${JSON.stringify(agentRequestHash("or3.after", { phase: "after" }))},
  executionId:"or3-rollback-duplicate",
  capability:"or3.after"
});
console.log(JSON.stringify({before:Boolean(before),after:Boolean(after),duplicate_reserved:duplicate.reserved,duplicate_execution:duplicate.prior?.execution_id ?? null}));
await mod.closeDistributedMoney();
`;
  return await new Promise<{ before: boolean; after: boolean; duplicate_reserved: boolean; duplicate_execution: string | null }>((resolve, reject) => {
    const child = spawn(process.execPath, ["--import", "tsx", "--input-type=module", "-e", script], {
      cwd: worktree,
      env: { ...process.env },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", chunk => { stdout += String(chunk); });
    child.stderr.on("data", chunk => { stderr += String(chunk); });
    child.on("exit", code => {
      if (code !== 0) return reject(new Error(`previous release probe failed: ${stderr}`));
      try { resolve(JSON.parse(stdout.trim())); } catch (error) { reject(error); }
    });
  });
}

async function main() {
  process.env.MISSING_DISTRIBUTED_MONEY_ENABLED = "1";
  process.env.MISSING_TRANSACTIONAL_RESPONSE_CACHE_ENABLED = "0";
  await initializeDistributedMoney();
  await truncateDistributedMoney();

  const beforeHash = paymentHash("before-upgrade");
  const afterHash = paymentHash("after-upgrade");
  const beforeRequest = agentRequestHash("or3.before", { phase: "before" });
  const afterRequest = agentRequestHash("or3.after", { phase: "after" });

  const before = await reserveDistributedPayment({ paymentHash: beforeHash, requestHash: beforeRequest, executionId: "or3-before", capability: "or3.before" });
  if (!before.reserved) throw new Error("could not create pre-upgrade durable payment");

  const migration1 = await migrateDeploymentSchema();
  const migration2 = await migrateDeploymentSchema();

  const after = await reserveDistributedPayment({ paymentHash: afterHash, requestHash: afterRequest, executionId: "or3-after", capability: "or3.after" });
  if (!after.reserved) throw new Error("could not create post-upgrade durable payment");

  const beforeAfterUpgrade = await distributedPayment(beforeHash);
  const afterAfterUpgrade = await distributedPayment(afterHash);
  await closeDistributedMoney();

  const worktree = `${repo}/.or3-previous-release`;
  await runGit("worktree", "remove", "--force", worktree).catch(() => undefined);
  await runGit("worktree", "add", "--detach", worktree, PREVIOUS_RELEASE);
  try {
    const rollback = await runPreviousReleaseProbe(worktree, { before: beforeHash, after: afterHash });

    const pool = new Pool({ connectionString: process.env.MISSING_POSTGRES_URL ?? process.env.DATABASE_URL, max: 1 });
    const rows = await pool.query<{ payment_hash: string; execution_id: string }>(
      `SELECT payment_hash,execution_id FROM missing_x402_payments WHERE payment_hash = ANY($1::text[]) ORDER BY payment_hash`,
      [[beforeHash, afterHash]],
    );
    const migrationRows = await pool.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM missing_schema_migrations`);
    const indexRows = await pool.query<{ exists: boolean }>(`SELECT to_regclass('idx_missing_x402_recovery_lease_expiry') IS NOT NULL AS exists`);
    await pool.end();

    const status = await deploymentMigrationStatus();
    const assertions = {
      pre_upgrade_payment_survives_upgrade: Boolean(beforeAfterUpgrade),
      post_upgrade_payment_created: Boolean(afterAfterUpgrade),
      migration_is_idempotent: migration1.current_version === migration2.current_version && migrationRows.rows[0]?.count === "1",
      previous_release_starts_on_forward_schema: rollback.before && rollback.after,
      rollback_does_not_duplicate_existing_payment: rollback.duplicate_reserved === false && rollback.duplicate_execution === "or3-after",
      durable_rows_preserved_across_upgrade_and_rollback: rows.rowCount === 2,
      additive_migration_remains_after_binary_rollback: indexRows.rows[0]?.exists === true && status.current_version === 1,
    };
    const go = Object.values(assertions).every(Boolean);
    const evidence = {
      result: go ? "GO_OPERATIONAL_DEPLOYMENT_MIGRATION_ROLLBACK" : "NO_GO_OPERATIONAL_DEPLOYMENT_MIGRATION_ROLLBACK",
      previous_release: PREVIOUS_RELEASE,
      assertions,
      migration: status,
      rows: rows.rows,
      rollback,
    };
    mkdirSync("artifacts", { recursive: true });
    writeFileSync("artifacts/operational-readiness-3-deployment-migration-rollback.json", JSON.stringify(evidence, null, 2));
    console.log(JSON.stringify(evidence, null, 2));
    if (!go) process.exitCode = 1;
  } finally {
    await runGit("worktree", "remove", "--force", worktree).catch(() => undefined);
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
