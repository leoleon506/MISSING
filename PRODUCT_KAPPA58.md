# Product Kappa.5.8 — Ambiguous Outcome Recovery

Kappa.5.7 proved crash safety by refusing blind retries. Kappa.5.8 adds a durable recovery contract so safe cases can make progress while unsafe cases are quarantined explicitly.

## Durable states

Distributed x402 payments now support:

`reserved -> executing -> provider_done -> settling -> settled`

and fail-closed terminal quarantine:

`executing/provider_done/settling -> ambiguous`

Existing `failed` remains a known-negative terminal state.

## Recovery lease

Every in-progress record carries a short lease. A restarted replica may claim recovery only after the prior lease expires and only when the canonical request hash still matches. This prevents two restart workers from independently taking ownership of one ambiguous payment.

## Provider recovery policy

A provider attempt is recoverable only when its contract proves one of these properties:

1. **read_only** — GET can be replayed because it does not create a provider-side write;
2. **idempotent** — POST has replay-verified idempotency evidence and a stable provider idempotency key can be reused;
3. **ambiguous** — POST has neither property and therefore must never be replayed automatically after an uncertain crash.

The stable provider key is derived from payment identity plus recipe fingerprint. It is not generated afresh after restart.

## Settlement recovery

Before contacting the x402 facilitator, MISSING can persist a stable `settlement_intent_id`. `settleX402Payment` sends that identity as both `Idempotency-Key` and `X-MISSING-Settlement-Intent`, and also includes it in the x402 extensions payload.

A restart can therefore submit the same settlement intent again and recover the same transaction rather than creating a second transfer, provided the facilitator honors the idempotency contract.

## Experiment

The dedicated PostgreSQL 16 experiment proves three cases:

- a non-idempotent POST whose external outcome is unknown is moved to `ambiguous` with zero automatic retries;
- an idempotent POST is called twice with the same stable key but produces one external write effect;
- a settlement call crashes after the facilitator creates a transaction but before local persistence, then recovery reuses the durable intent and obtains the same transaction while the facilitator records one settlement effect.

## GO gate

Kappa.5.8 emits `GO_AMBIGUOUS_OUTCOME_RECOVERY` only if all scenarios pass and the full repository test/build gates remain green.

This milestone does not claim that every third-party provider supports recovery. Providers without a replay-safe contract are intentionally quarantined rather than guessed about.
