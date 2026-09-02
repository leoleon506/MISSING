# Product Lambda.2 — Safe POST Verification Policy

Lambda.2 introduces a conservative compile-time policy for deciding whether a discovered POST operation is safe enough to enter a dedicated replay-verification stage.

It does **not** execute POST requests and does not weaken Product Theta's GET-only automatic acquisition path.

## New compiler state

A POST candidate can now reach:

`candidate_ready_for_safe_post_replay`

This means the operation has:

1. deterministic OpenAPI compilation,
2. two evidence-backed replay inputs, and
3. explicit side-effect containment evidence.

It still does not enter standard `verifySupplyCandidate()` or automatic promotion.

## Sufficient safety evidence

Lambda.2 currently accepts these explicit signals:

- a static HTTPS provider URL with a clear `sandbox`, `test`, or `testing` environment marker,
- a documented boolean dry-run/simulation/preview/validate-only control that MISSING can force to `true`,
- a documented boolean test/sandbox mode that MISSING can force to `true`,
- an explicit OpenAPI provider declaration such as `x-missing-safe-verification`, `x-sandbox`, `x-test-mode`, `x-dry-run`, `x-dry-run-supported`, or `x-safe-to-test`.

For input-controlled safety modes, MISSING injects the safe value into every candidate replay input and materializes the corresponding query/body binding.

## Idempotency is not enough

A required `Idempotency-Key` is recognized as useful risk-reduction evidence and is no longer misclassified as a provider credential. However, idempotency alone does not make a real mutation safe to probe because the first request can still create or modify real state.

Therefore an idempotency key by itself remains `needs_safe_verification`.

## Fail-closed behavior

A normal production POST without an explicit sandbox/dry-run/test-mode guarantee remains:

`needs_safe_verification`

The Theta orchestrator never invokes standard acquisition for either `needs_safe_verification` or `candidate_ready_for_safe_post_replay`.

## Next boundary

The next milestone can implement a dedicated safe POST replay verifier that:

- accepts only candidates that already passed Lambda.2 policy,
- generates required idempotency keys when applicable,
- executes only the forced sandbox/dry-run/test-mode request shape,
- performs two replays,
- promotes only if both projected outputs succeed,
- records the exact safety evidence in the promoted recipe.
