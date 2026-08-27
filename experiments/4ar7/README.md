# Experiment 4A-R7 — Proof Graph + Deterministic Feasibility Solver

## Status
Development/recovery only over the already-burned 4A workload. No fresh blind holdouts are consumed.

## Frozen parent evidence
- 4A-R6R merge SHA: `aa661eb494a2d1bf4c50ee2987da518d8713ed09`
- 4A-R6R run: `33069961373`
- job: `98509360653`
- artifact: `9646571570`
- artifact digest: `sha256:b1780a752b6c0df096d5200d8e567e7c6225f8e7ff1371a345ad042651edf67f`
- report fingerprint: `6c553252de92ef6581e9e3084d872c8305b8dca72f0e5c8c9438f0614f706eb6`
- ledger fingerprint: `fd680f36e3c225190cba967f1ff46b388192608583d27ab5264f354658e84641`
- ledger events: `5242`

## Frozen R6R outcome
- 24 cases / 8 families
- 2 successful manufactures / 1 successful family
- 2 distinct providers / 2 recipes
- 2/2 changed-input replay = 100%
- median success latency 63.212s / p90 68.977s
- total LLM cost `$0.5666756`
- mean LLM cost/success `$0.2833378`
- 139 LLM calls
- 2,439 doc fetches / 1,470 spec probes
- 166 synthesis attempts / 2 repairs / 14 live calls
- 42/42 controls; event-derived safety clean

## Frozen diagnosis before R7
R6R improved extraction enough to produce more selected operations, but did not improve breadth. The remaining dominant failure is representation and feasibility, not provider discovery.

Observed failure classes from the frozen R6R artifact:
1. The six providers already proven in R4 were still ranked as candidate #1, but five died after discovery.
2. 63 synthesis attempts had no usable operation packet; 89 were Stage-A rejects; only 12 Stage-A selects occurred.
3. Stage B could correctly describe intended semantic bindings in prose while emitting the wrong numeric parameter/response indices.
4. Some selected operations did not consume the required task input at all, yet reached live execution.
5. Some operations exposed request evidence but lacked mechanically joined response proof; useful endpoints were therefore either rejected or outranked by less relevant operations with richer schemas.
6. Provider-specific identifier namespaces were treated as if generic integer/string identifiers were universally transferable.
7. R4 remains the strongest breadth result: 6 successful manufactures across 5 families/providers.

## R7 hypothesis
A graph representation of evidence, requests, parameters, response fields, input/output semantics, and identifier namespaces — combined with a deterministic feasibility solver — will prevent impossible operations from reaching the LLM/live boundary and will remove numeric-index corruption.

The LLM must not decide mechanical feasibility and must not emit array indices.

## R7 architecture

### 1. Proof graph
Build a deterministic graph per provider attempt.

Node classes:
- `EVIDENCE`: exact fetched evidence item.
- `ORIGIN`: exact proven HTTPS API origin.
- `OPERATION`: exact GET operation/template.
- `INPUT_SLOT`: exact documented path/query parameter name.
- `OUTPUT_SLOT`: exact documented response path.
- `LITERAL`: exact documented query literal.
- `TASK_INPUT`: frozen case input name/value type.
- `TASK_OUTPUT`: frozen required output name/type.
- `IDENTIFIER_NAMESPACE`: mechanically derived namespace hint when documentation explicitly identifies one.

Edge classes:
- `PROVES_ORIGIN`
- `PROVES_OPERATION`
- `OPERATION_CONSUMES`
- `OPERATION_PRODUCES`
- `PARAMETER_HAS_LITERAL`
- `TASK_INPUT_CANDIDATE_FOR`
- `OUTPUT_CANDIDATE_FOR`
- `SAME_EVIDENCE_BLOCK`
- `SAME_EXPLICIT_TEMPLATE_EXAMPLE`
- `NAMESPACE_REQUIRES`
- `NAMESPACE_PROVIDES`

Every executable fact must retain evidence IDs and source URLs.

### 2. Deterministic request/response joining
Request and response facts may be joined only by generic mechanical evidence:
- same OpenAPI/Swagger operation;
- same explicit endpoint/reference block;
- same code/pre/example block group within a bounded structural/document offset;
- explicit template + compatible concrete example in the same evidence block.

Do not join an arbitrary nearby JSON blob across unrelated endpoint sections.
Do not use live response bodies to construct proof.

### 3. No numeric indices from the LLM
The LLM is forbidden from emitting:
- `operation_index`
- `parameter_index`
- `response_path_index`
- `literal_index`

All LLM-visible objects use stable hashed IDs and exact strings.

### 4. Deterministic operation feasibility
Before any semantic LLM call, an operation is mechanically infeasible if:
- it has no request transformation path from every required task input that must influence the request;
- a required documented path/query parameter cannot be bound from task input or an exact documented literal;
- it has no proven response fields and a required task output cannot legally echo an exact task input;
- it requires credentials/authentication or non-anonymous state;
- identifier namespace evidence explicitly conflicts with the task input namespace.

No mechanically infeasible operation may reach live execution.

### 5. Input influence gate
For cases whose task outputs depend on the task input, at least one request path/query binding must depend on the changed build/replay input unless the operation proof explicitly documents a zero-input singleton capability matching the case semantics.

This prevents calls such as a static `/lookup` or provider configuration endpoint from being executed for a value-dependent task.

### 6. Deterministic exact/lexical mappings first
Map task input/output names to documented parameter/response names without an LLM when generic normalization is sufficient:
- case fold;
- camelCase / snake_case / kebab tokenization;
- singular/plural normalization limited to mechanical suffix handling;
- common representation-only wrappers such as `data.0.<field>` retain the exact response path but expose field tokens for matching.

No provider- or workload-specific synonym table is allowed.

### 7. Semantic mapping only for unresolved ambiguity
If multiple feasible mappings remain, a single temperature-0 structured LLM call may choose among stable IDs only.

Allowed output shape:
- exact `operation_id` from a supplied finite enum;
- task-input-name -> exact `parameter_id` or `OMIT` where optional;
- required-output-name -> exact `response_field_id` or exact `TASK_INPUT:<name>`.

The model cannot author URLs, paths, parameter names, field paths, literals, origins, namespaces, or numeric positions.

### 8. Semantic mapping verification
After the LLM returns stable IDs, the deterministic solver rechecks:
- selected IDs exist in the exact graph;
- every required input influence condition remains satisfied;
- all required operation parameters are bound;
- all required outputs are covered exactly once;
- no output field is re-used for semantically incompatible required outputs when the field value/domain proof does not support it;
- namespace constraints remain compatible.

Failure returns REJECT before live execution. No live-response repair.

### 9. Identifier namespace handling
Namespaces are conservative and evidence-driven.

If documentation explicitly states an identifier scheme/entity namespace (for example an object identifier belonging to that API/provider), persist it in graph proof. A task input with an explicit incompatible namespace cannot be bound.

If no namespace evidence exists, mark `namespace=unknown`; do not invent compatibility. Unknown namespace is allowed only when the task definition itself is namespace-neutral and build/replay verification can establish the operation without weakening any existing gate.

### 10. Operation ranking after feasibility
Rank only mechanically feasible operations using generic features:
- exact input parameter-name overlap;
- required output field-token overlap;
- proof quality: OpenAPI operation > explicitly paired endpoint+JSON > endpoint template only;
- number of required outputs covered;
- fewer optional/unmapped parameters;
- explicit request/response same-block proof;
- namespace compatibility.

At most 12 feasible operations are exposed to semantic mapping.

### 11. Persist complete R7 attribution
For every provider attempt persist:
- proof graph fingerprint;
- node/edge counts by type;
- request/response join count and reject reasons;
- mechanically feasible/infeasible operation counts;
- infeasibility reason counts;
- exact pre-LLM feasible operation IDs;
- deterministic mappings;
- semantic mapping request/response, if invoked;
- post-LLM verification result;
- exact selected operation proof;
- live disposition;
- replay disposition.

## Engineering recovery gate
Before considering any fresh blind run, R7 must recover at least **5 of the 6 capabilities demonstrated successful by R4**, using the frozen 4A workload and unchanged provider discovery. This diagnostic recovery gate is intentionally stricter than merely beating R6R's 2/24.

The six R4 historical successes are evidence only; implementation may not contain their provider names, domains, case IDs, endpoint paths, or recipes as seeds. Recovery is measured after the run from outputs.

Additional diagnostic requirements:
- >=5 successful manufactures overall;
- >=4 successful families;
- >=95% changed-input replay;
- zero LLM numeric-index decisions by construction;
- zero live calls from mechanically infeasible operations;
- zero live calls with missing required input influence;
- 42/42 controls and safety clean;
- total LLM cost <= `$0.60` preferred;
- mean LLM cost/success <= `$0.15` preferred.

Failure to recover >=5/6 R4-demonstrated capabilities is evidence that this open-documentation manufacturing architecture may have a structural ceiling; do not automatically proceed to R7R/R7R2.

## Frozen unchanged
- exact 24 cases / 8 families and build/replay inputs
- R2 top-120 provider frontier
- R5 deterministic provider reranker/order
- max 8 provider attempts per case
- existing crawl depth/byte/acquisition limits
- anonymous HTTPS GET only
- DNS/private-host/redirect/cross-domain/credential/header safety controls
- 4A semantic validators
- 3X projection execution semantics
- double-live verification
- changed-input zero-cognition replay
- 42 controls
- original 4A formal gates
- fixed model `gpt-4.1-mini-2025-04-14`
- no live response repair

## Forbidden
- provider/domain/case/endpoint-specific maps or regexes
- curated providers or hand-authored recipes
- workload-specific synonym maps
- search-engine/API-directory expansion
- expanding R2 top-120 or max-8 provider attempts
- fresh blind holdouts
- weakening semantic/safety/replay gates
- LLM-authored URLs/paths/parameter names/response paths/literals
- LLM numeric indices for any operation/parameter/field/literal
- using live response bodies to invent or repair proof
- arbitrary concrete-value substitution to fabricate templates

## Formal 4A gates
Same original gates remain authoritative:
- >=12/24 successful manufactures
- >=6/8 successful families
- >=8 distinct provider hosts
- all persisted recipes double-live verified
- >=95% changed-input replay
- zero replay cognition deltas
- 42/42 controls
- event-derived safety clean
- median success latency <=90s
- p90 success latency <=180s
- mean LLM cost/success <=$0.15
- total LLM cost <=$3.00

Formal decision:
- `GO_4A_R7_PROOF_GRAPH_FEASIBILITY_SOLVER`
- otherwise `REASSESS_4A_R7_PROOF_GRAPH_FEASIBILITY_SOLVER`

A formal GO remains engineering-recovery evidence only. Fresh blind breadth validation is still required afterward.
