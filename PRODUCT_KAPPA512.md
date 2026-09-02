# Product Kappa.5.12 — Verified Idempotency Contracts

## Goal

Prevent automatic replay of external writes unless MISSING has explicit evidence that the downstream system deduplicates the repeated operation.

## Provider rule

A POST recipe is replayable only when its `product_live` verification contains a sufficient `safe_post` signal of kind `idempotency_key` with an explicit header location/name.

A generated header whose name merely resembles an idempotency key is not evidence and is classified `ambiguous`.

## Facilitator rule

A durable settlement intent may be submitted only when `MISSING_X402_FACILITATOR_IDEMPOTENCY=1` explicitly asserts that the configured facilitator deduplicates repeated settlement submissions by the same intent.

If a settlement intent exists while that contract is disabled, `settleX402Payment()` fails before any HTTP request is made.

When enabled, the durable intent is sent as both `Idempotency-Key` and `X-MISSING-Settlement-Intent`, and in the x402 extensions payload.

## Proof

`src/experimentKappa512.ts` proves:

1. an idempotency-shaped generated provider header does not authorize replay;
2. sufficient verified `safe_post` evidence does authorize replay;
3. a facilitator with no explicit idempotency contract receives zero settlement HTTP calls;
4. with the explicit contract enabled, repeated submissions use the exact same durable intent and produce one simulated external settlement effect.

Existing Kappa.5.8, Kappa.5.9 and Kappa.5.11 proofs explicitly declare facilitator idempotency because their deterministic test facilitators really deduplicate by the stable intent.

## Formal decision

`GO_VERIFIED_IDEMPOTENCY_CONTRACTS`
