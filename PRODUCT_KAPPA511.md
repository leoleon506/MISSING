# Product Kappa.5.11 — Production Fence Propagation & Lease Heartbeat

Kappa.5.11 upgrades the distributed payment path from token-only production ownership to an exact `{lease_token, lease_fence}` process session with heartbeat renewal.

## Production invariant

A process that wins a reservation or expired-lease takeover registers the exact monotonic fence generation returned by PostgreSQL. Production mutations that omit an explicit fence no longer fall back to token-only writes: they resolve the exact fence from the process-local ownership session and PostgreSQL verifies token, fence, and non-expired lease together.

Long provider and settlement operations start a heartbeat that renews only if the same token and fence are still authoritative. The heartbeat never increments the fence. If renewal fails, the local session is marked lost and later state transitions fail closed.

Kappa.5.10 calls that pass an explicit `leaseFence` remain adversarial/manual mode and do not receive automatic heartbeat renewal, preserving its expiry and stale-owner tests.

## End-to-end proof

`src/experimentKappa511.ts` uses the real `handleAgentPaidResolution()` path with PostgreSQL 16, a 100 ms lease and a 25 ms heartbeat. It requires all of these scenarios to pass:

1. a provider response delayed ~350 ms still settles under fence 1;
2. a facilitator settlement delayed ~350 ms still settles under fence 1;
3. a second replica attempting takeover while the slow provider is active cannot claim ownership;
4. if the owner process dies after the provider effect, its heartbeat disappears and a later takeover succeeds with fence 2.

Formal GO decision:

`GO_PRODUCTION_FENCE_HEARTBEAT`

## Compatibility boundary

The historical Kappa.5.7 proof contains a primitive reconciler written before lease fencing. Its workflow alone enables `MISSING_DISTRIBUTED_LEGACY_UNFENCED_MUTATIONS=1` so that the old proof remains reproducible. Production does not enable that switch.

Kappa.5.11 protects authoritative database transitions and prevents premature ownership theft during legitimate long operations. It still cannot cancel an external network side effect already accepted by a provider after a process loses CPU scheduling; provider idempotency/quarantine and settlement idempotency from Kappa.5.8/5.9 remain required defenses.
