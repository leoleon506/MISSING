# Operational Readiness 8 — RPC Backpressure & Proof-Storm Containment

Base release: `00284c6579ece5c047c3ebd7a7eb818cd1fd5709` (merged OR7).

## Risk

A single exact-settlement proof is multi-stage: chain ID, receipt, latest block, canonical block, and a second receipt stability check. During an RPC outage, concurrent retries and the settled-reorg monitor could amplify one logical proof into many JSON-RPC calls unless the dependency is bounded.

## Production change

The shared dependency backpressure guard introduced by OR7 is now applied to every x402 JSON-RPC request. RPC calls therefore inherit:

- a process-local maximum in-flight limit (`MISSING_RPC_MAX_IN_FLIGHT`);
- immediate saturation rejection rather than unbounded waiting;
- a consecutive-failure circuit breaker (`MISSING_RPC_CIRCUIT_FAILURE_THRESHOLD`);
- cooldown-based recovery (`MISSING_RPC_CIRCUIT_COOLDOWN_MS`);
- machine-readable state through `dependencyBackpressureSnapshot()`.

HTTP failures, JSON-RPC errors, and transport exceptions count as dependency failures. Valid RPC results such as a missing transaction receipt remain semantic results and do not trip the breaker.

## Formal drill

The OR8 proof sets RPC max concurrency to 4 and deliberately fails `eth_getTransactionReceipt` after successful `eth_chainId` calls. This exercises a partially progressed multi-stage proof rather than only a first-call outage.

The gate requires:

1. 60 concurrent settlement proofs produce at most 4 chain-ID calls and at most 4 failing receipt calls, with all other proofs rejected by backpressure before additional RPC work.
2. Once the circuit is open, 20 additional proofs generate zero new external RPC calls.
3. After the cooldown, one complete exact-settlement proof succeeds and performs the expected five RPC calls.
4. The full existing test suite and TypeScript build remain green.

Formal GO result: `GO_OPERATIONAL_RPC_BACKPRESSURE_PROOF_STORM_CONTAINMENT`.

## Scope

This milestone proves single-process RPC backpressure and circuit-breaker behavior with deterministic fault injection. It does not claim distributed/global circuit coordination, provider-specific rate-limit adaptation, multi-RPC failover, regional load shedding, or production network latency behavior.
