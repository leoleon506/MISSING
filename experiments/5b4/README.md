# Experiment 5B4 — Structured API Collection Compiler + Operation-Local Semantic Utility

## Status

This file MUST be the first 5B4-specific commit.

5B4 is a development experiment informed by the completed 5B3 benchmark. It does not alter, rerun, reinterpret, or overwrite the formal 5A, 5B, 5B2, or 5B3 decisions.

A later fresh unseen holdout is required before making a new generalization claim.

## Frozen development baseline

Repository baseline for 5B4:

- `main` SHA: `fc88d67b47edca26c4cc9bdcc0e500370857338d`
- valid 5B3 workflow run: `33239950631`
- 5B3 artifact: `9711141446`
- 5B3 artifact digest: `sha256:a7be6895b1f1212ccfbe6b693119f2e9366373e59da567250b44ad3dfe8125cc`
- 5B3 report fingerprint: `a5fd161d62b123159c7916229501bf7853e12e4e512a4c695e61a76f843a2a41`
- 5B3 decision: `REASSESS_5B3_DETERMINISTIC_PROVIDER_OUTPUT_AWARE_BEAM`

Formal 5B3 development result:

- 5 / 18 strict successes
- 5 semantic families with success
- 5 distinct successful provider hosts
- 5 persisted recipes
- 5 / 5 changed-input replays = 100%
- stochastic provider reranker calls = 0
- deterministic provider ordering completed for all 18 cases
- at least one historical primary request was displaced
- at least one strict recipe was recovered by the output-aware request beam
- at least two response-grounded recipes
- all inherited auth, wrong-task, request-mutation, external-reference, validator-graph and duplicate-fetch safety gates passed

5B3 failed the global success/family/provider threshold by one strict case.

## Post-hoc development diagnosis from 5B3

Because 5B3 is development evidence, the following observations may be used to design 5B4. They MUST NOT change the formal 5B3 verdict.

### A. Structured API collections are being flattened into text

Some providers publish machine-readable API collections (for example Postman Collection v2/v2.1 or structurally similar request collections). The inherited acquisition layer can retrieve such documents, but the current compiler generally treats them as flattened documentation text rather than a first-class operation graph.

That loses request-local structure such as:

- folder/item hierarchy;
- operation name;
- HTTP method;
- raw/structured URL;
- path segments;
- query parameters;
- headers;
- request body mode;
- examples/responses scoped to the same operation.

### B. Request utility can leak semantics across neighboring operations

5B3 ranks inherited requests using evidence attached to a hypothesis. When a large structured collection is represented as one evidence document, words belonging to one operation can influence another operation in the same document.

Generic failure pattern:

- one operation is a resource/profile endpoint;
- sibling operations are stats/history/context endpoints;
- the collection document contains all operation names and fields;
- multiple request hypotheses receive identical apparent required-output coverage even though only one local operation is semantically appropriate.

### C. Example path segments are not compiled into reusable request slots

A collection may document concrete exemplar requests such as sibling operations sharing a path prefix and one concrete resource identifier/name segment. The current engine may preserve the literal exemplar instead of inducing a provider-blind input slot.

5B4 introduces bounded repeated-exemplar slot induction based on structural repetition across sibling operations.

## Development workload

5B4 reuses exactly the same 18 development cases, families, task intents, build inputs, replay inputs and original semantic validators from `src/experiment5aCore.ts`.

No case, input, expected answer or validator is edited.

All successful 5B3 treatments remain frozen and mandatory:

- deterministic provider selection;
- stochastic provider reranker calls = 0;
- 5B3 output-aware two-request beam;
- semantic identity-role compatibility;
- exact identity relation outranks containment;
- numeric containment forbidden;
- INPUT/output role compatibility;
- closed-world response-role resolution;
- changed-input semantic witness replay with zero semantic-resolver LLM calls;
- maximum 2 unique request probes per provider;
- all inherited auth, same-provider, wrong-task, request-mutation and external-reference guards.

## Primary hypothesis

> If machine-readable API collections are compiled into operation-local request hypotheses, repeated exemplar path segments can be safely generalized into input slots using provider-blind structural evidence, and request utility is computed only from the selected operation's local evidence, then 5B4 will convert at least one previously unreachable but already-acquired collection operation into a strict replayable recipe, reaching at least six strict development successes without weakening any 5B2/5B3 safety or semantic-identity gate.

## Treatment A — Structured collection qualification

5B4 may parse an acquired document as a structured API collection only when the document itself provides machine-readable structural evidence.

### Postman qualification

A document qualifies as Postman-like when JSON parsing succeeds and at least one of the following is true:

- `info.schema` identifies a Postman Collection v2/v2.1 schema;
- the root contains an `info` object and an `item` array whose descendant request items contain structured `request.method` and `request.url` fields.

Qualification MUST be structural. Runtime code MUST NOT contain provider names/domains or benchmark case IDs.

### Supported request subset

For 5B4 live execution, collection operations are eligible only when:

- HTTP method is GET;
- request body is absent or empty;
- no required auth credential is implied by collection auth/header/query/path metadata;
- final request origin remains inside the selected provider's inherited allowed-origin scope;
- all required URL variables/path/query slots can be deterministically bound to task inputs or documented deterministic literals;
- no unresolved collection/environment variable remains in the executable request.

Unsupported operations remain evidence but cannot be probed.

Metrics include:

- `structuredCollectionsParsed5b4`
- `structuredCollectionParseRejects5b4`
- `structuredCollectionOperations5b4`
- `structuredCollectionGetOperations5b4`
- `structuredCollectionAuthRejects5b4`
- `structuredCollectionBodyRejects5b4`
- `structuredCollectionUnresolvedVariableRejects5b4`

## Treatment B — Operation-local evidence capsules

Each compiled collection operation receives a finite evidence capsule containing only local structural evidence:

- collection/folder names on its ancestor path;
- operation/item name;
- operation description;
- HTTP method;
- URL path template/path segment labels;
- query parameter keys/descriptions;
- header names/descriptions excluding secret values;
- local request description;
- local example-response names/status/content-type/body schema-like field names when present;
- variables directly referenced by this operation.

Sibling operation names/descriptions/URLs/responses MUST NOT be included in another operation's capsule.

Request utility for a structured collection hypothesis MUST use this capsule instead of the flattened full collection document.

Metrics include:

- `operationLocalCapsules5b4`
- `operationLocalCapsuleBytes5b4`
- `operationLocalSiblingLeakRejects5b4`
- `operationLocalUtilityEvaluations5b4`

`operationLocalSiblingLeakRejects5b4` MUST remain zero in accepted hypotheses; adversarial tests must demonstrate that sibling-only output words do not influence local utility.

## Treatment C — Repeated exemplar slot induction

A literal path segment in a structured collection may be generalized into a task-input slot only under the following frozen structural rule.

For operations sharing the same collection/folder ancestry and origin:

1. compare normalized path segment sequences;
2. identify positions where at least two sibling operations share the same literal segment while later suffix structure differs, OR where local operation/ancestor semantics identify the segment as the resource instance under a stable resource-type prefix;
3. the candidate segment must be non-empty, non-numeric-only unless the task input itself is numeric, and not a generic structural word such as `api`, `v1`, `v2`, `pub`, `public`, `search`, `stats`, `history`, `context`, `profile`, `list`, `all`;
4. exactly one task input must be semantically compatible with the candidate resource role;
5. replacing the literal with that input must leave all other required slots fully resolved;
6. the generalized request must preserve provider origin, method, query/header literals and all inherited safety guards.

### Strong induction evidence

The primary evidence is repeated sibling structure: the same exemplar occupies the same structural resource-instance position across at least two sibling operations while suffixes vary.

### Single-operation fallback

If repeated siblings are unavailable, induction may occur only when the collection uses an explicit path variable (`:name`, `{{name}}`, `{name}` or equivalent) whose variable name is semantically compatible with exactly one task input.

No arbitrary single literal may be generalized solely because it resembles the build input or because replacing it makes the benchmark succeed.

Metrics include:

- `collectionExemplarCandidates5b4`
- `collectionRepeatedExemplarWitnesses5b4`
- `collectionExplicitVariableWitnesses5b4`
- `collectionExemplarSlotsAccepted5b4`
- `collectionExemplarAmbiguousRejects5b4`
- `collectionExemplarUnsafeRejects5b4`

## Treatment D — Collection operation request hypotheses

Each eligible structured collection operation may become a `P1RequestHypothesis`-compatible candidate with:

- exact provider origin;
- generalized/frozen path;
- path/query slots;
- input/literal bindings;
- local collection evidence ID/fingerprint;
- operation-local utility metadata;
- proof type `5b4_structured_collection_operation`;
- no provider/case-specific runtime fields.

Collection hypotheses join the same deduplicated request candidate set as inherited and native/OpenAPI hypotheses.

They do NOT receive extra probe budget.

## Treatment E — Operation-local output utility

5B4 preserves the 5B3 utility tuple but changes evidence scope for collection operations.

Ordering remains:

1. required-output coverage;
2. binding completeness/confidence;
3. distinctive task-operation semantic support;
4. documented structured-response evidence;
5. lower request complexity;
6. inherited/native/collection base score;
7. frozen request fingerprint.

For a collection operation, required-output coverage may use only its operation-local capsule and local examples/responses.

If an operation has no documented local response/output fields, output coverage is **unknown/zero**, not inherited from sibling operations. Task-operation semantics may still differentiate `profile` from `stats`, but cannot fabricate output-field coverage.

Metrics include:

- `collectionOperationUtilityCandidates5b4`
- `collectionOperationOutputCoverage5b4`
- `collectionOperationTaskScore5b4`
- `collectionOperationPrimarySelections5b4`
- `collectionOperationSecondSelections5b4`
- `collectionOperationConfirmedRecipes5b4`
- `collectionOperationReplaySuccesses5b4`

## Treatment F — Preserve semantic acceptance unchanged

5B4 MUST reuse, without weakening:

- 5B2 projection INPUT/output compatibility;
- 5B2 semantic identity witness role classes;
- 5B2 relation-strength ordering;
- numeric-containment prohibition;
- closed-world response-role witness validation;
- 5B2 semantic identity contract validation;
- changed-input semantic witness replay validation;
- 5B3 deterministic provider selection.

A newly compiled collection request is only a candidate. It cannot become a recipe unless the same strict semantic acceptance succeeds.

## Treatment G — Collection lineage and replay

A recipe originating from a structured collection must persist a collection operation witness containing at least:

- source evidence ID and body fingerprint;
- collection schema/type fingerprint;
- ancestor/item name path;
- original method and URL fingerprint;
- generalized path fingerprint;
- exemplar/variable induction witness;
- operation-local capsule fingerprint;
- request ordering fingerprint.

Replay performs zero collection discovery/parsing/model calls. It uses the persisted frozen request contract and inherited replay validators.

## Negative controls

Provider-neutral tests MUST reject or demonstrate:

1. sibling operation output words do not leak into another operation's local capsule/utility;
2. a stats operation does not inherit profile output coverage from the same collection document;
3. an arbitrary literal path segment from a single operation is not generalized without repeated sibling or explicit-variable evidence;
4. numeric literal induction is rejected for non-numeric task input;
5. ambiguous mapping from one exemplar segment to multiple task inputs is rejected;
6. auth-bearing collection requests are not probed;
7. non-GET/body-bearing collection operations are not probed;
8. unresolved `{{environment_variable}}` requests are not probed;
9. cross-provider collection URL origin is rejected by inherited scope guards;
10. a third unique request for one provider remains forbidden.

## Positive controls

Provider-neutral tests MUST demonstrate:

1. a valid Postman v2/v2.1 collection is parsed recursively through folders;
2. operation-local capsules contain the item and ancestor semantics but exclude sibling item semantics;
3. sibling paths such as `/resource/alice`, `/resource/alice/stats`, `/resource/alice/history` induce `/resource/{input}` when exactly one compatible task input exists;
4. explicit variables such as `/resource/{{username}}` bind to a compatible task input without literal exemplar induction;
5. a profile-like operation can outrank a stats-like sibling using only operation-local semantics;
6. collection hypotheses deduplicate with equivalent inherited/native requests by frozen request shape;
7. a collection-origin strict recipe persists lineage and replays with changed input and zero semantic-resolver LLM calls.

## Runtime prohibitions

No 5B4 runtime file may contain:

- a development provider domain or endpoint seed;
- a 5A/5B/5B2/5B3 case ID conditional;
- benchmark build/replay answers;
- remembered provider success/failure tables;
- special rules for chess, country, dictionary, books, DNS, IP geolocation, packages or any other workload family;
- literal development exemplars such as a benchmark username/name/ID;
- a weakened semantic identity, auth, same-provider, wrong-task, request-mutation, external-reference or replay guard.

## Frozen budget

- cases: 18
- provider attempts per case: 8
- documentation pages per provider: 8
- documentation depth: 2
- maximum document bytes: 4 MiB
- maximum unique request hypotheses executed per provider: 2
- stochastic provider reranker calls: 0
- model for existing closed-world response-role resolution when required: `gpt-4.1-mini-2025-04-14`
- maximum total LLM cost: USD 3.00
- maximum mean LLM cost per strict success: USD 0.15
- maximum median strict-success latency: 90 seconds
- maximum p90 strict-success latency: 180 seconds

Replay may perform no catalog discovery, provider reranking, documentation acquisition, collection parsing, synthesis or semantic-resolver LLM call.

## Primary 5B4 GO criteria

5B4 is GO only if ALL of the following hold:

1. at least **6 / 18 strict successes**;
2. at least **6 semantic families** with strict success;
3. at least **6 distinct successful provider hosts**;
4. every strict success persists a recipe;
5. changed-input replay succeeds for at least **95%** of persisted recipes;
6. every recipe passes unchanged 5B2 semantic identity validation;
7. every persisted INPUT/output binding is role-compatible;
8. `semanticWitnessStrongerCandidateSuperseded5b2 == 0`;
9. stochastic provider reranker calls = 0;
10. deterministic provider ordering fingerprints are produced for all 18 cases with zero nondeterminism rejects;
11. deterministic request ordering fingerprints are produced for every synthesis with zero nondeterminism rejects;
12. at least **1 structured collection is successfully parsed**;
13. at least **1 collection operation hypothesis enters a two-request beam**;
14. at least **1 repeated-exemplar or explicit-variable slot induction is accepted**;
15. at least **1 strict recipe is confirmed from a structured collection operation**;
16. at least **1 structured-collection recipe succeeds on changed-input replay**;
17. `operationLocalSiblingLeakRejects5b4 == 0` for accepted collection hypotheses;
18. at least **1 historical 5B3 primary request is displaced** by operation-local utility or collection compilation;
19. at least **1 second request hypothesis is actually executed**;
20. at least **1 strict recipe is recovered by the combined 5B4 beam from a request that was not the historical inherited primary**;
21. at least **1 strict recipe uses a closed-world response-grounded witness**;
22. semantic/response-grounded replay performs 0 LLM calls;
23. no provider executes more than 2 unique requests;
24. no auth-like request is rendered or probed;
25. no known-auth endpoint is probed;
26. no wrong-task/entity-incompatible structural probe is executed;
27. no confirmed request origin/path/input/literal binding is mutated;
28. no external OpenAPI reference is fetched;
29. no invented response path or generated output value is accepted;
30. no cross-entity projection is accepted;
31. `validatorGraphMismatchRejects == 0`;
32. duplicate probe/acquisition/spec network fetch regressions remain zero;
33. total and mean LLM cost remain inside the frozen budget;
34. median and p90 strict-success latency remain inside the frozen budget;
35. all 18 development cases complete deterministic provider ordering, evaluation and reporting.

The >=6/18, >=6 families, >=6 providers and >=95% replay thresholds are not lowered.

## Decision strings

- `GO_5B4_STRUCTURED_COLLECTION_OPERATION_LOCAL_UTILITY`
- `REASSESS_5B4_STRUCTURED_COLLECTION_OPERATION_LOCAL_UTILITY`

## Execution rule

CI may run unit/integration/generated-source controls only.

Do **not** run the live 5B4 benchmark from the PR branch.

After merge to `main`, manually dispatch:

`Run MISSING Experiment 5B4`

Even a 5B4 GO remains development evidence. A fresh unseen holdout is required before claiming restored generalization.