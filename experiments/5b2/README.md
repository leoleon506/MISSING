# Experiment 5B2 — Semantic Identity Witness + Cross-Graph Request-First Beam

## Status

This file MUST be the first 5B2-specific commit.

5B2 is a development experiment informed by the completed 5B benchmark. It does not modify, rerun, reinterpret, or overwrite the formal 5A or 5B decisions.

A later fresh holdout is required before making a new generalization claim.

## Frozen development baseline

Repository baseline for 5B2:

- `main` SHA: `8648ab3a97b98aaa61ec4feec7752f01423b36c4`
- 5B live workflow run: `33233342170`
- 5B artifact: `9709312346`
- 5B artifact digest: `sha256:e0d4b7d8e85a9e5766c9742f4f4e4d1bdb3f1e7625e6920ac82fa224a899140f`
- 5B report fingerprint: `02d6c8b218056048d3f224230a937e2382f207f6ac0b95aa4674e8693a88d810`
- 5B decision: `REASSESS_5B_REQUEST_FIRST_RESPONSE_GROUNDED_ENTITY_COUPLED`

Formal 5B metrics:

- 7 / 18 formal strict successes
- 6 semantic families with success
- 7 distinct providers
- 7 persisted recipes
- 5 / 7 changed-input replays = 71.43%
- 1 request-first recipe
- 1 response-grounded recipe
- 7 recipes carrying a 5B entity-coupling witness
- total LLM cost USD 0.1725384
- mean LLM cost per formal success USD 0.02464834
- median successful latency 61,961 ms
- p90 successful latency 128,103 ms
- all preregistered auth, wrong-task, request-mutation, external-ref, validator-graph and duplicate-fetch safety gates passed

The two formal 5B gates that failed were:

- replay rate >= 0.95
- at least 2 request-first recipes

## Post-hoc development diagnosis from 5B

Because 5B is development evidence, the following observed failures may be used to design 5B2. They MUST NOT change the formal 5B verdict.

### A. Weak witness selection

The 5B entity-coupling relation allowed a bounded containment relation and then sorted valid witness candidates lexicographically by observed path.

This allowed a weaker text containment witness to beat a stronger exact identity witness.

Generic failure pattern:

- input value appears in a human-readable definition/description field;
- a separate response field exactly equals the input;
- lexical path ordering chooses the definition/description field;
- changed-input replay fails because the incidental containment does not persist.

### B. Semantic-role-incompatible identity witness

A numeric task identifier can accidentally occur in a pagination/page/range field inside an unrelated response entity and pass bounded containment.

Generic failure pattern:

- task input role is an identifier;
- selected response entity contains a text field such as page/range/description containing the same digits;
- another output is projected from that entity;
- containment creates a false entity witness even though the matched field is not semantically an identity field.

### C. OUTPUT <- INPUT role incompatibility

A projection may copy an input into a required output whose semantic role is incompatible.

Generic failure pattern:

- input is a code/identifier;
- required output is a human-readable name/label/title;
- projection uses the input directly;
- the legacy semantic validator checks only non-emptiness and accepts the copied code.

### D. Request-first treatment too narrow

5B applied the new request-first continuation primarily to native/OpenAPI-derived operations.

The inherited request graph often already contained multiple safe request hypotheses, but only the inherited top probe was executed before 5B fell back to the native lane.

5B2 therefore extends bounded request-first continuation across the already-generated inherited request graph and the native/OpenAPI graph.

## Development workload

5B2 reuses exactly the same 18 development cases, families, task intents, build inputs, replay inputs and original semantic validators from `src/experiment5aCore.ts`.

No 5A/5B case or validator is edited.

A 5B2 success requires:

1. the existing semantic validator;
2. projection input/output semantic-role compatibility;
3. semantic identity witness validation;
4. changed-input replay re-verification of the frozen witness.

## Hypothesis

> If MISSING only accepts input-response identity witnesses whose response field is semantically compatible with the task input role, ranks exact identity relations above weaker containment, forbids semantically incompatible OUTPUT <- INPUT projections, and applies a two-hypothesis request-first beam across both inherited and native request graphs, then it will retain at least six semantically valid development successes while restoring >=95% changed-input replay and demonstrating at least one recovery from a non-primary request hypothesis, without weakening existing safety or cost guards.

## Treatment A — Semantic identity-role compatibility

Each task input role and response witness field is assigned a provider-blind semantic role signature derived only from lexical/schema metadata.

### Input-role evidence

May use:

- input variable name;
- task intent tokens;
- generic role morphology such as `_id`, `_code`, `_name`, `_key`, `_identifier`, `_username`, `_word`, `_domain`, `_address`.

### Response-field evidence

May use:

- observed leaf name;
- complete observed path tokens;
- documented schema property name/title/description when available.

### Generic compatible role families

The implementation may define provider-neutral semantic classes including:

- identifier/key/code;
- human name/label/title;
- lexical term/name;
- username/handle;
- network address/domain;
- numeric measure/count;
- date/time;
- descriptive text;
- pagination/range/index metadata.

These classes must be lexical and reusable. They MUST NOT contain case IDs, provider names/domains, expected answers or workload-specific endpoint rules.

### Required rule

A response field may witness an input only if its semantic role is compatible with that input role.

Examples of generic incompatibility:

- identifier input <- pagination/page/range field: reject;
- lexical word/name input <- definition/description text field: reject when a lexical identity field exists or when the field itself is not identity-like;
- code input <- human-readable name/title field: reject as identity witness unless the field is explicitly documented as code/identifier.

Metrics include:

- `semanticWitnessCandidates5b2`
- `semanticWitnessCompatible5b2`
- `semanticWitnessRoleRejects5b2`
- `semanticWitnessPaginationRejects5b2`
- `semanticWitnessDescriptiveTextRejects5b2`

## Treatment B — Relation-quality ranking

Valid semantic witness candidates are ranked deterministically by relation strength before path order.

Frozen priority:

1. exact normalized string equality;
2. exact numeric equality;
3. exact multi-input composite identity;
4. bounded complete-identifier containment.

Tie-breakers after relation quality:

1. stronger semantic-role compatibility score;
2. shallower response path;
3. shorter path string;
4. lexicographic path order.

A weaker containment candidate MUST NOT be selected when a compatible exact-equality candidate exists in the same entity scope.

Metrics include:

- `semanticWitnessExactSelected5b2`
- `semanticWitnessNumericExactSelected5b2`
- `semanticWitnessCompositeSelected5b2`
- `semanticWitnessContainmentSelected5b2`
- `semanticWitnessStrongerCandidateSuperseded5b2`

The last metric MUST remain zero.

## Treatment C — OUTPUT <- INPUT semantic compatibility

Every projection expression using `INPUT(name)` is checked against the required output role.

Generic compatible patterns include:

- identical normalized role names;
- output `id` / `identifier` from an input whose role is identifier-like;
- output `name` / `label` from an input whose role is name-like;
- exact compatible code-to-code or address-to-address relations.

Generic incompatible patterns include:

- human name/title/label output from code/id input;
- description/definition output copied from an identity input;
- measure/date/version output copied from unrelated identity/name input.

An incompatible INPUT projection invalidates the candidate before persistence.

Metrics include:

- `projectionInputBindingsChecked5b2`
- `projectionInputBindingsCompatible5b2`
- `projectionInputRoleRejects5b2`
- `projectionHumanNameFromCodeRejects5b2`

## Treatment D — Strict inherited-proof repair without a new probe

If the inherited lane has a successful structured probe but its projection fails 5B2 role compatibility or semantic witness validation, 5B2 may reuse that exact already-observed response proof.

It may:

- recompute deterministic projection;
- remove incompatible INPUT bindings;
- resolve remaining outputs only against already-observed response paths using the closed-world response resolver;
- derive a new 5B2 semantic identity witness.

It MUST NOT:

- modify the frozen executed request;
- re-fetch the request merely to repair projection;
- use expected answers;
- use runtime response values inside the LLM resolver payload;
- invent paths or values.

Metrics include:

- `strictInheritedRepairAttempts5b2`
- `strictInheritedRepairSuccesses5b2`
- `strictInheritedRepairResponseResolverCalls5b2`

## Treatment E — Cross-graph request-first beam

The bounded beam is constructed from already-generated safe request hypotheses from:

1. the inherited request graph returned by the 4S/5B synthesis path;
2. native/OpenAPI hypotheses produced by the existing 5B native compiler.

Hypotheses are deduplicated by frozen request shape:

- origin;
- path;
- input bindings;
- literal bindings.

### Probe budget

Maximum **2 unique request hypotheses per provider total** for the complete 5B2 synthesis path.

The inherited lane's first attempted request counts toward this total even if it returned non-2xx or unusable data.

Therefore:

- if inherited synthesis already attempted one request, 5B2 may execute at most one different additional request;
- if inherited synthesis attempted none, 5B2 may execute at most two;
- cached observation of the same frozen request does not consume a second network probe;
- a third unique request hypothesis is forbidden.

Every additional hypothesis independently retains all existing auth, same-provider, required-slot, body, server-variable, wrong-task, frozen-request and mutation guards.

### Ranking

The beam may use only provider-blind evidence already present before execution:

- inherited request score;
- native output-coverage score;
- task/request semantic overlap;
- request simplicity;
- previously known probe disposition for the already-attempted first request.

It MUST NOT rank based on expected answers or values observed from an unexecuted candidate.

Metrics include:

- `crossGraphCandidates5b2`
- `crossGraphDeduplicatedCandidates5b2`
- `crossGraphAlreadyAttempted5b2`
- `crossGraphAdditionalProbeCalls5b2`
- `crossGraphSecondHypothesisAttempts5b2`
- `crossGraphRecoveredRecipes5b2`
- `crossGraphThirdProbeRejects5b2`

## Treatment F — Frozen 5B2 witnesses and replay

Persisted recipes must carry:

- the exact frozen request proof;
- closed-world response-role witness when used;
- semantic identity witness with role compatibility evidence;
- INPUT/output compatibility fingerprint;
- selected relation strength and semantic score.

Replay must verify, with changed input and zero LLM calls:

- frozen request proof remains unchanged;
- every frozen observed response path exists;
- every INPUT/output binding remains role-compatible;
- the semantic input-response relation still holds;
- the relation occurs in the same entity scope as projected response fields.

## Negative controls

Provider-neutral tests MUST reject:

1. identifier input matched only to `page`, `page_range`, `offset`, `index` or equivalent pagination metadata;
2. word/name input matched to a `definition`, `description`, `summary` or free-text content field when the match is only containment;
3. a weaker containment witness when an exact compatible identity field exists;
4. `human_name <- code_input` projection;
5. `title <- numeric_id_input` projection;
6. cross-row identity/output projection;
7. response-level query echo coupled to an unrelated result row;
8. invented response path or generated output literal;
9. required-auth request;
10. third unique request hypothesis for the same provider.

## Positive controls

Provider-neutral tests MUST accept:

1. exact `word == INPUT(word)` over a definition containing that word;
2. exact `username == INPUT(username)`;
3. exact numeric `record.id == INPUT(resource_id)`;
4. compatible code field such as a documented code/ISO-like identifier matching a code input;
5. multi-input composite identity field containing all complete input components;
6. strict inherited-proof repair where an incompatible INPUT output is replaced by an observed compatible response field;
7. a second safe request hypothesis recovering after the first request is unusable;
8. changed-input replay where exact witness relation re-verifies with zero LLM calls.

## Runtime prohibitions

No 5B2 runtime file may contain:

- a provider domain or endpoint seed for a development case;
- a 5A/5B case ID conditional;
- benchmark build/replay answers;
- special runtime logic for country, dictionary, book, chess, DNS, package registries or any other workload family;
- a weakened auth, same-provider, wrong-task, mutation, external-ref, semantic grounding, replay or safety guard.

## Frozen development budget

- cases: 18
- provider attempts per case: 8
- documentation pages per provider: 8
- documentation depth: 2
- maximum document bytes: 4 MiB
- maximum unique request hypotheses executed per provider across inherited + 5B2 beam: 2
- model: `gpt-4.1-mini-2025-04-14`
- maximum total LLM cost: USD 3.00
- maximum mean LLM cost per strict success: USD 0.15
- maximum median strict-success latency: 90 seconds
- maximum p90 strict-success latency: 180 seconds

Replay may perform no catalog discovery, reranking, documentation acquisition, synthesis or semantic-resolver LLM call.

## Primary 5B2 GO criteria

5B2 is GO only if ALL of the following hold:

1. at least **6 / 18 strict 5B2 successes**;
2. at least **6 semantic families** with strict success;
3. at least **6 distinct successful provider hosts**;
4. every strict success persists a recipe;
5. changed-input replay succeeds for at least **95%** of persisted strict recipes;
6. every persisted recipe passes semantic identity-role compatibility at build and replay;
7. every INPUT projection binding is semantically compatible with its required output role;
8. `semanticWitnessStrongerCandidateSuperseded5b2 == 0`;
9. at least **1 strict inherited-proof repair** succeeds;
10. at least **1 additional cross-graph second-hypothesis probe** is actually executed;
11. at least **1 recipe is recovered by the cross-graph beam** from a non-primary request hypothesis;
12. at least **1 recipe uses a closed-world response-grounded witness**;
13. semantic/response-grounded replay performs **0 LLM calls**;
14. no provider executes more than **2 unique request hypotheses**;
15. no auth-like request is rendered or probed;
16. no known-auth endpoint is probed;
17. no wrong-task/entity-incompatible structural probe is executed;
18. no confirmed request origin/path/input/literal binding is mutated;
19. no external OpenAPI reference is fetched;
20. no invented response path or generated output value is accepted;
21. no cross-entity projection is accepted;
22. `validatorGraphMismatchRejects == 0`;
23. duplicate probe/acquisition/spec network fetch regressions remain zero;
24. total and mean LLM cost remain inside the frozen budget;
25. median and p90 strict-success latency remain inside the frozen budget;
26. all 18 development cases complete reranking and evaluation.

The >=6/18, >=6 families, >=6 providers and >=95% replay thresholds are not lowered from prior experiments.

## Decision strings

- `GO_5B2_SEMANTIC_IDENTITY_WITNESS_CROSS_GRAPH_BEAM`
- `REASSESS_5B2_SEMANTIC_IDENTITY_WITNESS_CROSS_GRAPH_BEAM`

## Execution rule

CI may run unit/integration/generated-source controls only.

Do **not** run the live 5B2 benchmark from the PR branch.

After merge to `main`, manually dispatch:

`Run MISSING Experiment 5B2`

A fresh unseen holdout is still required after 5B2 before claiming restored generalization.
