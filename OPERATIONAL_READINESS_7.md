# Operational Readiness 7 — Dependency Backpressure & Retry-Storm Containment

Base release: `59d8680f5874a73822f041be27c9ba207683a328` (OR6 merge commit).

## Goal

Contain retry storms against the x402 facilitator so a transient dependency outage does not amplify into unbounded external calls or resource pressure inside MISSING.

## Production behavior

`src/runtime/dependencyBackpressure.ts` provides a process-local concurrency guard and circuit breaker for external dependencies. `verify` and `settle` calls in the production x402 path pass through this guard.

Default facilitator limits are intentionally conservative and configurable:

- `MISSING_FACILITATOR_MAX_IN_FLIGHT` (default `32`)
- `MISSING_FACILITATOR_CIRCUIT_FAILURE_THRESHOLD` (default `5`)
- `MISSING_FACILITATOR_CIRCUIT_COOLDOWN_MS` (default `1000`)
- `MISSING_DEPENDENCY_BACKPRESSURE_ENABLED=0` disables the guard for compatibility/testing; otherwise it is enabled.

Saturation is rejected immediately rather than queued without bound. Repeated dependency failures open the circuit. After the cooldown, the circuit allows traffic again and a successful call resets the failure state.

## Formal proof

`src/operationalReadiness7.ts` deliberately reduces the facilitator concurrency limit to four and injects a sustained HTTP 503 outage.

The proof requires:

1. A 60-request verification storm results in at most four real facilitator calls.
2. Once the failure threshold opens the circuit, an additional 20 requests generate zero new facilitator calls.
3. After the cooldown and dependency recovery, verification succeeds and the circuit closes.
4. A 50-request settlement storm also results in at most four real facilitator calls while preserving the stable settlement-intent contract on calls that reach the dependency.

Formal GO result:

`GO_OPERATIONAL_DEPENDENCY_BACKPRESSURE_RETRY_STORM_CONTAINMENT`

## Scope

This milestone proves single-process facilitator backpressure and retry-storm containment. It does not yet claim a distributed/global circuit breaker across replicas, RPC-side backpressure, regional load shedding, adaptive rate limiting, or external load-balancer behavior. Those remain separate operational concerns.
