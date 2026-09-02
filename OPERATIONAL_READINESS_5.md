# Operational Readiness 5 — Fail-Closed Production Admission & Readiness

Base release: `fa388df6417bc5ab4fadf7a5b21f963a64af08ba` (Operational Readiness 4 merge).

## Goal

Prevent a paid MISSING instance from accepting x402 traffic while a prerequisite required for safe durable execution is missing or unhealthy.

The gate is explicitly enabled with:

```text
MISSING_PRODUCTION_ADMISSION_ENABLED=1
```

When the flag is absent, historical local/test behavior is preserved. When it is enabled, `x402Ready()` becomes a fail-closed production admission decision and `/readyz` exposes the same machine-readable admission state.

## Required production checks

Admission requires all of the following before paid traffic can proceed:

- complete static x402 configuration;
- explicit facilitator settlement-idempotency contract;
- distributed PostgreSQL money backend enabled and ready;
- transactional response cache disabled;
- valid finality policy for the configured chain;
- configured x402 RPC endpoint;
- post-settlement deep-reorg monitor enabled, running, and without a recorded monitor error.

A rejected admission happens before payment verification, provider execution, or settlement submission.

## Formal proof

`src/operationalReadiness5.ts` exercises healthy admission plus missing/malformed finality policy, missing facilitator idempotency, missing RPC, unsafe response cache, disabled/stopped post-settlement monitor, unavailable distributed backend, and a paid request rejected before any facilitator call. It also proves `/readyz` carries the machine-readable admission reasons.

Formal GO target:

```text
GO_OPERATIONAL_FAIL_CLOSED_ADMISSION_READINESS
```

## Scope boundary

This milestone proves local process admission/readiness behavior for the durable paid x402 path. It does not prove regional database failover, external load-balancer propagation timing, Kubernetes/Railway-specific probe configuration, facilitator availability, RPC availability under sustained outage, or a full incident-response procedure.
