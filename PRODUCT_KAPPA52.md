# Product Kappa.5.2 — Canonical Request Binding

Kappa.5.2 binds each transactional x402 payment authorization to the exact MISSING request it paid for.

## Security invariant

A payment stored for one canonical request cannot be reused to recover, cache, reconcile, or execute a different request.

The binding is:

`SHA-256("MISSING:x402-request:v1\n" || canonical_json({ capability, input }))`

The raw capability input is not persisted in the money database. Only the 64-character request hash is stored beside the existing payment hash.

## Canonicalization

- object keys are recursively sorted;
- array order is preserved;
- strings, booleans, null and finite JSON numbers are preserved;
- negative zero normalizes to zero;
- undefined/non-finite/non-JSON values fail before payment processing.

This makes semantically identical JSON objects stable across key order while ensuring changed capability/input material changes the binding.

## Replay behavior

When a known payment signature is presented, MISSING checks the stored request hash before cached response recovery, settlement reconciliation, facilitator verification, or provider execution.

- exact request hash: existing Kappa.5/Kappa.5.1 replay behavior continues;
- different request hash: HTTP 409 `payment_request_mismatch`;
- historical row with no request hash: HTTP 409 `payment_request_binding_unavailable`.

A mismatch never returns the previously cached capability output.

## SQLite migration

New `x402_payments` tables contain `request_hash TEXT`.

Existing Kappa.5 databases are migrated with `ALTER TABLE ... ADD COLUMN request_hash TEXT`. Existing rows remain NULL and are deliberately classified as `legacy_unbound` rather than being guessed or backfilled from data MISSING does not retain.

## PostgreSQL migration

The shared Kappa.5.1 table is migrated using:

`ALTER TABLE missing_x402_payments ADD COLUMN IF NOT EXISTS request_hash TEXT`

All new distributed reservations persist the canonical request hash atomically with the payment reservation. Existing rows remain `legacy_unbound` and fail closed on replay.

Health snapshots expose aggregate `request_bound` and `legacy_unbound` counts without exposing request hashes or raw input.

## Response cache

Kappa.5.2 closes the request-confusion flaw that previously made response caching unsafe: a cached response can only be reached after the stored request binding matches the current request.

Production should nevertheless keep `MISSING_TRANSACTIONAL_RESPONSE_CACHE_ENABLED=0` until the migrated Railway runtime and a fresh request-bound payment have been validated. Re-enabling cache is a separate operational decision, not part of this code merge.

## Deliberate boundaries

Kappa.5.2 does not change x402 pricing, settlement, provider economics, AgentRank, provider execution, or the payment transaction state machine.

It also does not complete the postponed two-replica exclusion experiment, replace the synchronous `psql` subprocess backend, or upgrade settlement reconciliation to validate stablecoin transfer logs. Those remain separate production-hardening milestones.
