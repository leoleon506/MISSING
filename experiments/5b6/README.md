# Experiment 5B6 — Query-Oriented Operation Compiler + Parameter-Local Evidence

## Status

This file MUST be the first 5B6-specific commit.

5B6 is a development experiment informed by the completed 5B5 benchmark. It does not alter, rerun, reinterpret, or overwrite the formal 5A, 5B, 5B2, 5B3, 5B4, or 5B5 decisions. A later fresh unseen holdout is required before making a new generalization claim.

## Frozen development baseline

- `main` SHA: `addfcdb0012a800e418ed58f8ea684406a05edfb`
- valid 5B5 workflow run: `33253306157`
- 5B5 artifact: `9715093717`
- 5B5 artifact digest: `sha256:02a086a57bb3d236abdb7c232400325852c2de9606d2b1fe84e8f175132a31a0`
- 5B5 report fingerprint: `beaa845ac9c656c722d587573bb4ba34a47756388844519c3ac62d33dc8bd8c1`
- 5B5 decision: `REASSESS_5B5_CROSS_DOCUMENT_OPERATION_ALIGNMENT_SECTION_LOCAL_EVIDENCE`

Formal 5B5 development result:

- 6 / 18 strict successes
- 5 semantic families with success
- 6 distinct successful provider hosts
- 6 persisted recipes
- 6 / 6 changed-input replays = 100%
- 460 route-local section capsules
- 16 accepted cross-document alignments
- 8 structured-collection output-coverage upgrades
- 1 aligned structured-collection beam entry
- 1 strict aligned structured-collection recipe with successful changed-input replay
- stochastic provider reranker calls = 0
- all inherited auth, mutation, wrong-task, external-reference, validator-graph, duplicate-fetch, cost and latency gates passed

The only false global 5B5 gate was `at_least_6_families`.

## Post-hoc development diagnosis from 5B5

Because 5B5 is development evidence, its failures may be used to design 5B6. They MUST NOT change the formal 5B5 verdict.

Several failed families reached a relevant provider/documentation surface but did not produce an executable request because the API is documented primarily as a **base endpoint plus query parameters**, rather than a path-variable route.

Observed generic failure patterns include:

- a relevant provider is ranked highly and acquired, but request inventory is empty;
- documentation describes a query/search endpoint and parameter table/list but no path placeholder;
- example URLs contain query keys whose values are examples rather than explicit `{input}` variables;
- inherited query extraction binds the task input to an unrelated generic example request because it scores a full document or example value rather than parameter-local semantics.

5B6 targets only this request-compilation gap.

## Development workload

5B6 reuses exactly the same 18 development cases, task intents, build inputs, replay inputs, families and original semantic validators from `src/experiment5aCore.ts`. No case, answer or validator is edited.

All validated treatments remain mandatory:

- deterministic provider selection from 5B3;
- output-aware max-two-request beam;
- 5B4 structured collection compiler;
- 5B5 exact cross-document operation alignment and section-local evidence;
- 5B2 semantic identity, exact > containment, numeric-containment prohibition and INPUT/output compatibility;
- closed-world response-role resolution and changed-input replay;
- all inherited auth, same-provider, wrong-task, request-mutation and external-reference guards.

## Primary hypothesis

> If query-oriented API documentation is compiled into executable GET hypotheses using only endpoint-local query-key evidence and parameter-local semantic compatibility, without comparing documented example values to benchmark build values, then 5B6 will recover at least one strict success from a previously unsuccessful semantic family while preserving all 5B2–5B5 safety/replay guarantees, reaching at least six strict families.

## Treatment A — Query-oriented operation qualification

5B6 may compile a query-oriented operation only from already-acquired successful evidence belonging to the selected provider candidate.

An operation requires:

1. an HTTPS absolute endpoint/example URL, or a relative endpoint resolvable inside the selected provider scope;
2. GET semantics, either explicit or safely inherited for a documented query/search endpoint with no conflicting method evidence;
3. at least one non-auth query parameter candidate;
4. bounded local evidence around the endpoint/parameter declaration;
5. all task inputs deterministically assignable to distinct query parameters;
6. no unresolved path variable, environment variable, body requirement or auth-like required parameter.

No new documentation/network acquisition is added by 5B6.

## Treatment B — Query-key extraction

Query parameter names may be obtained only from local structural evidence:

- query keys present in a documented example URL;
- explicit parameter table/list rows in the same bounded operation-local section;
- explicit `name=value`, `name: description`, or equivalent parameter declarations in the same local section.

Keys are normalized for comparison but executable spelling is preserved.

Auth-like keys (`authorization`, API key/token/secret/client credential variants) are never eligible input slots and reject a hypothesis when documented as required.

## Treatment C — Parameter-local semantic binding

Task inputs are mapped to query keys without using benchmark values.

Allowed binding signals, in descending order, are:

1. exact/lexical overlap between input role and parameter name;
2. compatible semantic identity role between input name and parameter name;
3. distinctive input-role terms in the parameter's own bounded description/context;
4. for a generic single query key such as `q`, `query`, `search`, `term`, or `s`, exactly one task input may bind only when the parameter-local context contains a distinctive task/input semantic anchor and there is no competing compatible query key.

Forbidden binding evidence:

- equality between a documented example value and build/replay input;
- expected answer;
- provider/domain allowlists;
- case IDs;
- remembered prior endpoint success;
- live response values.

Metrics include:

- `queryOperationsQualified5b6`
- `queryParameterCandidates5b6`
- `queryParameterAssignments5b6`
- `queryParameterLexicalBindings5b6`
- `queryParameterRoleBindings5b6`
- `queryParameterGenericContextBindings5b6`
- `queryParameterAmbiguousRejects5b6`
- `queryParameterAuthRejects5b6`
- `queryExampleValueMatchUses5b6`

`queryExampleValueMatchUses5b6` MUST equal zero.

## Treatment D — Parameter-local capsules

Each query hypothesis receives a finite capsule containing only:

- endpoint/method/path;
- selected query-key names;
- parameter-local descriptions/declarations;
- operation heading/label when available;
- local example-response/output material from the same section.

Sibling operations or unrelated examples in the same document cannot contribute utility.

Metrics include:

- `queryParameterLocalCapsules5b6`
- `queryParameterLocalCapsuleBytes5b6`
- `queryBroadDocumentSuppressed5b6`
- `querySiblingLeakRejects5b6`

Accepted hypotheses require `querySiblingLeakRejects5b6 == 0`.

## Treatment E — Query request hypotheses

An eligible operation becomes a `P1RequestHypothesis`-compatible candidate with:

- exact provider-scoped origin;
- frozen path;
- query slots for task inputs;
- only documented deterministic non-auth literals when necessary;
- proof type `5b6_query_oriented_parameter_local`;
- parameter-local evidence IDs/fingerprints;
- persisted query-operation lineage.

The compiled request must be produced by the existing request compiler; 5B6 does not mutate a confirmed origin/path or inject a third request.

Query hypotheses join the same inherited + native/OpenAPI + structured-collection candidate graph and receive **no extra probe budget**.

## Treatment F — Parameter-local output utility

Required-output coverage/task semantics for a 5B6 query hypothesis use only its parameter-local capsule and local response/example evidence.

If local output evidence is absent, output coverage remains zero/unknown. It is never inferred from an unrelated section or provider metadata.

## Treatment G — Determinism

For identical frozen evidence, query extraction, assignment, hypothesis construction and ordering must be byte-identical across repeated calls.

Metrics include:

- `queryCompilerFingerprintCount5b6`
- `queryCompilerNondeterminismRejects5b6`

The nondeterminism metric MUST remain zero.

## Treatment H — Preserve acceptance and replay unchanged

5B6 changes only pre-execution request candidate construction/ranking.

It MUST NOT weaken:

- semantic identity validation;
- projection INPUT/output compatibility;
- response-grounded closed-world mapping;
- provider scope/auth guards;
- mutation protections;
- max 2 unique requests/provider;
- replay with zero discovery/reranking/docs/query compilation/alignment/semantic-resolver LLM calls.

A query hypothesis cannot persist unless all existing strict semantic gates pass.

## Query lineage

A strict 5B6 query recipe persists at least:

- source evidence ID/body fingerprint;
- endpoint-local capsule fingerprint;
- original endpoint fingerprint;
- method/origin/path fingerprint;
- selected query parameter names;
- input-to-query assignment fingerprint;
- assignment evidence class;
- query compiler fingerprint;
- final request-ordering fingerprint.

Replay uses the persisted frozen request and does not rerun the query compiler.

## Negative controls

Provider-neutral tests MUST reject/demonstrate:

1. example-value equality is never used to bind a task input;
2. auth-like query keys cannot become task slots;
3. a generic `q` key without distinctive local task/input context is rejected;
4. two equally compatible query keys produce ambiguity rather than arbitrary selection;
5. query parameter evidence from a sibling operation cannot transfer;
6. POST/body-required query operations are not compiled;
7. unresolved environment/path variables are rejected;
8. cross-provider endpoints are rejected;
9. arbitrary full-document text is not used as query utility fallback;
10. max two unique network probes remains unchanged.

## Positive controls

Provider-neutral tests MUST demonstrate:

1. an endpoint example such as `/query?id_list=EXAMPLE` can compile `id_list` as a task identifier input without reading the example value;
2. camelCase/snake_case parameter names can align lexically with input roles;
3. a single generic `q` key may bind when its own local description identifies the task entity/search role;
4. endpoint + parameter-table documentation can compile even when the endpoint example omits a concrete query value;
5. local response fields contribute output coverage only to that query operation;
6. identical inputs produce identical query compiler fingerprints/order;
7. a strict query recipe replays with changed input and zero query-compilation/model calls.

## Runtime prohibitions

No 5B6 runtime file may contain:

- a development provider domain/endpoint seed;
- a 5A/5B/5B2/5B3/5B4/5B5 case ID conditional;
- benchmark build/replay values or expected answers;
- remembered provider success/failure tables;
- special rules for publication, security, media, literature, software, science, or any other workload family;
- a weakened semantic/safety/replay guard.

## Frozen budget

- cases: 18
- provider attempts/case: 8
- documentation pages/provider: 8
- documentation depth: 2
- maximum document bytes: 4 MiB
- maximum unique requests/provider: 2
- stochastic provider reranker calls: 0
- model for existing closed-world response-role resolution: `gpt-4.1-mini-2025-04-14`
- total LLM cost <= USD 3.00
- mean LLM cost/strict success <= USD 0.15
- median strict-success latency <= 90 seconds
- p90 strict-success latency <= 180 seconds

## Primary 5B6 GO criteria

5B6 is GO only if ALL inherited 5B5 gates remain true and ALL of the following hold:

1. >= **6 / 18 strict successes**;
2. >= **6 semantic families** with strict success;
3. >= **6 distinct successful provider hosts**;
4. replay >= **95%**;
5. at least 1 query-oriented operation is qualified;
6. at least 1 5B6 query hypothesis enters the two-request beam;
7. at least 1 strict recipe originates from a 5B6 query hypothesis;
8. at least 1 such query recipe succeeds on changed-input replay;
9. at least 1 strict 5B6 query recipe belongs to a semantic family that had no strict success in 5B5;
10. `queryExampleValueMatchUses5b6 == 0`;
11. query compiler nondeterminism rejects = 0;
12. accepted query sibling leakage = 0;
13. stochastic provider reranker calls = 0;
14. max 2 unique requests/provider;
15. all semantic identity, auth, wrong-task, request-mutation, external-ref, validator and duplicate-fetch gates remain clean;
16. cost and latency budgets remain satisfied;
17. all 18 development cases complete deterministic provider ordering, evaluation and reporting.

Thresholds are not lowered.

## Decision strings

- `GO_5B6_QUERY_ORIENTED_PARAMETER_LOCAL_COMPILER`
- `REASSESS_5B6_QUERY_ORIENTED_PARAMETER_LOCAL_COMPILER`

## Execution rule

CI may run unit/integration/generated-source controls only. Do **not** run the live 5B6 benchmark from the PR branch.

After merge to `main`, manually dispatch `Run MISSING Experiment 5B6`.

Even a 5B6 GO remains development evidence. A fresh unseen holdout is required before claiming restored generalization.
