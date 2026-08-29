# Experiment 5B8 — Role-Segmented Task Semantics + Parameter-Type Conflict + Exact Operation Semantic Transfer

## Status

This file MUST be the first 5B8-specific commit.

5B8 is a development experiment informed by the completed 5B7 benchmark. It does not alter, rerun, reinterpret, or overwrite the formal 5A, 5B, 5B2, 5B3, 5B4, 5B5, 5B6, or 5B7 decisions. The existing 18-case workload remains consumed development evidence. A later fresh unseen holdout remains mandatory before any new generalization claim.

## Frozen development baseline

- `main` SHA: `3c946337f75079f22ab9b07d0a48d3fe574d9c98`
- valid 5B7 workflow run: `33262672067`
- 5B7 artifact: `9717799299`
- 5B7 artifact digest: `sha256:97a212c71d50aff55e472591907e7dc49b51d37b7e1d62cc138f122ec57e931d`
- 5B7 report fingerprint: `67754f2e4b960961ab878bd9a03ac83cd96a32b4cbb835b572c3d60a5135136a`
- 5B7 engine fingerprint: `ea1a8dc0b7db29df59736f0ea5744eabf50790582dc7607996258f65947b8b4d`
- 5B7 decision: `REASSESS_5B7_ENTITY_COUPLED_QUERY_OPERATION_GATE`
- workload fingerprint: `47d4e330ac9d88f6ee0485eb9628f7af669f39b6a606cea90b175fb941aad431`

Formal 5B7 development result:

- 6 / 18 strict successes
- 5 semantic families with success
- 6 distinct successful provider hosts
- 6 persisted recipes
- 5 / 6 changed-input replays = 83.33%
- 43 query candidates evaluated by 5B7
- 26 rejected pre-probe
- 17 accepted
- 16 accepted query hypotheses entered the fixed two-request beam
- 0 strict query-origin recipes
- 0 query-origin changed-input replays
- 0 query-origin new-family successes
- query semantic-gate nondeterminism rejects = 0
- 5B6 query example-value matching = 0
- 5B6 query compiler nondeterminism rejects = 0
- accepted query sibling leakage = 0
- stochastic provider reranker calls = 0
- inherited auth, wrong-task, request-mutation, external-reference, validator-graph and duplicate-fetch safety gates remained clean

The 5B7 replay-rate regression was caused by a replay JSON parse failure in an inherited non-query recipe. 5B8 does not change replay semantics or lower the replay gate.

## Post-hoc development diagnosis from 5B7

Because 5B7 is development evidence, failed query candidates and gate witnesses may be inspected to design 5B8. They MUST NOT change the formal 5B7 verdict.

5B7 proved that pre-probe semantic filtering is active and useful: it rejected 26 of 43 query candidates before the beam. However, accepted false candidates revealed two generic semantic leaks.

### Failure pattern 1 — output vocabulary contaminates entity identity

Task intent sentences often contain both the entity/input clause and the requested output clause. A flat tokenization of the complete intent allows output words such as `version`, `title`, `description`, `status`, or `name` to become apparent entity anchors.

This can incorrectly make an operation look entity-coupled when its local evidence only shares output vocabulary, not the actual queried entity.

5B8 therefore separates task semantics by grammatical/role source. Required output vocabulary MUST NOT establish task entity identity.

### Failure pattern 2 — selected parameter semantics contradict task input type

A query key may be structurally assignable (`q`, `id`, `name`, `domain`) while its local description clearly states a different semantic value type, for example URL, domain, IPv4 address, username, package name, geographic place, or numeric catalog identifier.

5B7 did not have an explicit parameter semantic-type incompatibility gate. 5B8 adds one before a query hypothesis can enter the beam.

### Failure pattern 3 — specialized operation semantics live in a different exact-operation evidence fragment

A local query capsule may omit the operation heading or summary while another already-acquired document for the same provider and exact operation identifies the action, such as preview/check/normalize/search.

5B8 permits bounded semantic transfer only when the evidence refers to the **same exact operation identity**. Whole-document or sibling-operation semantic transfer remains forbidden.

## Development workload

5B8 reuses exactly the same 18 development cases, task intents, input role names, required output roles, build inputs, replay inputs, semantic families and validators from `src/experiment5aCore.ts`.

No case, build value, replay value, expected answer or validator is edited.

All successful prior treatments remain frozen and mandatory:

- deterministic provider selection from 5B3;
- fixed max-two-request output-aware beam;
- 5B4 structured collection compiler;
- 5B5 exact cross-document operation alignment and section-local evidence;
- 5B6 query-oriented parameter-local compiler with zero example-value matching;
- 5B7 pre-probe entity/action gating architecture;
- 5B2 semantic identity, exact > containment, numeric-containment prohibition and INPUT/output compatibility;
- closed-world response-role resolution and changed-input replay;
- inherited provider-scope, auth, wrong-task, request-mutation and external-reference guards.

## Primary hypothesis

> If task entity semantics are derived only from input/entity clauses rather than output vocabulary, selected query parameters must be semantically type-compatible with their bound task inputs, and specialized operation semantics may be transferred only from already-acquired evidence with the same exact operation identity, then false-positive pre-probe query candidates will be rejected without suppressing genuinely task-coupled query operations, yielding at least one strict query-origin success from a semantic family that had no strict success in 5B7 while preserving all inherited safety, determinism and replay constraints.

## Treatment A — Role-segmented task semantics

5B8 derives three non-overlapping task semantic profiles:

1. **entity/input profile**
2. **action profile**
3. **output profile**

### Entity/input profile

Entity anchors may come only from:

- task input role names;
- the pre-return/input clause of the task intent;
- explicit entity nouns or modifiers syntactically associated with the supplied input.

A deterministic provider-blind intent segmenter splits common task phrasing at frozen return/action boundaries such as `identify ... operation that returns`, `returns`, `return`, `that returns`, `and returns`, or equivalent structural boundaries already present in the workload grammar.

Required-output role names and post-return intent vocabulary are forbidden from contributing entity anchors.

### Action profile

Action anchors may come from:

- the operation-request clause of the intent;
- explicit specialized action words in the pre-output clause;
- normalized read/query/search/resolve/geocode/dictionary/DNS/geolocation/profile/metadata-style action families when directly expressed by the task.

### Output profile

Output anchors come only from:

- required output role names;
- post-return/output clause of the intent.

Output anchors may contribute output coverage only after entity and action compatibility. They cannot establish entity coupling.

Metrics include:

- `taskEntityAnchors5b8`
- `taskActionAnchors5b8`
- `taskOutputAnchors5b8`
- `taskEntityAnchorsFromOutputRejected5b8`
- `taskIntentSegmentationFingerprintCount5b8`
- `taskIntentSegmentationNondeterminismRejects5b8`

## Treatment B — Parameter semantic-type inference

For every selected input→query assignment produced by 5B6, 5B8 infers a semantic type for both sides using only names and local pre-execution text.

### Task-input semantic types

Provider-blind classes may include:

- URL/URI
- domain/hostname
- IPv4/IP address
- country code
- city/place name
- username/account handle
- package/library name
- repository owner/name
- vulnerability/CVE-like identifier
- publication/preprint identifier
- gene identifier
- protein/structure identifier
- license identifier
- catalog/numeric identifier
- generic lexical word/name
- unknown identity scalar

The runtime type lexicon describes generic lexical/structural patterns only. It MUST NOT contain development provider names, endpoints, benchmark values, or case IDs.

### Parameter semantic types

A selected query parameter receives type evidence from:

- parameter name;
- parameter-local description/context;
- same-operation local heading/summary if available;
- same-operation exact semantic transfer defined below.

Documented example **values** are forbidden from establishing compatibility with build/replay values.

### Compatibility

An assignment is accepted when:

- task input and parameter types are equal/compatible; OR
- one side is `unknown identity scalar` and the local entity profile independently establishes the task entity; OR
- a frozen provider-blind compatibility relation explicitly permits the pair, for example domain↔hostname.

An explicit incompatible type rejects the whole query hypothesis before ranking.

Examples of generic conflicts:

- URL parameter vs vulnerability identifier
- URL parameter vs publication identifier
- URL parameter vs username
- domain parameter vs IPv4 address
- username parameter vs package name
- numeric catalog identifier vs lexical word

Metrics include:

- `queryParameterTypeAssignments5b8`
- `queryParameterTypeCompatible5b8`
- `queryParameterTypeUnknownFallback5b8`
- `queryParameterTypeConflictRejects5b8`
- `queryParameterTypeAmbiguousRejects5b8`
- `queryParameterTypeExampleValueUses5b8`

`queryParameterTypeExampleValueUses5b8` MUST equal zero.

## Treatment C — Exact operation identity

5B8 defines a provider-scoped operation identity as:

- normalized origin scope;
- HTTP method;
- normalized path shape;
- normalized query-key set for query-oriented operations.

Normalization MUST:

- strip fragment;
- normalize path placeholders without substituting benchmark literals;
- ignore query **values**;
- preserve query-key names;
- preserve method;
- preserve provider scope.

No fuzzy endpoint/entity matching is allowed for semantic transfer.

Metrics include:

- `queryExactOperationIdentities5b8`
- `queryExactOperationIdentityFingerprintCount5b8`

## Treatment D — Exact-operation semantic transfer

A 5B6 query hypothesis may receive additional action/entity/parameter-type semantics from another already-acquired evidence fragment only if all of the following hold:

1. same selected provider candidate;
2. same provider/origin scope;
3. compatible/identical HTTP method;
4. exact normalized path shape;
5. exact normalized query-key set, or the transfer source omits query values while naming the same selected keys;
6. evidence fragment is operation-local/bounded, not whole-document fallback;
7. no conflicting exact-operation semantic fragments exist.

Allowed source forms include already-acquired:

- route-local HTML/text sections;
- structured collection operation capsules;
- OpenAPI operation-local material;
- endpoint/example operation inventory rows;
- other bounded operation-local evidence already present before 5B8.

Transferred semantics may include only:

- operation heading/title;
- summary/description;
- selected parameter descriptions/types;
- explicit specialized action words/classes;
- local response-field names.

Transferred material MUST NOT include unrelated sibling operation text.

Metrics include:

- `queryExactOperationTransferCandidates5b8`
- `queryExactOperationTransfersAccepted5b8`
- `queryExactOperationTransferAmbiguityRejects5b8`
- `queryExactOperationTransferSiblingLeakRejects5b8`
- `queryExactOperationTransferredActionAnchors5b8`
- `queryExactOperationTransferredParameterTypes5b8`

## Treatment E — Revised entity gate

A query operation may pass entity coupling only through:

1. distinctive overlap between the **role-segmented entity/input profile** and local/same-exact-operation entity evidence; OR
2. compatible input↔parameter semantic type plus at least one independent local entity anchor from the entity/input profile.

Forbidden entity evidence:

- required output roles;
- post-return intent tokens;
- generic response fields;
- provider/domain brand tokens;
- live response values;
- build/replay values.

Metrics include:

- `queryEntityStrongAccepts5b8`
- `queryEntityTypedFallbackAccepts5b8`
- `queryEntityOutputContaminationRejects5b8`
- `queryEntityCouplingRejects5b8`

## Treatment F — Revised action gate

After entity and parameter-type compatibility, action compatibility uses:

- local operation action anchors;
- exact-operation transferred action anchors;
- task action profile;
- specialized-action conflict classes inherited/generalized from 5B7.

An exact-operation specialized action conflict rejects the candidate even if generic output fields overlap.

A read-only output-based action fallback remains allowed only when:

- entity coupling already passed without output contamination;
- parameter semantic types are compatible/unknown-safe;
- no specialized action conflict exists;
- at least one distinctive required output is locally supported.

Metrics include:

- `queryActionStrongAccepts5b8`
- `queryActionTransferredStrongAccepts5b8`
- `queryActionOutputFallbackAccepts5b8`
- `queryActionConflictRejects5b8`
- `queryActionCouplingRejects5b8`

## Treatment G — Persist complete ACCEPT and REJECT audit

5B8 persists the complete pre-probe semantic audit for **every** 5B6 query hypothesis, not only accepted strict recipes.

Each audit row contains at least:

- hypothesis ID/fingerprint;
- task entity/action/output profile fingerprints;
- intent-segmentation fingerprint;
- local operation profile fingerprint;
- exact operation identity fingerprint;
- transfer source evidence IDs/fingerprints;
- transferred semantic fingerprint;
- input→parameter type assignments;
- compatibility/conflict result;
- matched entity/action/output anchor fingerprints;
- specialized action conflicts;
- ACCEPT/REJECT decision;
- rejection reason;
- semantic gate fingerprint.

The final report must contain or reference these audit rows so every pre-probe rejection can be reconstructed without rerunning discovery or synthesis.

Metrics include:

- `querySemanticAuditRows5b8`
- `querySemanticAuditAcceptRows5b8`
- `querySemanticAuditRejectRows5b8`
- `querySemanticAuditComplete5b8`

## Treatment H — Determinism

For identical frozen task metadata and acquired evidence, intent segmentation, semantic typing, exact-operation identity, semantic transfer, ACCEPT/REJECT decisions, audit rows, and accepted hypothesis ordering must be byte-identical.

Metrics include:

- `querySemanticGateFingerprintCount5b8`
- `querySemanticGateNondeterminismRejects5b8`
- `queryExactOperationTransferNondeterminismRejects5b8`

All nondeterminism rejects MUST equal zero.

## Treatment I — Preserve beam, execution, acceptance and replay unchanged

5B8 changes only pre-probe semantic eligibility/utility of 5B6 query hypotheses.

It MUST NOT:

- modify provider ordering;
- increase provider attempts;
- increase documentation acquisition;
- increase the fixed max-two unique requests/provider;
- modify non-query inherited/native/OpenAPI/collection request eligibility;
- inspect live response values during pre-probe gating;
- weaken semantic identity;
- weaken response grounding;
- weaken INPUT/output compatibility;
- weaken auth/same-provider/mutation/external-ref guards;
- rerun semantic gate/query compiler/discovery/docs/reranking during replay.

A 5B8 query hypothesis cannot persist unless all inherited strict semantic gates pass.

## Negative controls

Provider-neutral tests MUST demonstrate:

1. output words such as `version`, `title`, or `description` cannot become entity anchors;
2. a task with entity `package` does not become entity-coupled to an unrelated operation merely because both mention `version`;
3. a parameter documented as URL rejects a vulnerability-like identifier input;
4. a parameter documented as URL rejects a publication/preprint identifier input;
5. a parameter documented as username rejects a package-name input;
6. domain↔hostname compatibility may pass;
7. build/replay/example value equality never contributes to type compatibility;
8. same path but different HTTP method cannot transfer semantics;
9. same method/path but different query-key set cannot transfer incompatible parameter semantics;
10. sibling operation headings/descriptions cannot transfer;
11. conflicting exact-operation transfer sources cause ambiguity rejection rather than arbitrary selection;
12. a transferred specialized action such as preview/check/normalize rejects a task that does not request that action;
13. every rejected query gets a persisted audit row;
14. rejected queries consume zero probe budget;
15. max two unique probes/provider remains unchanged.

## Positive controls

Provider-neutral tests MUST demonstrate:

1. task entity anchors come from input/pre-return intent and outputs remain separate;
2. a package-name task binds to a parameter locally described as package/library name;
3. a domain task can bind to a hostname/domain parameter;
4. an unknown identity scalar may pass only with independent entity coupling;
5. exact same-operation local evidence can transfer an operation summary/action;
6. exact same-operation transfer can provide a selected parameter semantic type;
7. a genuine entity-coupled read operation with compatible parameter type and required outputs survives the gate;
8. identical inputs/evidence produce byte-identical audit rows and fingerprints;
9. an accepted 5B8 query candidate can enter the same max-two beam and persist both 5B6 + 5B8 lineage in a strict recipe;
10. changed-input replay does not rerun 5B8 logic.

## Runtime prohibitions

No 5B8 runtime file may contain:

- a development provider domain or endpoint seed;
- a 5A/5B/5B2/5B3/5B4/5B5/5B6/5B7 case ID conditional;
- benchmark build/replay values or expected answers;
- remembered provider success/failure tables;
- special rules for arXiv, CVE/NVD, DNS, books, television, genes, packages, chess, Pokemon or any workload family;
- a benchmark-specific provider/entity allowlist or denylist;
- fuzzy transfer based on provider brand or output-field overlap;
- a weakened semantic/safety/replay guard.

## Frozen budget

- cases: 18
- provider attempts/case: 8
- documentation pages/provider: 8
- documentation depth: 2
- maximum document bytes: 4 MiB
- maximum unique requests/provider: 2
- stochastic provider reranker calls: 0
- existing response-role resolver model: `gpt-4.1-mini-2025-04-14`
- total LLM cost <= USD 3.00
- mean LLM cost/strict success <= USD 0.15
- median strict-success latency <= 90 seconds
- p90 strict-success latency <= 180 seconds

## Primary 5B8 GO criteria

5B8 is GO only if ALL inherited semantic/safety/cost gates remain true and ALL of the following hold:

1. >= **6 / 18 strict successes**;
2. >= **6 semantic families** with strict success;
3. >= **6 distinct successful provider hosts**;
4. replay >= **95%**;
5. at least 1 query candidate is rejected specifically for parameter semantic-type conflict or output-contaminated entity evidence;
6. at least 1 exact-operation semantic transfer is accepted;
7. at least 1 transferred specialized-action or parameter-type signal changes a query eligibility/ranking decision;
8. at least 1 5B8-accepted query hypothesis enters the fixed two-request beam;
9. at least 1 strict recipe originates from a 5B8-accepted query hypothesis;
10. at least 1 such query recipe succeeds changed-input replay;
11. at least 1 strict 5B8 query recipe belongs to a semantic family that had no strict success in 5B7;
12. task entity anchors from output vocabulary = 0;
13. `queryParameterTypeExampleValueUses5b8 == 0`;
14. exact-operation transfer ambiguity/sibling leakage accepted = 0;
15. all query ACCEPT and REJECT audit rows are complete;
16. query semantic-gate nondeterminism rejects = 0;
17. exact-operation transfer nondeterminism rejects = 0;
18. 5B6 query example-value matching remains zero;
19. 5B6 query compiler nondeterminism remains zero;
20. accepted query sibling leakage remains zero;
21. stochastic provider reranker calls = 0;
22. max 2 unique requests/provider;
23. all auth, wrong-task, mutation, external-ref, validator and duplicate-fetch gates remain clean;
24. cost and latency budgets remain satisfied;
25. all 18 development cases complete deterministic provider ordering, semantic gating, evaluation and reporting.

Thresholds are not lowered. A 5B8 GO is still development evidence only.

## Decision strings

- `GO_5B8_ROLE_SEGMENTED_TYPED_OPERATION_TRANSFER`
- `REASSESS_5B8_ROLE_SEGMENTED_TYPED_OPERATION_TRANSFER`

## Execution rule

CI may run unit/integration/generated-source controls only.

Do **not** run the live 5B8 benchmark from the PR branch.

After merge to `main`, manually dispatch:

`Run MISSING Experiment 5B8`

If 5B8 meets the preregistered development GO criteria, freeze the engine and proceed to a fresh unseen holdout rather than tuning these 18 cases further.