# Experiment 5B5 — Cross-Document Operation Alignment + Section-Local Evidence

## Status

This file MUST be the first 5B5-specific commit.

5B5 is a development experiment informed by the completed 5B4 benchmark. It does not alter, rerun, reinterpret, or overwrite the formal 5A, 5B, 5B2, 5B3, or 5B4 decisions.

A later fresh unseen holdout is required before making a new generalization claim.

## Frozen development baseline

Repository baseline for 5B5:

- `main` SHA: `7e4471b7eea7fdc958c03d6be7b65b9c4c26adfc`
- valid 5B4 workflow run: `33251662793`
- 5B4 artifact: `9714628228`
- 5B4 artifact digest: `sha256:47f2d34e4378373301d0eeb222ec72fa71de8ec9e619089ff600ebdd32ea4147`
- 5B4 report fingerprint: `e05ea312670499281ada8d21a6d02f28038c9a6c5c697da4db1fc29d368545aa`
- 5B4 decision: `REASSESS_5B4_STRUCTURED_COLLECTION_OPERATION_LOCAL_UTILITY`

Formal 5B4 development result:

- 5 / 18 strict successes
- 5 semantic families with success
- 5 distinct successful provider hosts
- 5 persisted recipes
- 5 / 5 changed-input replays = 100%
- stochastic provider reranker calls = 0
- deterministic provider ordering completed for all 18 cases
- deterministic request ordering completed
- at least one non-primary output-aware beam recovery
- at least two response-grounded recipes
- all inherited auth, wrong-task, request-mutation, external-reference, validator-graph and duplicate-fetch safety gates passed

5B4 failed the global success/family/provider threshold by one strict case.

## Post-hoc development diagnosis from 5B4

Because 5B4 is development evidence, the following observations may be used to design 5B5. They MUST NOT change the formal 5B4 verdict.

### A. Structured collection compilation succeeded

5B4 successfully parsed a real machine-readable collection in the development workload, generated operation-local capsules, induced repeated exemplar slots, and compiled a previously unreachable profile-like operation into a reusable path template.

This demonstrates that the remaining bottleneck is not basic collection parsing or exemplar generalization.

### B. Cross-document response evidence remains disconnected

A structured collection may define the request operation precisely while omitting local response examples. A separate HTML/text documentation page for the same provider may document that exact method/path operation and list response fields.

In 5B4, collection operations with no local response examples correctly received zero/unknown output coverage, but the equivalent response evidence in another documentation document was not transferred to them.

### C. Full-document HTML evidence can still leak between sections

The 5B4 operation-local treatment removed sibling leakage inside structured collections, but inherited request hypotheses may still score against a flattened documentation page containing multiple API sections.

Generic failure pattern:

- section A documents a profile/resource operation and its response fields;
- section B documents stats/context/history;
- both sections live in one acquired document;
- a request from section B receives semantic/output credit from section A because utility sees the full document.

5B5 therefore localizes non-collection documentation evidence by route section and aligns exact operations across documents.

## Development workload

5B5 reuses exactly the same 18 development cases, families, task intents, build inputs, replay inputs and original semantic validators from `src/experiment5aCore.ts`.

No case, input, expected answer or validator is edited.

All successful 5B2/5B3/5B4 treatments remain frozen and mandatory:

- semantic identity-role compatibility;
- exact identity relation outranks containment;
- numeric containment forbidden;
- INPUT/output role compatibility;
- closed-world response-role resolution;
- changed-input semantic witness replay with zero semantic-resolver LLM calls;
- deterministic provider selection;
- stochastic provider reranker calls = 0;
- structured collection compiler and safe repeated-exemplar/explicit-variable induction;
- maximum 2 unique request probes per provider;
- inherited auth, same-provider, wrong-task, request-mutation and external-reference guards.

## Primary hypothesis

> If request hypotheses are scored only against route-local documentation sections, and structurally equivalent operations can align across independently acquired documents using exact normalized method/path identity, then 5B5 will transfer response/output evidence to the correct operation without sibling-section leakage and convert at least one previously unreachable structured-collection operation into a strict replayable recipe, reaching at least six strict development successes while preserving all safety and semantic-identity gates.

## Treatment A — Route-section extraction from non-collection documentation

5B5 may extract bounded documentation sections only from already-acquired successful evidence documents.

A section is centered on a concrete or templated API route occurrence and consists of a bounded local window determined by structural delimiters available in the normalized evidence text.

### Recognized route anchors

A route anchor must contain an absolute or relative HTTP path with at least one `/` separator and may be accompanied by an explicit HTTP method token.

Examples of syntactic forms include, generically:

- `GET /resource/{id}`
- `/resource/:id`
- `/resource/{{id}}`
- `https://api.example.invalid/resource/{id}`

Runtime code MUST NOT contain development provider domains/endpoints or benchmark case IDs.

### Section boundaries

A route-local section begins at the nearest preceding structural heading/line boundary that contains the route anchor or its operation label and ends before the next independent route/heading block, subject to a frozen maximum character budget.

If structural boundaries cannot be determined safely, the route may receive only a narrow bounded context around its own occurrence; the full document is never used as a fallback scoring capsule in 5B5.

### Bounded section size

Each section-local capsule is capped at a fixed maximum character length frozen in code before live execution. Truncation must preserve the route anchor and nearest local response/field material when present.

Metrics include:

- `sectionDocumentsScanned5b5`
- `sectionRouteAnchors5b5`
- `sectionCapsulesCreated5b5`
- `sectionCapsuleBytes5b5`
- `sectionBoundaryFallbacks5b5`
- `sectionFullDocumentFallbacks5b5`

`sectionFullDocumentFallbacks5b5` MUST equal zero.

## Treatment B — Normalized operation identity

Operations from structured collections, inherited request graphs, OpenAPI/native specs, and documentation sections may be compared only through a provider-blind normalized operation identity.

### Method normalization

- explicit HTTP methods are uppercased;
- if a source does not provide a method, method identity is `UNKNOWN`;
- `UNKNOWN` may align to a known method only when there is no conflicting method evidence for the same normalized path in the same document and the executable candidate itself is an inherited safe GET hypothesis;
- conflicting explicit methods reject alignment.

### Path normalization

Path normalization:

1. removes scheme/host/query/fragment;
2. percent-decodes safe path text;
3. collapses duplicate `/` separators;
4. removes a trailing `/` except for root;
5. converts recognized variable syntaxes (`{x}`, `{{x}}`, `:x`) into a generic slot marker `{}`;
6. normalizes case only for comparison; executable request spelling is never mutated by alignment;
7. does not replace arbitrary literal segments by fuzzy similarity.

Thus structurally equivalent variable names can align while unrelated paths cannot.

### Alignment key

The primary alignment key is:

`normalized_method + normalized_path_shape`

A same-origin/provider-scope requirement remains mandatory.

Metrics include:

- `operationIdentityCandidates5b5`
- `operationIdentityExactPathMatches5b5`
- `operationIdentityMethodMatches5b5`
- `operationIdentityMethodUnknownMatches5b5`
- `operationIdentityMethodConflictRejects5b5`
- `operationIdentityPathConflictRejects5b5`

## Treatment C — Cross-document operation alignment

A request hypothesis may receive evidence from a different acquired document only when:

1. both documents belong to the same selected provider candidate;
2. target and source operations have the same normalized path shape;
3. methods are compatible under Treatment B;
4. the source evidence is a route-local section, not the full document;
5. the alignment is unique or all exact matches are byte-equivalent after normalization.

Ambiguous non-equivalent matches are rejected rather than merged.

No alignment may use:

- provider/domain-specific lookup tables;
- benchmark case IDs;
- build/replay values;
- prior successful endpoint memory;
- semantic fuzzy matching without exact path identity;
- expected answers or live response values.

Metrics include:

- `crossDocumentAlignmentCandidates5b5`
- `crossDocumentAlignmentsAccepted5b5`
- `crossDocumentAlignmentAmbiguousRejects5b5`
- `crossDocumentAlignmentCrossProviderRejects5b5`
- `crossDocumentAlignmentEvidenceTransfers5b5`

## Treatment D — Section-local evidence capsules for every request utility evaluation

5B5 replaces broad documentation text in request utility with finite evidence linked to the request's own normalized operation identity.

### For structured collection operations

Utility evidence is:

- the existing 5B4 operation-local collection capsule; plus
- any uniquely aligned section-local evidence from another acquired document.

### For inherited/non-collection request hypotheses

Utility evidence is only section-local evidence whose normalized operation identity matches that request hypothesis.

If no local section is available, the hypothesis receives no broad-document output coverage. It may retain provider-neutral structural/request scores already intrinsic to the hypothesis.

### For OpenAPI/native hypotheses

Existing operation-local OpenAPI evidence remains allowed. Any additional non-spec text must satisfy the same exact section alignment rule.

### No full-document utility fallback

A flattened multi-operation documentation page MUST NOT be used directly for output coverage/task semantic scoring in 5B5.

Metrics include:

- `requestUtilitySectionLocalized5b5`
- `requestUtilityNoLocalSection5b5`
- `requestUtilityBroadDocumentSuppressed5b5`
- `requestUtilitySectionTransferBytes5b5`
- `requestUtilitySectionLocalEvaluations5b5`

## Treatment E — Section-local output coverage

Required-output coverage from text/HTML documentation may use only the aligned local section.

A required output role is supported only by role/field evidence inside that local section under the existing provider-blind output-role machinery.

Words in another route section cannot contribute to coverage.

If a structured collection operation has zero local response fields but an exact aligned HTML section documents response fields for the same method/path, those fields may contribute to that operation's output coverage.

Metrics include:

- `alignedOutputCoverageCandidates5b5`
- `alignedOutputRolesSupported5b5`
- `alignedOutputCoverageScore5b5`
- `alignedStructuredCollectionCoverageUpgrades5b5`
- `sectionSiblingLeakRejects5b5`

`sectionSiblingLeakRejects5b5` MUST remain zero for accepted alignment capsules.

## Treatment F — Deterministic alignment and ranking

For identical acquired evidence and request candidates, section extraction, operation identity, alignment, evidence transfer and final request ordering must be deterministic.

Stable ordering tie-breaks use fingerprints/lexical normalized identities only after semantic/structural scores.

Metrics include:

- `sectionOrderingFingerprintCount5b5`
- `alignmentFingerprintCount5b5`
- `sectionOrderingNondeterminismRejects5b5`
- `alignmentNondeterminismRejects5b5`

Both nondeterminism reject metrics MUST remain zero.

## Treatment G — Preserve two-request beam and semantic acceptance unchanged

5B5 does not increase the request budget.

Inherited, native/OpenAPI and structured-collection hypotheses continue to compete in one deduplicated beam with maximum **2 unique requests per provider total**.

5B5 MUST reuse without weakening:

- 5B2 projection INPUT/output compatibility;
- 5B2 semantic identity witness role classes;
- 5B2 relation-strength ordering;
- numeric-containment prohibition;
- closed-world response-role witness validation;
- changed-input semantic witness replay validation;
- 5B3 deterministic provider selection;
- 5B4 structured collection safety and lineage.

Cross-document alignment changes only pre-execution evidence assignment/ranking. It cannot bypass recipe acceptance.

## Treatment H — Alignment lineage and replay

A strict recipe whose selected request used aligned section evidence must persist an alignment witness containing at least:

- target request hypothesis ID/fingerprint;
- normalized target method/path identity fingerprint;
- source evidence ID/body fingerprint;
- source section fingerprint;
- route anchor fingerprint;
- section bounds fingerprint;
- alignment fingerprint;
- transferred evidence fingerprint;
- final request-ordering fingerprint.

Replay performs zero section extraction, cross-document alignment, provider reranking, documentation acquisition or semantic-resolver LLM calls. It uses the persisted frozen request/semantic witnesses.

## Negative controls

Provider-neutral tests MUST demonstrate/reject:

1. response/output words from a sibling route section do not contribute to another route's utility;
2. `/resource/{id}` does not align to `/resource/{id}/stats`;
3. `POST /resource/{id}` does not align to explicit `GET /resource/{id}`;
4. an ambiguous pair of non-equivalent exact route sections is rejected;
5. a route in another provider candidate cannot transfer evidence;
6. a full documentation page is never used as fallback utility evidence;
7. arbitrary fuzzy operation-name similarity cannot establish alignment;
8. query strings/fragments do not change path identity, but executable request query bindings remain frozen independently;
9. sibling headings sharing substrings do not trigger false leakage merely by substring containment;
10. a third unique request remains forbidden.

## Positive controls

Provider-neutral tests MUST demonstrate:

1. `GET /resource/{username}` aligns across structured collection and HTML documentation when both identify the same normalized operation;
2. variable spelling differences (`{username}`, `:user`, `{{name}}`) normalize to the same path shape only when segment positions match;
3. an aligned section can add documented response fields to a structured collection operation that has no local examples;
4. a profile/resource route can outrank a stats sibling using only its aligned local section;
5. inherited stats/context routes no longer inherit profile response fields from the same documentation page;
6. duplicate byte-equivalent exact sections produce a deterministic equivalent alignment rather than ambiguity;
7. repeated calls produce byte-identical alignment and request-ordering fingerprints;
8. a strict aligned recipe preserves semantic identity and succeeds changed-input replay with zero alignment/resolver LLM calls.

## Runtime prohibitions

No 5B5 runtime file may contain:

- a development provider domain or endpoint seed;
- a 5A/5B/5B2/5B3/5B4 case ID conditional;
- benchmark build/replay answers;
- remembered provider success/failure tables;
- special rules for chess, country, dictionary, books, DNS, IP geolocation, packages or any other workload family;
- literal development exemplars;
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

Replay may perform no catalog discovery, provider reranking, documentation acquisition, structured collection parsing, section extraction, cross-document alignment, synthesis or semantic-resolver LLM call.

## Primary 5B5 GO criteria

5B5 is GO only if ALL of the following hold:

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
12. at least **1 route-local section capsule is created**;
13. `sectionFullDocumentFallbacks5b5 == 0`;
14. at least **1 exact cross-document operation alignment is accepted**;
15. at least **1 structured collection operation receives an aligned section evidence transfer**;
16. at least **1 structured collection operation's output coverage increases from zero/unknown through exact aligned section evidence**;
17. at least **1 aligned structured-collection operation enters the two-request beam**;
18. at least **1 strict recipe is confirmed from a request whose ranking used cross-document aligned section evidence**;
19. at least **1 such aligned recipe succeeds on changed-input replay**;
20. `sectionSiblingLeakRejects5b5 == 0` for accepted section capsules;
21. section/alignment nondeterminism reject metrics remain zero;
22. at least **1 historical 5B4 primary request is displaced** by section-local/aligned utility;
23. at least **1 second request hypothesis is actually executed**;
24. at least **1 strict recipe is recovered by the combined beam from a request that was not the historical inherited primary**;
25. at least **1 strict recipe uses a closed-world response-grounded witness**;
26. semantic/response-grounded replay performs 0 LLM calls;
27. no provider executes more than 2 unique requests;
28. no auth-like request is rendered or probed;
29. no known-auth endpoint is probed;
30. no wrong-task/entity-incompatible structural probe is executed;
31. no confirmed request origin/path/input/literal binding is mutated;
32. no external OpenAPI reference is fetched;
33. no invented response path or generated output value is accepted;
34. no cross-entity projection is accepted;
35. `validatorGraphMismatchRejects == 0`;
36. duplicate probe/acquisition/spec network fetch regressions remain zero;
37. total and mean LLM cost remain inside the frozen budget;
38. median and p90 strict-success latency remain inside the frozen budget;
39. all 18 development cases complete deterministic provider ordering, evaluation and reporting.

The >=6/18, >=6 families, >=6 providers and >=95% replay thresholds are not lowered.

## Decision strings

- `GO_5B5_CROSS_DOCUMENT_OPERATION_ALIGNMENT_SECTION_LOCAL_EVIDENCE`
- `REASSESS_5B5_CROSS_DOCUMENT_OPERATION_ALIGNMENT_SECTION_LOCAL_EVIDENCE`

## Execution rule

CI may run unit/integration/generated-source controls only.

Do **not** run the live 5B5 benchmark from the PR branch.

After merge to `main`, manually dispatch:

`Run MISSING Experiment 5B5`

Even a 5B5 GO remains development evidence. A fresh unseen holdout is required before claiming restored generalization.