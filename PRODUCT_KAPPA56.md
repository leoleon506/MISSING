# Product Kappa.5.6 — Native PostgreSQL Driver & Pooling

Kappa.5.6 removes the synchronous `psql` subprocess from distributed x402 money state and replaces it with a reusable native `pg.Pool`.

## Invariant preservation

This milestone deliberately keeps the previously proven money semantics unchanged:

- `PRIMARY KEY(payment_hash)` remains authoritative;
- `execution_id` remains unique;
- settlement transaction references remain unique;
- reservation still uses `INSERT ... ON CONFLICT (payment_hash) DO NOTHING RETURNING *`;
- request binding remains stored atomically with reservation;
- the state machine remains `reserved -> settling -> settled`, with fail-closed transitions to `failed`;
- Kappa.5.3 cross-replica exclusion still depends on PostgreSQL uniqueness, not process-local locks;
- Kappa.5.4 exact ERC-20 proof and Kappa.5.5 finality/reorg proof are unchanged.

## Native backend

`src/runtime/distributedMoney.ts` now uses `pg.Pool` instead of spawning one `psql` process per operation.

The internal SQL is intentionally preserved. Existing named variables of the form `:'payment_hash'` are converted to native PostgreSQL positional parameters (`$1`, `$2`, ...), and values are passed separately through the driver. Payment identifiers and all other dynamic values therefore remain data rather than SQL text.

The pool is lazy and reusable across operations. Configuration:

- `MISSING_POSTGRES_URL` or `DATABASE_URL` — required when distributed money is enabled;
- `MISSING_POSTGRES_SSLMODE` — optional override of connection-string sslmode;
- `MISSING_POSTGRES_POOL_MAX` — maximum pool size, default 10;
- `MISSING_POSTGRES_TIMEOUT_MS` — connection/query/statement timeout, default 10000 ms;
- `MISSING_POSTGRES_IDLE_TIMEOUT_MS` — idle client timeout, default 30000 ms;
- `MISSING_POSTGRES_APPLICATION_NAME` — optional PostgreSQL application name.

The old `MISSING_PSQL_BIN` setting is no longer used by the distributed money backend.

## Health evidence

The distributed money snapshot reports:

- backend `postgres-native`;
- pool total clients;
- pool idle clients;
- pool waiters;
- the existing aggregate payment/state/request-binding counts.

## Tests

The dedicated Kappa.5.6 workflow starts PostgreSQL 16 and proves the native path without installing a PostgreSQL CLI client.

`tests/productKappa56NativePostgres.test.ts` verifies:

1. twenty concurrent reservations for one payment produce exactly one winner through the native pool;
2. the request binding and authoritative row remain singular;
3. the `reserved -> settling -> settled` state machine remains unchanged;
4. hostile SQL-like payment identifiers are handled as parameter values and cannot alter schema;
5. the runtime reports backend `postgres-native` and an active pool.

The workflow also runs the full repository suite and TypeScript build. Existing Kappa.5.3, Kappa.5.4 and Kappa.5.5 workflows remain regression gates.

## Boundaries

Kappa.5.6 does not change pricing, AgentRank, provider selection, payment amounts, x402 verification, response-cache policy, exact settlement proof, confirmation depth, reorg policy or provider execution semantics.

## Decision

Emit `GO_NATIVE_POSTGRES_POOLING` only if:

- the lockfile is reproducible with `npm ci`;
- the complete repository tests pass;
- the dedicated real-PostgreSQL native-driver tests pass;
- TypeScript build passes;
- existing Kappa.5.3–5.5 regression workflows remain green.
