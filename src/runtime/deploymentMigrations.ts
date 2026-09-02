import { Pool, type PoolClient } from "pg";
import { distributedMoneyDatabaseUrl } from "./distributedMoney.js";

export const CURRENT_DEPLOYMENT_SCHEMA_VERSION = 1;
const MIGRATION_LOCK_KEY = 5060317001;

type Migration = {
  version: number;
  name: string;
  apply: (client: PoolClient) => Promise<void>;
};

const migrations: Migration[] = [
  {
    version: 1,
    name: "x402-recovery-lease-expiry-index",
    apply: async client => {
      // Additive migration only. The index is intentionally left in place during
      // an application rollback so the previous release can continue operating
      // against the forward-migrated schema.
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_missing_x402_recovery_lease_expiry
          ON missing_x402_payments(state, lease_expires_at)
          WHERE state IN ('reserved','executing','provider_done','settling')
      `);
    },
  },
];

export type DeploymentMigrationRecord = {
  version: number;
  name: string;
  applied_at: string;
};

export type DeploymentMigrationStatus = {
  current_version: number;
  target_version: number;
  applied: DeploymentMigrationRecord[];
};

function databaseUrl(): string {
  const value = distributedMoneyDatabaseUrl();
  if (!value) throw new Error("deployment migrations require MISSING_POSTGRES_URL or DATABASE_URL");
  return value;
}

async function ensureLedger(client: PoolClient) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS missing_schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function readStatus(client: PoolClient): Promise<DeploymentMigrationStatus> {
  await ensureLedger(client);
  const result = await client.query<{ version: number; name: string; applied_at: Date | string }>(
    `SELECT version,name,applied_at FROM missing_schema_migrations ORDER BY version ASC`,
  );
  const applied = result.rows.map(row => ({
    version: Number(row.version),
    name: row.name,
    applied_at: row.applied_at instanceof Date ? row.applied_at.toISOString() : String(row.applied_at),
  }));
  return {
    current_version: applied.reduce((max, row) => Math.max(max, row.version), 0),
    target_version: CURRENT_DEPLOYMENT_SCHEMA_VERSION,
    applied,
  };
}

export async function deploymentMigrationStatus(): Promise<DeploymentMigrationStatus> {
  const pool = new Pool({ connectionString: databaseUrl(), max: 1, application_name: "missing-deployment-migration-status" });
  const client = await pool.connect();
  try {
    return await readStatus(client);
  } finally {
    client.release();
    await pool.end();
  }
}

export async function migrateDeploymentSchema(): Promise<DeploymentMigrationStatus> {
  const pool = new Pool({ connectionString: databaseUrl(), max: 1, application_name: "missing-deployment-migrator" });
  const client = await pool.connect();
  let locked = false;
  try {
    await client.query(`SELECT pg_advisory_lock($1)`, [MIGRATION_LOCK_KEY]);
    locked = true;
    await ensureLedger(client);

    for (const migration of migrations) {
      const existing = await client.query<{ name: string }>(
        `SELECT name FROM missing_schema_migrations WHERE version=$1`,
        [migration.version],
      );
      if (existing.rowCount) {
        if (existing.rows[0]?.name !== migration.name) {
          throw new Error(`deployment migration version ${migration.version} name mismatch`);
        }
        continue;
      }

      // Each migration must be backward compatible with the immediately previous
      // application release. We never drop the migration during binary rollback.
      await migration.apply(client);
      await client.query(
        `INSERT INTO missing_schema_migrations(version,name) VALUES ($1,$2)`,
        [migration.version, migration.name],
      );
    }

    return await readStatus(client);
  } finally {
    if (locked) await client.query(`SELECT pg_advisory_unlock($1)`, [MIGRATION_LOCK_KEY]).catch(() => undefined);
    client.release();
    await pool.end();
  }
}
