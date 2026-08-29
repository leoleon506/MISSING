# Experiment 5B3 — Deterministic Provider Selection + Output-Aware Cross-Graph Beam

## Status

This file MUST be the first 5B3-specific commit.

5B3 is a development experiment informed by the completed 5B2 benchmark. It does not alter, rerun, reinterpret, or overwrite the formal 5A, 5B, or 5B2 decisions.

A later fresh unseen holdout is required before making a new generalization claim.

## Frozen development baseline

Repository baseline for 5B3:

- `main` SHA: `cd85224d9e21ba3e0ddf5de02e371872a2931c37`
- valid 5B2 workflow run: `33238335532`
- 5B2 artifact: `9710779860`
- artifact digest: `sha256:66903b7bc33f95af3443fce907cc6af9f14b1350fb67ea17bd70bf69ba615492`
- 5B2 report fingerprint: `157e95b30d7c4babc493e670f2b85e15ea384ea53b3f721b126a1228208f2567`
- 5B2 decision: `REASSESS_5B2_SEMANTIC_IDENTITY_WITNESS_CROSS_GRAPH_BEAM`

Formal 5B2 metrics used as development evidence:

- 3 / 18 strict successes
- 3 semantic families with success
- 3 distinct successful provider hosts
- 3 persisted recipes
- 3 / 3 changed-input replays = 100%
- 39 second-hypothesis attempts
- 0 recipes recovered from the second cross-graph hypothesis
- 1 response-grounded recipe
- semantic identity replay succeeded for every persisted recipe
- all auth, wrong-task, request-mutation, external-reference, validator-graph and duplicate-fetch safety gates passed

The strict 5B2 successes were the Pokémon, dictionary and satellite development cases. The hardened semantic identity witness correctly removed known weak/falsely-coupled results from the formal strict set.

## Post-hoc development diagnosis from 5B2

Because 5B2 is development evidence, its observed failures may be used to design 5B3. They MUST NOT change the formal 5B2 verdict.

Two independent bottlenecks are targeted.

### A. Provider-selection variance

Provider candidate selection/reranking is not deterministic enough across development runs. Providers that were selected and successful in one run may not be selected in another run even when the discovery corpus is materially similar.

This makes treatment comparisons noisy and can suppress a valid downstream compiler improvement before it is exercised.

5B3 therefore freezes provider selection to a deterministic, provider-blind scoring rule computed only from already-acquired candidate metadata and task semantics.

### B. Request beam lacks required-output utility

5B2 executed many second request hypotheses but recovered zero recipes. A request can be executable and semantically related to the task while still returning a response incapable of satisfying the required output contract.

5B3 therefore ranks the two-request beam by a provider-blind **expected output utility** score before execution.

## Development workload

5B3 reuses exactly the same 18 development cases, families, task intents, build inputs, replay inputs and original semantic validators from `src/experiment5aCore.ts`.

No 5A/5B/5B2 case, input, expected answer or validator is edited.

All 5B2 hardenings remain mandatory:

- semantic identity-role compatibility;
- exact identity relation outranks containment;
- numeric containment forbidden;
- INPUT/output role compatibility;
- closed-world response-role resolution;
- semantic witness re-verification on changed-input replay;
- zero semantic-resolver LLM calls during replay;
- maximum 2 unique requests per provider;
- inherited auth, same-provider, wrong-task, request-mutation and external-reference guards.

## Primary hypothesis

> If provider selection is made deterministic from provider-blind evidence already available before synthesis, and the cross-graph two-request beam ranks hypotheses primarily by expected required-output coverage rather than generic request score, then 5B3 will recover at least six semantically strict development successes across at least six families/providers with >=95% replay while preserving all 5B2 safety and semantic-identity guarantees.

## Treatment A — Deterministic provider selection

### Scope

This treatment replaces only the stochastic provider reranking/selection decision used by the 5B3 development benchmark. It does not alter broad provider discovery or inject providers.

The complete broad candidate set produced by the inherited acquisition/discovery stage remains the source universe.

### Allowed evidence

Provider scoring may use only evidence already present before provider execution, including:

- candidate title/name text;
- candidate description/snippet text;
- candidate URL path tokens, but not domain-brand priors;
- documentation/API/OpenAPI/Swagger/REST indicators;
- task intent tokens;
- input-role tokens;
- required-output-role tokens;
- documented/no-auth/public indicators already present in acquired evidence;
- existing provider-neutral structural quality signals.

### Forbidden evidence

The deterministic score MUST NOT use:

- provider/domain allowlists or blocklists;
- 5A/5B/5B2 case IDs;
- benchmark build/replay values;
- expected answers;
- prior success/failure of a named provider in 5A/5B/5B2;
- hardcoded provider-specific bonuses;
- live response values;
- post-execution evidence.

### Scoring dimensions

The deterministic provider score is preregistered as the sum of normalized components:

1. **task semantic overlap** — distinctive lexical overlap between task intent and provider candidate metadata;
2. **required-output support** — overlap between required output roles and candidate metadata/docs/API descriptors;
3. **input-role support** — overlap between task input roles and candidate metadata;
4. **API/documentation evidence** — provider-neutral API/OpenAPI/REST/documentation indicators;
5. **public/no-auth evidence** — only when explicitly available in acquired metadata;
6. **generic-noise penalty** — penalizes generic hosting/social/search/marketing text with no task-specific anchors.

Exact numeric weights MUST be frozen in code and covered by tests before the live 5B3 run.

### Stable ordering

Ties are resolved deterministically by:

1. higher distinctive task-anchor count;
2. higher required-output support;
3. shorter normalized candidate start URL;
4. lexical normalized candidate start URL.

No RNG, model call, wall-clock state, iteration-order dependence or network result may affect ordering once the broad candidate set has been acquired.

### Provider budget

The existing maximum of **8 provider attempts per case** remains unchanged.

Metrics include:

- `deterministicProviderCandidates5b3`
- `deterministicProviderSelected5b3`
- `deterministicProviderTaskOverlap5b3`
- `deterministicProviderOutputSupport5b3`
- `deterministicProviderApiEvidence5b3`
- `deterministicProviderNoisePenalties5b3`
- `deterministicProviderTieBreaks5b3`
- `stochasticProviderRerankerCalls5b3`

`stochasticProviderRerankerCalls5b3` MUST equal zero.

## Treatment B — Output-aware cross-graph request utility

5B2's cross-graph construction remains the base:

1. inherited request hypotheses;
2. native/OpenAPI hypotheses;
3. deduplicate by frozen request shape;
4. execute at most two unique requests per provider total.

5B3 changes only ranking within the safe candidate set.

### Request utility score

Every candidate receives a deterministic utility tuple before execution:

1. **required-output coverage score**;
2. **request-input binding completeness/confidence**;
3. **distinctive task-operation semantic score**;
4. **documented structured-response evidence**;
5. **request simplicity**;
6. inherited/native base score as the final semantic tie component.

Required-output coverage is the dominant factor.

For OpenAPI/schema-backed operations, coverage may use documented response properties/titles/descriptions exactly as in the provider-blind 5B output-coverage machinery.

For inherited non-OpenAPI hypotheses, coverage may use only pre-execution evidence already linked to that hypothesis:

- source operation text;
- evidence snippets/documentation text;
- documented field/role labels;
- relational summary/graph labels available before the probe.

It MUST NOT inspect response bodies from an unexecuted candidate.

### Generic output tokens

Generic structural roles such as `id`, `name`, `code`, `value`, `data`, `result`, `item`, and `object` contribute only weak coverage unless paired with a distinctive required-output anchor.

### Beam ordering

Candidate ordering is deterministic by:

1. higher required-output coverage;
2. higher binding score;
3. higher distinctive task-operation score;
4. structured-response evidence;
5. lower request complexity;
6. higher inherited/native base score;
7. frozen request fingerprint lexical order.

The historical inherited primary request does **not** receive an unconditional rank-1 privilege in 5B3. It must compete under the same provider-blind utility function.

### Probe budget

Maximum **2 unique request hypotheses per provider total**, unchanged from 5B2.

A cached observation of the same frozen request does not consume a second network probe. A third unique request is forbidden.

Metrics include:

- `requestUtilityCandidates5b3`
- `requestUtilityOutputCoverage5b3`
- `requestUtilityBindingScore5b3`
- `requestUtilityTaskScore5b3`
- `requestUtilityStructuredEvidence5b3`
- `requestUtilityPrimaryDisplaced5b3`
- `requestUtilitySecondProbeCalls5b3`
- `requestUtilityRecoveredRecipes5b3`
- `requestUtilityThirdProbeRejects5b3`

## Treatment C — Preserve 5B2 semantic acceptance unchanged

5B3 MUST reuse, without weakening:

- `sanitizeProjectionInputs5B2` semantics;
- semantic identity witness role classes;
- relation-strength order;
- numeric-containment prohibition;
- closed-world response-role witness validation;
- semantic identity contract validation;
- changed-input semantic witness replay validation.

A provider/request-selection improvement cannot convert into a recipe unless the same strict 5B2 semantic acceptance succeeds.

## Treatment D — Determinism audit

Before the live benchmark, unit/integration controls must verify that identical frozen provider candidates and request hypotheses produce byte-identical ordering across repeated calls.

The live report records stable ordering fingerprints for:

- provider ordering per case;
- cross-graph request ordering per provider.

Metrics include:

- `providerOrderingFingerprintCount5b3`
- `requestOrderingFingerprintCount5b3`
- `providerOrderingNondeterminismRejects5b3`
- `requestOrderingNondeterminismRejects5b3`

Both nondeterminism reject metrics MUST remain zero.

## Negative controls

Provider-neutral tests MUST reject or down-rank:

1. a generic API candidate with no distinctive task anchor versus a task-specific API candidate;
2. a candidate whose only overlap is generic `id/name/data` tokens;
3. a request whose documented response covers none of the required outputs versus one covering multiple distinctive outputs;
4. a request with stronger generic base score but zero required-output support versus a lower-base-score request with strong output support;
5. any provider-specific/domain-specific scoring rule;
6. any stochastic/model-based provider ranking call;
7. a third unique request for one provider;
8. any request failing inherited auth/same-provider/wrong-task/frozen-request guards.

## Positive controls

Provider-neutral tests MUST demonstrate:

1. identical provider candidate inputs produce identical ordering and fingerprint across repeated calls;
2. required-output support can change provider ordering when task overlap is otherwise comparable;
3. a profile-like operation documenting `username` + `title` outranks a stats-like operation lacking those outputs;
4. a request documenting two distinctive required fields outranks an otherwise higher-base-score request with no output support;
5. a displaced historical primary request can be replaced by a higher-utility request before probing;
6. changed-input replay still validates semantic identity with zero resolver LLM calls.

## Runtime prohibitions

No 5B3 runtime file may contain:

- a development provider domain or endpoint seed;
- a 5A/5B/5B2 case ID conditional;
- benchmark build/replay answers;
- a remembered provider success table;
- special rules for country, dictionary, books, chess, DNS, IP geolocation, package registries or any other workload family;
- a weakened semantic identity, auth, same-provider, wrong-task, request-mutation, external-ref or replay guard.

## Frozen budget

- cases: 18
- provider attempts per case: 8
- documentation pages per provider: 8
- documentation depth: 2
- maximum document bytes: 4 MiB
- maximum unique request hypotheses executed per provider: 2
- stochastic provider reranker calls: **0**
- model for existing closed-world response-role resolution when required: `gpt-4.1-mini-2025-04-14`
- maximum total LLM cost: USD 3.00
- maximum mean LLM cost per strict success: USD 0.15
- maximum median strict-success latency: 90 seconds
- maximum p90 strict-success latency: 180 seconds

Replay may perform no catalog discovery, provider reranking, documentation acquisition, synthesis or semantic-resolver LLM call.

## Primary 5B3 GO criteria

5B3 is GO only if ALL of the following hold:

1. at least **6 / 18 strict successes**;
2. at least **6 semantic families** with strict success;
3. at least **6 distinct successful provider hosts**;
4. every strict success persists a recipe;
5. changed-input replay succeeds for at least **95%** of persisted recipes;
6. every recipe passes unchanged 5B2 semantic identity validation;
7. every persisted INPUT/output binding is role-compatible;
8. `semanticWitnessStrongerCandidateSuperseded5b2 == 0`;
9. `stochasticProviderRerankerCalls5b3 == 0`;
10. deterministic provider ordering fingerprints are produced for all evaluated cases;
11. `providerOrderingNondeterminismRejects5b3 == 0`;
12. deterministic request ordering fingerprints are produced for all providers reaching synthesis;
13. `requestOrderingNondeterminismRejects5b3 == 0`;
14. at least **1 historical-primary request is displaced** by a higher-output-utility request before execution;
15. at least **1 second request hypothesis is actually executed**;
16. at least **1 strict recipe is recovered by the 5B3 output-aware request beam**;
17. at least **1 strict recipe uses a closed-world response-grounded witness**;
18. semantic/response-grounded replay performs **0 LLM calls**;
19. no provider executes more than **2 unique requests**;
20. no auth-like request is rendered or probed;
21. no known-auth endpoint is probed;
22. no wrong-task/entity-incompatible structural probe is executed;
23. no confirmed request origin/path/input/literal binding is mutated;
24. no external OpenAPI reference is fetched;
25. no invented response path or generated output value is accepted;
26. no cross-entity projection is accepted;
27. `validatorGraphMismatchRejects == 0`;
28. duplicate probe/acquisition/spec network fetch regressions remain zero;
29. total and mean LLM cost remain inside the frozen budget;
30. median and p90 strict-success latency remain inside the frozen budget;
31. all 18 development cases complete deterministic provider ordering, evaluation and reporting.

The >=6/18, >=6 families, >=6 providers and >=95% replay thresholds are not lowered.

## Decision strings

- `GO_5B3_DETERMINISTIC_PROVIDER_OUTPUT_AWARE_BEAM`
- `REASSESS_5B3_DETERMINISTIC_PROVIDER_OUTPUT_AWARE_BEAM`

## Execution rule

CI may run unit/integration/generated-source controls only.

Do **not** run the live 5B3 benchmark from the PR branch.

After merge to `main`, manually dispatch:

`Run MISSING Experiment 5B3`

Even a 5B3 GO remains development evidence. A fresh unseen holdout is required before claiming restored generalization.