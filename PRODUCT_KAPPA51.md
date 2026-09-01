# Product Kappa.5.1 — Distributed Money Core

Kappa.5.1 moves the authoritative x402 payment state from a host-local SQLite database to a shared PostgreSQL database when explicitly enabled. Kappa.5 SQLite remains available as a rollback path and is not deleted.

## Goal

Multiple MISSING replicas may receive the same x402 authorization concurrently, but PostgreSQL must allow at most one economic execution to own a `payment_hash`.

## Configuration

Required to enable the distributed authority:

- `MISSING_DISTRIBUTED_MONEY_ENABLED=1`
- `MISSING_POSTGRES_URL=<postgresql connection URL>` or `DATABASE_URL=<postgresql connection URL>`
- `MISSING_TRANSACTIONAL_RESPONSE_CACHE_ENABLED=1` recommended

Optional:

- `MISSING_POSTGRES_SSLMODE=prefer|require|disable` (default `prefer`)
- `MISSING_POSTGRES_TIMEOUT_MS=10000`
- `MISSING_PSQL_BIN=psql`
- `MISSING_X402_RPC_URL=<EVM JSON-RPC URL>` for on-chain settlement reconciliation

When distributed money is enabled, startup initializes the PostgreSQL schema before the HTTP server listens. Failure is fail-closed; MISSING does not silently fall back to SQLite.

## PostgreSQL invariants

Table `missing_x402_payments` enforces:

- `PRIMARY KEY(payment_hash)`
- `UNIQUE(execution_id)`
- `UNIQUE(transaction_reference)` when present
- state check: `reserved | settling | settled | failed`

Reservation uses one atomic statement:

`INSERT ... ON CONFLICT (payment_hash) DO NOTHING RETURNING *`

Therefore two replicas can verify the same authorization concurrently, but only one can reserve it and proceed to provider execution.

## State machine

`reserved -> settling -> settled`

`reserved -> failed`

`settling -> failed` for explicit terminal settlement failure

`settling` remains non-terminal for transport ambiguity and x402 `settlement_pending`.

Before settlement, PostgreSQL stores realized provider attempt cost, attempt counts, network and the successful provider resolution. This allows recovery without re-running the provider.

## Reconciliation

If the facilitator returns `settlement_pending` with a transaction hash, MISSING persists the hash while leaving the row in `settling`.

On a retry of the same payment hash:

1. MISSING reads PostgreSQL before facilitator verification or provider execution.
2. If the row is `settling` and has a transaction hash, it checks `eth_getTransactionReceipt` through `MISSING_X402_RPC_URL`.
3. Confirmed receipt (`status=0x1`) commits the stored resolution as `settled` and returns HTTP 200.
4. Failed receipt (`status=0x0`) transitions to `failed`.
5. Pending/unavailable receipt returns reconciliation-required and performs no provider execution.

A transport timeout before any transaction hash is known remains fail-closed in `settling`; operator/automated reconciliation still needs an external transaction reference to resolve it safely.

## Compatibility

Kappa.3/Kappa.4 JSONL x402/economics telemetry remains append-only compatibility telemetry after successful settlement. Kappa.5 SQLite remains available when distributed money is disabled.

## Implementation note

The runtime image installs the official PostgreSQL `psql` client. This milestone intentionally uses one short-lived `psql` process per authoritative operation to avoid introducing a new npm dependency/lockfile change while proving distributed database semantics. A pooled Node PostgreSQL driver is a performance optimization, not a correctness prerequisite.

## Remaining mainnet gates

- production PostgreSQL backups/PITR and connection limits
- reconciliation for ambiguous settlement without a transaction hash
- explicit RPC trust/redundancy and confirmation-depth policy
- provider-attempt COGS should ultimately be committed in the same shared transactional database rather than compatibility JSONL
- spend/price limits, alarms, and mainnet asset/facilitator verification
