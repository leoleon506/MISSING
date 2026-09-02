# Product Kappa.5.10 — Lease Fencing & Stale-Owner Exclusion

Kappa.5.10 hardens distributed x402 recovery against a process that stays alive after losing ownership of a payment.

## Problem

Kappa.5.9 proved end-to-end crash recovery, but a distributed lease still has a classic stale-owner risk: process A can pause long enough for its lease to expire, process B can take over, and process A can later wake up and attempt a write with stale local state.

## Production invariant

Every active distributed payment has:

- a unique `lease_token`;
- a monotonic `lease_fence` generation;
- a durable `lease_expires_at`.

Reservation starts at fence `1`. Every successful expired-lease takeover increments the fence atomically in PostgreSQL.

Active mutations always require the current lease token and a non-expired lease. Callers that opt into generation fencing additionally require the exact current `lease_fence`. This preserves compatibility with Kappa.5.8/5.9 while allowing recovery orchestration and adversarial proofs to carry a strict monotonic generation.

## Protected mutations

The lease guard is applied to:

- `reserved -> executing`;
- `executing -> provider_done`;
- `reserved/provider_done -> settling`;
- settlement transaction persistence;
- `-> ambiguous`;
- `-> failed`;
- `settling -> settled`.

A stale owner receives `changed: false`; it cannot overwrite authoritative payment state.

## Adversarial proof

`src/experimentKappa510.ts` uses PostgreSQL 16 and a 100 ms lease to prove:

1. a rotated-out lease token cannot commit provider completion;
2. the same token string reused after expiry cannot write with its old generation (ABA defense);
3. an expired owner cannot write even before another replica takes over;
4. stale settlement owners cannot persist a transaction or commit `settled` after a newer fence exists.

The experiment requires all four scenarios to pass and emits:

`GO_LEASE_FENCING_STALE_OWNER_EXCLUSION`

## Boundaries

Kappa.5.10 fences authoritative database transitions. It cannot undo an external provider-side effect that happens after a lease expires but before the process notices; provider idempotency/quarantine from Kappa.5.8/5.9 remains the defense for external writes. A future hardening step may propagate the monotonic fence through every production recovery call and add lease renewal/heartbeat during legitimately long provider or settlement operations.
