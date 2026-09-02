# Product Lambda.3 — Dedicated Safe POST Replay Verifier

Lambda.3 closes the verified-supply loop for side-effect-contained POST capabilities without turning general mutation endpoints into autonomous probes.

## Trusted gate

Live POST replay is disabled by default and requires:

`MISSING_SAFE_POST_REPLAY_ENABLED=1`

The gate is intended only for the trusted acquisition/control-plane runtime. Public discovery and normal Product Theta GET acquisition remain unchanged.

## Admission contract

Lambda.3 accepts only compiler candidates already classified as:

`candidate_ready_for_safe_post_replay`

Before any provider network call, the verifier independently checks:

- method is POST;
- at least two evidence-backed replay inputs exist;
- required output projection is present;
- provider/evidence URLs pass the existing supply URL policy;
- Lambda.2 reported `safe_for_replay`;
- at least one safety signal is enforceable at execution time.

For live replay, enforceable containment means either:

- the actual candidate base URL is explicitly a sandbox/test environment, or
- a documented dry-run/test-mode input is bound into the request and forced to its safe value.

A provider declaration by itself is not sufficient for a live POST probe. Idempotency by itself is also not sufficient.

## Replay and promotion

The verifier executes exactly the first two approved replay inputs through the common HTTP recipe executor. Both must return successful required-output projections.

Only then can the recipe be registered and durably persisted as `product_live` verified supply.

The promoted verification record preserves the Lambda.2 safety evidence separately from historical experiment evidence.

## Safety survives promotion

A verified safety control is not merely a test-time value. Lambda.3 persists it as `forced_inputs` on the recipe.

For example, if verification proved:

`dry_run=true`

then a later caller supplying `dry_run=false` cannot disable the containment contract. Runtime binding uses the forced verified value.

This means Lambda.3 promotes the safe-mode capability that was actually proven. It does not silently upgrade that proof into permission to perform the provider's unrestricted real-world mutation.

## Generated idempotency headers

If the provider contract uses `Idempotency-Key` or `X-Idempotency-Key`, Lambda.3 persists only a declarative per-request generator:

`uuid_v4`

A fresh UUID is generated for every replay and every future execution. Generated values are not stored in the recipe, supply ledger, or runtime attempt telemetry.

## Durable execution contract

The supply ledger persists:

- POST body bindings;
- generated header declarations;
- forced safe-mode inputs;
- replay verification evidence.

After restart and ledger rehydration, the same containment and idempotency behavior remains active.

## Deliberate boundary

Lambda.3 does not authorize arbitrary production mutations, purchases, messages, writes, deletes, or commits. A future action-activation layer would need a distinct authorization/transaction contract proving when the safe-mode capability may graduate to a real side-effecting action.
