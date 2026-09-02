# Operational Readiness 9 — Dependency Deadlines & Hung-Call Containment

Base release: `628261e6291c717a15a98dc7f9642beb73818970` (merged OR8).

## Risk

OR7 and OR8 bound concurrency and retry storms, but a dependency that accepts a connection and never responds can occupy every allowed slot forever. Without a deadline, no failure is recorded, the circuit breaker never opens, and a small number of hung facilitator or RPC calls can permanently consume local capacity.

## Production change

The shared dependency guard now applies aborting deadlines to the production x402 external calls.

- Facilitator verify and settle requests receive `AbortSignal` from the guard.
- JSON-RPC requests receive the same abortable deadline treatment.
- Deadline expiry raises a deterministic `DependencyTimeoutError` and calls `AbortController.abort()` so the underlying `fetch` is cancelled rather than merely abandoned by the caller.
- Timeouts count as dependency failures and therefore participate in the existing circuit breaker.
- Timed-out operations release their in-flight slot in the guard.
- `dependencyBackpressureSnapshot()` now exposes `timedOut`, `timeout_ms`, and whether dependency deadlines are enabled.

Configuration:

- `MISSING_DEPENDENCY_DEADLINES_ENABLED=0` explicitly disables the deadlines. They are enabled by default.
- `MISSING_FACILITATOR_TIMEOUT_MS` defaults to `10000`.
- `MISSING_RPC_TIMEOUT_MS` defaults to `10000`.

## Formal drill

The OR9 proof deliberately injects fetch implementations that never resolve until their supplied `AbortSignal` is aborted. For the gate, max in-flight is 3, the timeout is 50 ms, breaker threshold is 2, and cooldown is 500 ms.

The gate requires all of the following:

1. 30 concurrent hung facilitator verification requests create only 3 external calls; all 3 receive abort, all slots return to zero, the breaker opens, additional probes create no new external calls, and verification succeeds again after cooldown.
2. The same containment and recovery properties hold for hung facilitator settlement calls carrying stable settlement-intent IDs.
3. 30 concurrent exact-settlement proofs against a hung RPC create only 3 external calls, all are aborted and capacity is released, the open circuit suppresses more RPC work, and after cooldown a complete five-call exact-settlement proof returns `verified`.
4. The existing full test suite and TypeScript build remain green.

Formal GO result: `GO_OPERATIONAL_DEPENDENCY_DEADLINES_HUNG_CALL_CONTAINMENT`.

## Scope

This milestone proves deadline and abort propagation for the x402 facilitator and JSON-RPC dependencies in a single process with deterministic fault injection. It does not yet claim provider-execution deadlines, PostgreSQL statement/query timeouts, distributed/global breaker coordination, multi-RPC failover, regional load shedding, or real-network timeout behavior across every proxy/load-balancer layer.
