# Experiment 5B7 — Entity-Coupled Query Operation Gate + Task-Local Semantic Utility

## Status

This file MUST be the first 5B7-specific commit.

5B7 is a development experiment informed by the completed 5B6 benchmark. It does not alter, rerun, reinterpret, or overwrite the formal 5A, 5B, 5B2, 5B3, 5B4, 5B5, or 5B6 decisions. A later fresh unseen holdout remains mandatory before making any new generalization claim.

## Frozen development baseline

- `main` SHA: `f5e97aa85e6f40c94812c9243c01369c4dfb30d4`
- valid 5B6 workflow run: `33259643982`
- 5B6 artifact: `9716982978`
- 5B6 artifact digest: `sha256:c1375340f97647da14fb86420f540adeb46c35f3c31c3bc3e1307d0e76d07d97`
- 5B6 report fingerprint: `855e35d45ad5c77d753456562ca40b95172b36d418b34846db26136571aaf75f`
- 5B6 decision: `REASSESS_5B6_QUERY_ORIENTED_PARAMETER_LOCAL_COMPILER`

Formal 5B6 development result:

- 6 / 18 strict successes
- 5 semantic families with success
- 6 distinct successful provider hosts
- 6 persisted recipes
- 6 / 6 changed-input replays = 100%
- 84 qualified query-oriented operations
- 44 query hypotheses
- 34 query hypotheses entered the two-request beam
- 0 strict query-origin recipes
- 0 query-origin new-family successes
- `queryExampleValueMatchUses5b6 == 0`
- query compiler nondeterminism rejects = 0
- accepted query sibling leakage = 0
- all inherited auth, wrong-task, request-mutation, external-reference, validator-graph, duplicate-fetch, cost and latency gates passed

The blocking 5B6 gates were family diversity and the absence of a strict query-origin recipe.

## Post-hoc development diagnosis from 5B6

Because 5B6 is development evidence, failed query candidates may be inspected to design 5B7. They MUST NOT change the formal 5B6 verdict.

5B6 demonstrated that query-oriented request compilation itself is active and deterministic. The dominant remaining failure occurs before semantic acceptance: the two-request beam can spend its budget on operations whose query parameter and output field vocabulary looks superficially compatible with the task, but whose **operational entity and action** are different from the requested capability.

Generic failure pattern:

- task requests metadata/lookup/resolution for entity X;
- candidate operation accepts an identifier-like `q`, `domain`, `id`, or similar parameter;
- candidate response exposes generic fields such as title/description/status/name;
- request utility becomes high enough to enter the beam;
- the operation actually performs a different capability on a different entity, for example previewing a URL, checking a certificate, generic repository search, or normalizing an unrelated object;
- strict post-probe semantic identity correctly prevents a recipe, but one of only two probe slots is wasted.

5B7 introduces a provider-blind **pre-probe Task↔Operation semantic coupling gate** for 5B6 query hypotheses.

## Development workload

5B7 reuses exactly the same 18 development cases, task intents, build inputs, replay inputs, semantic families and original validators from `src/experiment5aCore.ts`.

No case, build value, replay value, expected answer or validator is edited.

All successful prior treatments remain frozen and mandatory:

- deterministic provider selection from 5B3;
- max-two-request output-aware global beam;
- 5B4 structured collection compiler;
- 5B5 exact cross-document operation alignment and section-local evidence;
- 5B6 query-oriented parameter-local compiler with zero example-value matching;
- 5B2 semantic identity, exact > containment, numeric-containment prohibition and INPUT/output compatibility;
- closed-world response-role resolution and changed-input replay;
- inherited provider-scope, auth, wrong-task, request-mutation and external-reference guards.

## Primary hypothesis

> If a query-oriented operation must demonstrate provider-blind compatibility between the task's distinctive entity/action semantics and the operation's own path, operation-local capsule, query-key context and local output evidence before entering the request beam, then semantically unrelated but superficially field-compatible query operations will be rejected pre-probe, freeing the fixed two-request budget for genuinely task-coupled operations and producing at least one strict query-origin success from a semantic family that had no strict success in 5B6.

## Treatment A — Task semantic decomposition

5B7 derives a finite task semantic profile only from frozen task metadata already available before execution:

- task intent text;
- input role names;
- required output role names.

The profile contains three provider-blind token classes:

1. **entity anchors** — distinctive nouns/identifier-role terms describing the object being queried;
2. **action anchors** — distinctive operation terms describing what should be done or returned;
3. **output anchors** — distinctive required output-role terms.

### Generic vocabulary exclusion

Infrastructure/generic words cannot count as distinctive anchors, including provider-neutral terms such as:

- api, public, service, endpoint, request, response, data, result, object;
- get, query, search, lookup, find, fetch, return, retrieve;
- metadata, information, details when they appear without a distinctive entity anchor;
- id, identifier, code, name, value when they appear without a more specific role/entity term.

The exact stop vocabulary is frozen in runtime before live execution and is provider/case independent.

Metrics include:

- `taskEntityAnchors5b7`
- `taskActionAnchors5b7`
- `taskOutputAnchors5b7`
- `taskDistinctiveAnchorlessCases5b7`

## Treatment B — Operation semantic decomposition

For each 5B6 query hypothesis, 5B7 derives an operation semantic profile only from pre-execution local evidence already attached to that hypothesis:

- executable path tokens;
- query parameter names;
- 5B6 parameter-local capsule text;
- operation-local heading/description fragments present in that capsule;
- local documented response paths/field names;
- proof type/operation-local structural metadata, excluding provider/domain brand names.

Hostname/domain brand tokens MUST NOT contribute positive entity/action coupling.

The profile is finite and deterministic.

Metrics include:

- `queryOperationEntityAnchors5b7`
- `queryOperationActionAnchors5b7`
- `queryOperationOutputAnchors5b7`

## Treatment C — Entity-coupling requirement

A query hypothesis may enter the 5B7 candidate graph only if its operation-local profile demonstrates entity compatibility with the task.

### Strong entity coupling

Strong entity coupling exists when at least one distinctive task entity anchor appears in one of:

- operation path tokens;
- selected query-key names;
- parameter-local descriptions;
- operation-local heading/description.

### Structural identity-role coupling

If lexical entity overlap is absent, a bounded fallback is allowed only when:

- a selected query parameter has a semantic identity role compatible with the task input role;
- the same local capsule also contains at least one distinctive non-generic task entity or output anchor;
- there is no explicit contradictory entity anchor in the operation profile.

Identity-role compatibility alone is insufficient.

### Reject condition

A query candidate with no strong/fallback entity coupling is rejected before request ranking/probing.

Metrics include:

- `queryEntityCouplingCandidates5b7`
- `queryEntityStrongAccepts5b7`
- `queryEntityRoleFallbackAccepts5b7`
- `queryEntityCouplingRejects5b7`

## Treatment D — Action-coupling requirement

A query hypothesis that passes entity coupling must also show operation-action compatibility.

Action coupling may be established by:

1. overlap between distinctive task action anchors and local operation/path/description anchors; OR
2. an entity-coupled read-only retrieval operation whose local outputs support at least one distinctive required output anchor and whose local action profile contains no conflicting specialized action.

### Specialized-action conflict

5B7 maintains a provider-independent lexicon of specialized action classes that must not be silently treated as generic lookup. Examples of generic classes include preview, validation/check, conversion/normalization, health/status check, ranking/scoring, aggregation/statistics, translation, generation and mutation/write actions.

A specialized action detected locally rejects a candidate unless the task's own action profile contains the same action class.

This lexicon describes generic operation semantics only; it MUST NOT contain benchmark entities, provider names or endpoints.

Metrics include:

- `queryActionCouplingCandidates5b7`
- `queryActionStrongAccepts5b7`
- `queryActionOutputFallbackAccepts5b7`
- `queryActionConflictRejects5b7`
- `queryActionCouplingRejects5b7`

## Treatment E — Task-local output evidence

Generic output fields must not substitute for entity/action coupling.

Fields such as title, description, status, name or identifier may contribute output utility only after the operation passes entity and action coupling.

Output coverage is otherwise unchanged and still comes only from local pre-execution evidence.

Metrics include:

- `queryGenericOutputOnlyRejects5b7`
- `queryTaskLocalOutputAccepted5b7`

## Treatment F — Deterministic coupling score and ordering

For accepted query hypotheses, 5B7 computes a deterministic coupling tuple before the existing 5B3 request utility:

1. entity lexical anchors matched;
2. entity role-fallback strength;
3. action anchors matched;
4. conflicting specialized actions, which dominate negatively;
5. distinctive output anchors supported;
6. frozen query hypothesis fingerprint.

Rejected hypotheses never enter the request beam.

Accepted hypotheses retain the existing 5B6 request score/utility evidence; 5B7 does not add extra probes or network calls.

Repeated evaluation on identical frozen evidence/hypotheses MUST produce byte-identical accepted IDs, rejection reasons, fingerprints and ordering.

Metrics include:

- `querySemanticGateAccepted5b7`
- `querySemanticGateRejected5b7`
- `querySemanticGateFingerprintCount5b7`
- `querySemanticGateNondeterminismRejects5b7`

## Treatment G — Negative evidence / contradictory entity anchors

5B7 may reject an operation when its local evidence strongly identifies a different specialized entity class than the task, but only through provider-blind token/role evidence.

No entity-class lookup may contain benchmark case IDs, providers or expected values.

Contradiction evidence must be persisted in the gate audit and cannot be inferred from live response values.

Metrics include:

- `queryContradictoryEntityRejects5b7`

## Treatment H — Beam budget and acceptance unchanged

5B7 changes only which query hypotheses are eligible for the existing request ranking.

It MUST NOT:

- increase provider attempts;
- increase the max-two-request beam;
- alter provider ordering;
- weaken semantic identity;
- weaken INPUT/output compatibility;
- weaken response grounding;
- use live response values for candidate gating;
- use build/replay values for entity/action coupling;
- mutate confirmed requests;
- add external documentation/spec fetches.

Non-query inherited/native/collection candidates continue under their existing rules.

## Treatment I — Gate lineage

Every accepted or rejected 5B6 query hypothesis receives a persisted pre-execution audit record containing:

- query hypothesis ID/fingerprint;
- task semantic-profile fingerprint;
- operation semantic-profile fingerprint;
- matched entity anchor fingerprints;
- matched action anchor fingerprints;
- specialized-action conflict classes;
- distinctive output support fingerprints;
- decision/reason;
- gate fingerprint.

A strict query recipe must persist the accepted gate witness plus the existing 5B6 query-operation witness.

Replay does not rerun the semantic gate.

## Negative controls

Provider-neutral tests MUST demonstrate:

1. a URL-preview operation with generic `title`/`description` fields cannot pass a vulnerability/publication/book-like task merely because outputs overlap;
2. a certificate/health-check operation accepting `domain` cannot pass a DNS-record task unless its local operation evidence actually contains DNS-record semantics;
3. a generic repository/search operation cannot pass an unrelated entity task solely because its `q` parameter accepts an identifier-like value;
4. a normalization/conversion operation is rejected for a metadata lookup task unless the task action explicitly requests normalization/conversion;
5. identity-role-compatible `id`/`q` alone is insufficient;
6. generic output fields alone are insufficient;
7. provider hostname/brand tokens cannot establish coupling;
8. build/replay values are never inspected;
9. an entity-coupled but action-conflicting operation is rejected;
10. rejected query candidates consume zero probe budget;
11. max two unique probes/provider remains unchanged.

## Positive controls

Provider-neutral tests MUST demonstrate:

1. an operation whose path/query/local description explicitly names the task entity passes strong entity coupling;
2. compatible identity-role fallback passes only when the same local capsule also contains a distinctive task entity/output anchor;
3. a read-only metadata/retrieval operation with entity coupling and distinctive local outputs passes action fallback;
4. a specialized action passes when the task requests that same specialized action class;
5. unrelated generic output words do not affect coupling score;
6. repeated gate calls produce byte-identical fingerprints and decisions;
7. an accepted query candidate can enter the same max-two request beam and persist gate lineage in a strict recipe.

## Runtime prohibitions

No 5B7 runtime file may contain:

- a development provider domain or endpoint seed;
- a 5A/5B/5B2/5B3/5B4/5B5/5B6 case ID conditional;
- benchmark build/replay values or expected answers;
- remembered provider success/failure tables;
- special rules for arXiv, CVE/NVD, DNS, books, television, genes, packages, chess or any other workload family;
- a benchmark-specific entity allow/blocklist;
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

## Primary 5B7 GO criteria

5B7 is GO only if ALL inherited semantic/safety/cost/replay gates remain true and ALL of the following hold:

1. >= **6 / 18 strict successes**;
2. >= **6 semantic families** with strict success;
3. >= **6 distinct successful provider hosts**;
4. replay >= **95%**;
5. at least 1 5B6 query hypothesis is rejected by the 5B7 semantic gate pre-probe;
6. at least 1 5B6 query hypothesis passes the 5B7 semantic gate and enters the two-request beam;
7. at least 1 strict recipe originates from a 5B6 query hypothesis that passed 5B7;
8. at least 1 such query recipe succeeds changed-input replay;
9. at least 1 strict 5B7-gated query recipe belongs to a semantic family that had no strict success in 5B6;
10. query semantic-gate nondeterminism rejects = 0;
11. accepted query gate witnesses are complete for every strict query recipe;
12. `queryExampleValueMatchUses5b6 == 0` remains true;
13. query compiler nondeterminism rejects = 0;
14. accepted query sibling leakage = 0;
15. stochastic provider reranker calls = 0;
16. max 2 unique requests/provider;
17. all auth, wrong-task, mutation, external-ref, validator and duplicate-fetch gates remain clean;
18. cost and latency budgets remain satisfied;
19. all 18 development cases complete deterministic provider ordering, semantic gating, evaluation and reporting.

Thresholds are not lowered.

## Decision strings

- `GO_5B7_ENTITY_COUPLED_QUERY_OPERATION_GATE`
- `REASSESS_5B7_ENTITY_COUPLED_QUERY_OPERATION_GATE`

## Execution rule

CI may run unit/integration/generated-source controls only.

Do **not** run the live 5B7 benchmark from the PR branch.

After merge to `main`, manually dispatch:

`Run MISSING Experiment 5B7`

Even a 5B7 GO remains development evidence. A fresh unseen holdout is required before claiming restored generalization.