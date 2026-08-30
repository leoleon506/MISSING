# Experiment 5B15 — Deterministic Replay Resilience

## Status
Preregistered before implementation.

## Frozen base
- Repository base SHA: `b2a3289c6929233eb2ac56f706ad8b8eb6413100`
- Consumed development experiment: 5B14
- Consumed 5B14 workflow run: `33283645154`
- Consumed 5B14 formal decision: `REASSESS_5B14_SYMMETRIC_REQUEST_LOCAL_OPERATION_COMPATIBILITY`
- Consumed 5B14 report fingerprint: `ba1ed1e8aa6152568734096a39396bc43d46de1d0290d1b40ec901d5dba27e43`
- Consumed 5B14 strict successes: 7
- Consumed 5B14 success families: 6
- Consumed 5B14 distinct providers: 7
- Consumed 5B14 persisted recipes: 7
- Consumed 5B14 changed-input replay: 6/7 = 85.7142857%
- Consumed 5B14 documentary strict recipes: 1
- Consumed 5B14 documentary changed-input replay successes: 1
- Consumed 5B14 documentary new-family recipes: 1
- Consumed 5B14 documentary end-to-end lineage complete: true

## Consumed evidence motivating 5B15
The valid repaired 5B14 rerun passed every frozen GO gate except the overall changed-input replay-rate gate. Six of seven persisted recipes replayed successfully. The sole failed replay was `english_word_definition_metadata`; the replay terminated before semantic verification with `SyntaxError: Unexpected end of JSON input`.

The 5B14 documentary result itself remained successful: the documentary TVMaze recipe replayed on changed input and preserved the new `media` family with complete lineage. Therefore the unresolved development question is not discovery, ranking, binding, documentary extraction, or semantic verification. It is whether a persisted recipe can tolerate a bounded transient transport/representation failure while keeping the exact request and verification semantics frozen.

No holdout evidence is consumed.

## Primary hypothesis
If persisted changed-input replays are allowed a small deterministic retry budget only after generic pre-semantic transport or representation failures, while every retry uses the exact same rendered request and the existing semantic verification remains unchanged, then transient provider-response failures can be recovered without rediscovery, request mutation, provider-specific logic, or relaxed correctness.

## Experimental unit
5B15 operates only on the frozen set of seven persisted strict recipes produced by 5B14 and their already-defined changed-input replay workload. It does not run catalog discovery, documentation acquisition, synthesis, ranking, schema probing for discovery, recovery discovery, or recipe generation.

The frozen replay workload will be materialized from the consumed 5B14 artifact after this preregistration and will include recipe fingerprints plus the existing changed-input replay inputs/request geometry. Workload data may contain provider URLs and case identifiers because they are frozen experimental inputs; runtime treatment code may not branch on them.

## Treatment — deterministic replay retry policy
For each frozen persisted recipe:

1. Render the changed-input request exactly as the existing replay logic does.
2. Execute attempt 1 and record its complete outcome before any retry decision.
3. A retry is allowed only when attempt 1 (or the immediately preceding attempt) fails in one of these preregistered generic pre-semantic classes:
   - network/transport exception before a complete response is available;
   - HTTP status `408`, `425`, `429`, `500`, `502`, `503`, or `504`;
   - a 2xx response reaches structured-response decoding but decoding/parsing fails before semantic verification (including empty, incomplete, or malformed structured body).
4. Semantic-verification failures, successful structured responses that fail the existing task/output verification, authentication/safety failures, deterministic request-rendering failures, and all other failure classes are non-retryable.
5. Maximum attempts per recipe: **3 total** (attempt 1 + at most 2 retries).
6. Delay between eligible retries: fixed **250 ms**; no jitter and no exponential backoff.
7. Every retry must use byte-for-byte equivalent request semantics: same method, origin, path, query, headers permitted by the frozen recipe, and body. The deterministic request fingerprint must be identical across all attempts for a recipe.
8. Changed input is immutable across attempts.
9. No retry may invoke discovery, documentation, catalog, reranker, synthesis, recovery discovery, or modify the persisted recipe.
10. A recipe is a final replay success only if one attempt satisfies the **unchanged existing replay semantic-verification criteria**. Retry never converts an unverifiable structured response into success.

## Frozen budgets
- frozen recipes: exactly 7;
- changed-input workloads: exactly the seven consumed 5B14 replay workloads;
- maximum attempts per recipe: 3;
- maximum total HTTP attempts: 21;
- retry delay: 250 ms fixed;
- LLM/reranker calls: 0;
- catalog discovery calls: 0;
- documentation acquisition calls: 0;
- synthesis calls: 0;
- recovery-discovery calls: 0;
- recipe-generation calls: 0;
- stochastic decisions: 0;
- holdout access: 0.

## Required instrumentation
The 5B15 report must expose at least:
- frozen recipe count;
- frozen recipe fingerprint-set fingerprint;
- frozen changed-input workload fingerprint;
- attempt-1 replay successes;
- attempt-1 replay failures;
- retry-eligible failures;
- non-retryable failures;
- recipes retried;
- retry attempts beyond attempt 1;
- retry recoveries;
- final replay successes;
- final replay rate;
- maximum attempts used by any recipe;
- total HTTP attempts;
- request-fingerprint comparisons across retries;
- request-fingerprint mismatch violations;
- changed-input mutation violations;
- non-retryable-retried violations;
- retry-budget violations;
- per-attempt outcome class;
- semantic-verification logic fingerprint / frozen verifier identity;
- replay discovery/cognitive deltas;
- auth-like rendered requests;
- wrong-task probe attempts;
- documentary recipe final replay success count;
- documentary recipe lineage-preservation check from the frozen recipe metadata.

## GO criteria
All must be true:
1. integrity/preregistration checks pass;
2. exactly 7 frozen persisted 5B14 recipes are evaluated;
3. frozen recipe fingerprint set matches the post-prereg frozen workload exactly;
4. frozen changed-input workload matches exactly;
5. attempt 1 is executed and recorded for every recipe before any retry decision;
6. retries occur only after a preregistered retry-eligible failure class;
7. non-retryable-retried violations = 0;
8. maximum attempts per recipe <= 3;
9. total HTTP attempts <= 21;
10. request-fingerprint mismatch violations = 0;
11. changed-input mutation violations = 0;
12. no persisted recipe is modified;
13. semantic verification is unchanged from the frozen replay verifier;
14. final replay success rate >= 95%; because the frozen workload has seven recipes, this requires **7/7** final replay successes;
15. the frozen documentary recipe remains a successful changed-input replay;
16. documentary lineage metadata remains preserved and unchanged;
17. replay catalog/reranker/documentation/synthesis/recovery-discovery deltas = 0;
18. recipe-generation calls = 0;
19. auth-like rendered requests = 0;
20. wrong-task probe attempts = 0;
21. stochastic decisions = 0;
22. no holdout evidence is accessed.

If any criterion fails, decision is `REASSESS_5B15_DETERMINISTIC_REPLAY_RESILIENCE`.

If all criteria pass, decision is `GO_5B15_DETERMINISTIC_REPLAY_RESILIENCE`.

A 5B15 GO does **not** retroactively change the historical 5B14 decision; 5B14 remains `REASSESS_5B14_SYMMETRIC_REQUEST_LOCAL_OPERATION_COMPATIBILITY`. A 5B15 GO establishes that the already-discovered six-family capability set, including the documentary new-family recipe, satisfies the missing replay-resilience requirement under the preregistered bounded policy. Development tuning must then stop and the next scientific step is preregistration of a fresh unseen holdout before accessing it.

## Prohibitions
- no provider-, host-, endpoint-, case-, family-, query-key-, or expected-answer-specific retry rules;
- no provider/candidate class ranking changes;
- no discovery or ranking during 5B15;
- no request mutation between retries;
- no changed-input mutation between retries;
- no semantic-verification relaxation;
- no fallback from failed semantic verification to transport-only success;
- no widening of the retry budget after observing results;
- no stochastic retry policy or jitter;
- no post-hoc GO reinterpretation;
- no holdout access before a valid 5B15 GO.
