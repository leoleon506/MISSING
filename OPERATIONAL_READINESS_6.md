# Operational Readiness 6 — External Dependency Outage & Recovery Envelope

Base release: `5b686a2ee116542ed58d3670980357a26d36395d` (Operational Readiness 5 merge).

## Goal

Prove that transient outages in dependencies used by the paid x402 path do not create duplicate provider effects, duplicate settlement submissions, or permanently owned durable payments.

## Failure envelope

The formal drill covers three distinct outage windows:

1. facilitator verification unavailable before durable reservation;
2. facilitator settlement unavailable after the provider effect and durable settlement intent;
3. RPC unavailable after a settlement transaction is known but before exact on-chain proof completes.

The desired recovery contract is:

- pre-verification outage performs zero provider work and creates no durable payment row;
- recoverable post-reservation failures relinquish ownership instead of leaking a renewing lease;
- provider effects are not repeated after settlement dependency recovery;
- settlement retries reuse the same durable settlement intent;
- a known transaction is reconciled through RPC without re-submitting settlement;
- recovery occurs without restarting the process.

## Formal decision

GO target:

```text
GO_OPERATIONAL_EXTERNAL_DEPENDENCY_OUTAGE_RECOVERY
```

NO-GO target:

```text
NO_GO_OPERATIONAL_EXTERNAL_DEPENDENCY_OUTAGE_RECOVERY
```

The experiment intentionally waits longer than the configured recovery lease before retrying. If a recoverable response leaves the heartbeat renewing the old lease, the retry remains fenced out and the milestone is NO-GO. This makes lease leakage during dependency failure directly observable.

## Scope boundary

This milestone is a single-process, real-PostgreSQL outage/recovery envelope with deterministic facilitator, provider, and RPC fault injection. It does not claim regional network-partition tolerance, provider-side availability guarantees, multi-region database failover, or external load-balancer behavior.
