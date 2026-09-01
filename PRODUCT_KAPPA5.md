# Product Kappa.5 — Transactional Money Core

Kappa.5 replaces the authoritative x402 payment state machine for a single MISSING instance with a transactional SQLite database while preserving Kappa.4 JSONL ledgers as compatibility telemetry.

## Goal

Close the crash windows around autonomous x402 payments without weakening the existing verified-provider boundary.

The authoritative payment state is keyed by the SHA-256 payment hash:

`reserved -> settling -> settled`

or

`reserved -> failed`

An explicit unsuccessful settlement may transition `settling -> failed`. A settlement transport timeout or other ambiguous facilitator failure does **not** transition to failed; it remains `settling` and requires reconciliation.

## Invariants

- `payment_hash` is a database primary key.
- `execution_id` is unique.
- a known payment is checked before facilitator verification, avoiding unnecessary verify calls on replay;
- a payment in `settling` cannot re-run the provider;
- a settled payment cannot re-run the provider;
- successful settlement state, transaction reference, price, realized provider cost and realized margin commit into one database row;
- when response caching is enabled, the successful HTTP status, headers and body are persisted so a retry after a lost response can return the original result without facilitator verification or provider execution;
- raw payment signatures are never persisted.

## Configuration

Enable the transactional core:

```text
MISSING_TRANSACTIONAL_MONEY_ENABLED=1
```

Optional explicit database path:

```text
MISSING_TRANSACTIONAL_MONEY_DB=/data/money.sqlite
```

Otherwise the database is placed next to the economics ledger. On Railway this resolves to `/data/money.sqlite` when the existing `/data` persistence layout is used.

Enable successful response recovery:

```text
MISSING_TRANSACTIONAL_RESPONSE_CACHE_ENABLED=1
```

Response caching is opt-in because capability outputs may contain user-provided or provider-returned data. It should only be enabled after the deployment's data-retention/privacy policy is acceptable.

## Storage properties

The SQLite database enables:

- `journal_mode=WAL`;
- `synchronous=FULL`;
- `busy_timeout=5000`;
- `PRIMARY KEY(payment_hash)`;
- `UNIQUE(execution_id)`;
- unique non-null settlement transaction references.

Kappa.4 JSONL ledgers remain written after a successful transactional commit for backwards-compatible health/economics telemetry. They are no longer authoritative for duplicate-use protection when Kappa.5 is enabled.

## Failure semantics

### Provider fails before settlement

The payment becomes `failed`; no customer settlement is attempted.

### Facilitator returns an explicit unsuccessful settlement

The payment becomes `failed` from `settling`.

### Facilitator settlement request throws/times out

The payment remains `settling` because the external settlement outcome is ambiguous. MISSING returns:

```text
503 payment_settlement_reconciliation_required
```

A retry of the same authorization is blocked before facilitator verification and before provider execution.

### Settlement succeeds but HTTP response is lost

With `MISSING_TRANSACTIONAL_RESPONSE_CACHE_ENABLED=1`, the committed response is returned on retry directly from the transactional store. There is no second facilitator call and no second provider execution.

## Explicit boundary

SQLite/WAL is a transactional improvement for the current single Railway service instance. It is **not** the distributed money backend for multiple Railway replicas/hosts.

Mainnet with horizontal replicas remains blocked until the same state-machine contract is backed by PostgreSQL (or equivalent) with database-enforced uniqueness and compare-and-set/transaction semantics shared by every replica, plus reconciliation for rows left in `settling`.

Kappa.5 therefore establishes the transactional contract and crash semantics. A distributed backend is the next infrastructure step before multi-replica real-money operation.
