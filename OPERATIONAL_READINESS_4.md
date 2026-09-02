# Operational Readiness 4 — Failure Injection & Recovery Envelope

OR4 exercises the durable payment/recovery machinery under combined operational faults rather than isolated unit conditions.

## Base

This milestone starts from the exact OR3 merge commit:

`b1037a6850a43bf173c6cd0de4dd9a52ef918a9f`

## Faults exercised

1. A real worker process is killed with `SIGKILL` immediately after durable reservation.
2. A worker is killed after an idempotent provider effect has happened but before provider completion is persisted.
3. A worker is killed after a non-idempotent/ambiguous provider effect has happened but before completion is persisted.
4. A live PostgreSQL backend used by the application is terminated with `pg_terminate_backend` and fresh work must continue through pool reconnection.

For crash scenarios, two recovery claimants race concurrently after lease expiry. Exactly one may acquire the next lease fence.

## External-effect rules

- Idempotent provider replay uses the same durable idempotency key. Two HTTP calls must still produce one external effect.
- Ambiguous/non-idempotent work is not replayed. The recovered row is explicitly quarantined as `ambiguous`.
- The PostgreSQL failure scenario must complete new durable work without restarting the application process that owns the main pool.

## Formal GO

`GO_OPERATIONAL_FAILURE_INJECTION_RECOVERY_ENVELOPE`

The gate requires every failure scenario to pass, no duplicate payment hashes, and only the two deliberately retained recovered active rows (`reserved` and `provider_done`) to remain active at the end of the drill.

## Scope

This is an operational failure-injection envelope for the current PostgreSQL-backed payment core. It is not a substitute for regional database failover, network partition testing, external facilitator outages, or a production incident runbook. Those remain separate operational concerns.
