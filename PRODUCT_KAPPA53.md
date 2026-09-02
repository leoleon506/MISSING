# Product Kappa.5.3 — Two-Replica Payment Exclusion Proof

Kappa.5.3 is an evidence milestone for the shared PostgreSQL x402 reservation introduced in Kappa.5.1 and request binding introduced in Kappa.5.2.

## Invariant under test

For one fresh payment hash and one canonical request, two independent MISSING processes racing against the same PostgreSQL database must produce exactly one reservation winner and exactly one provider-execution probe event.

Process-local `inFlightPayments` state is deliberately irrelevant: each replica is a separate operating-system process with independent memory.

## Harness

`src/experimentKappa53.ts` runs at least 20 independent races. Each race launches two Node processes executing `src/experimentKappa53Worker.ts` concurrently. Both processes receive:

- the same fresh payment hash;
- the same capability;
- the same canonical input;
- the same PostgreSQL database;
- distributed money enabled;
- transactional response caching disabled.

Each worker independently computes the Kappa.5.2 canonical request hash and calls the production `reserveDistributedPayment()` implementation.

The reservation SQL remains the production invariant:

`INSERT ... ON CONFLICT (payment_hash) DO NOTHING RETURNING *`

Only a worker that receives `reserved=true` emits a provider-execution probe event. The shared append-only probe file is written by separate processes and counted by the parent experiment process, so two process-local counters cannot manufacture a successful exclusion result.

## CI environment

`.github/workflows/kappa53.yml` starts PostgreSQL 16 as a GitHub Actions service, installs the PostgreSQL client, runs the complete repository test suite and TypeScript build, then runs the 20-race experiment.

The response cache is forced off with:

`MISSING_TRANSACTIONAL_RESPONSE_CACHE_ENABLED=0`

The workflow uploads `artifacts/product-kappa53-two-replica-exclusion.json` as evidence.

## Evidence per race

The JSON artifact records:

- race ID;
- both replica PIDs and outcomes;
- winning replica;
- singular authoritative payment-row observation;
- stored request-hash match;
- global provider-execution probe count;
- duplicate-execution boolean;
- changed-request binding control.

Payment signatures, database credentials, raw request hashes and raw customer secrets are not written to the artifact. Only short hash prefixes are emitted by workers for correlation.

## Controls

### Changed request

After each race the authoritative stored request hash is compared with a materially changed canonical request using the production `requestBindingStatus()` function. The expected status is `mismatch`, corresponding to the Kappa.5.2 HTTP path `409 payment_request_mismatch` before provider execution.

### Legacy unbound

The harness evaluates a deliberately null stored request hash through the production binding classifier. Expected status: `legacy_unbound`, corresponding to `409 payment_request_binding_unavailable` in the paid HTTP path.

The HTTP-level status mapping itself remains covered by the Kappa.5.2 product tests; Kappa.5.3 does not duplicate payment-facilitator mocks merely to restate that mapping.

## GO gate

The experiment returns `GO_TWO_REPLICA_PAYMENT_EXCLUSION` only when all required races satisfy all of the following:

- exactly one reservation winner;
- exactly one global provider-execution probe event;
- one authoritative payment row;
- stored request hash equals the canonical Kappa.5.2 request hash;
- changed-request control reports `mismatch`;
- legacy control reports `legacy_unbound`;
- zero duplicate provider executions across all races.

Any duplicate provider-execution probe is an automatic NO-GO and makes the workflow fail.

## Boundaries

Kappa.5.3 does not:

- enable response caching;
- change x402 pricing or settlement economics;
- change AgentRank/provider ranking;
- change scientific evidence;
- replace PostgreSQL;
- replace the synchronous `psql` backend;
- add blockchain transfer-log validation;
- introduce a queue or external distributed lock.

## Limitation

The experiment targets the cross-process exclusion boundary directly at the authoritative production reservation function rather than paying a live third-party facilitator/provider. This intentionally isolates the property under test and avoids external paid dependencies. Kappa.5.2 already covers HTTP request-binding behavior; a later settlement milestone should validate on-chain transfer semantics independently.
