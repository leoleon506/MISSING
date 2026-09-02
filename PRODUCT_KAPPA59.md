# Product Kappa.5.9 — Production Recovery Orchestrator

Kappa.5.8 proved the durable recovery primitives. Kappa.5.9 wires them into the real `handleAgentPaidResolution()` production path and proves crash recovery end-to-end.

## Production state machine

Distributed paid execution now follows the durable sequence:

`reserved -> executing -> provider_done -> settling -> settled`

with fail-closed quarantine:

`executing|settling -> ambiguous`

The production path persists an execution intent before calling the provider. The record includes the exact recipe fingerprint, provider recovery mode, provider idempotency key when applicable, and an expiring lease token.

## Provider recovery policy

- `GET` recipes are `read_only` and may be replayed after lease takeover.
- Verified idempotent `POST` recipes are pinned to the exact recipe and replayed with the same durable provider idempotency key.
- `POST` recipes without a verified idempotency/reconciliation contract are never retried after an uncertain external outcome. They are moved to `ambiguous`.
- Paid POST execution does not fail over to another write provider after an attempt starts.

## Settlement recovery

After provider completion, the production path creates a deterministic `settlement_intent_id` and persists it before calling the x402 facilitator. The same identity is sent as `Idempotency-Key` and `X-MISSING-Settlement-Intent`.

When the facilitator returns a transaction, the transaction is persisted immediately before on-chain verification. If the process dies after the facilitator created the transaction but before local persistence, a restarted request can acquire the expired recovery lease and resubmit the same settlement intent. An idempotent facilitator must return the same transaction instead of creating a second settlement.

Kappa.5.4 exact ERC-20 proof and Kappa.5.5 confirmation/reorg proof remain mandatory before the final `settled` commit.

## Production crash proof

`src/experimentKappa59.ts` starts real local HTTP provider, facilitator, and JSON-RPC services plus PostgreSQL 16. It launches separate Node workers that call the actual `handleAgentPaidResolution()` function and deliberately terminate the process at exact production crash points.

The gate proves four scenarios:

1. **Crash after reservation** — restart takes over after lease expiry, provider executes once, payment settles.
2. **Crash after idempotent POST effect** — restart pins the same recipe and reuses the exact provider idempotency key; two calls produce one external effect.
3. **Crash after non-idempotent POST effect** — restart performs zero provider retries and moves the payment to `ambiguous`.
4. **Crash after external settlement effect** — restart reuses the durable settlement intent; two facilitator calls produce one settlement effect and one transaction.

## Regression invariants

Kappa.5.9 must preserve all previously proven properties:

- Kappa.5.2 request binding;
- Kappa.5.3 two-replica payment exclusion;
- Kappa.5.4 exact ERC-20 settlement proof;
- Kappa.5.5 confirmation-depth and reorg resistance;
- Kappa.5.6 native PostgreSQL pooling and atomic reservation;
- Kappa.5.7 crash safety;
- Kappa.5.8 ambiguous-outcome recovery primitives.

SQLite semantics remain unchanged. Distributed response cache remains disabled by default and migration-gated.

## GO decision

Kappa.5.9 is GO only when the dedicated production crash proof, its focused unit tests, the full test suite, and TypeScript build all pass.

Formal decision string:

`GO_PRODUCTION_END_TO_END_RECOVERY`
