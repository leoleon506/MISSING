# Operational Readiness 3 — Deployment, Migration & Rollback Drill

OR3 proves that MISSING can deploy a forward-compatible database migration and roll the application binary back to the immediately previous production release without losing durable x402 payment state or reopening ownership.

## Strategy

MISSING uses an expand/contract deployment model. OR3 only introduces additive schema changes. Database migrations are not rolled back during an emergency application rollback; the previous application release must tolerate the forward-migrated schema.

The previous release used by the formal drill is the exact OR2 merge commit:

`b0f4336d91a7abf0a76ae9bea9a2c6cb831c7f4e`

## Drill

1. Start PostgreSQL 16 and initialize the current distributed-money schema.
2. Create a durable payment before the upgrade.
3. Apply the versioned migration twice and prove it is idempotent.
4. Create a second durable payment after the upgrade.
5. Start the exact previous release against the same forward-migrated PostgreSQL database.
6. Verify that the previous release can read both payments.
7. Attempt to reserve the post-upgrade payment again from the previous release and prove that ownership is not duplicated.
8. Verify that both durable rows and the additive migration remain present after the binary rollback.

The migration ledger uses a PostgreSQL advisory lock and a primary-keyed version table. OR3's first migration adds an operational partial index for active recovery leases; it does not alter payment semantics or remove any column understood by the previous release.

## Formal assertions

- `pre_upgrade_payment_survives_upgrade`
- `post_upgrade_payment_created`
- `migration_is_idempotent`
- `previous_release_starts_on_forward_schema`
- `rollback_does_not_duplicate_existing_payment`
- `durable_rows_preserved_across_upgrade_and_rollback`
- `additive_migration_remains_after_binary_rollback`

Formal GO target:

`GO_OPERATIONAL_DEPLOYMENT_MIGRATION_ROLLBACK`

This drill proves compatibility for the exact immediately previous release and this additive migration. It does not claim arbitrary downgrade compatibility across all historical versions.
