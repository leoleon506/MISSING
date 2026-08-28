# Experiment 4J — Variable Role & Entity Compatibility

## Status
Preregistered engineering-recovery experiment over the already-burned 4A workload. No fresh blind holdout is consumed.

This README MUST be the first commit on the 4J branch.

## Frozen base
- 4I merge SHA: `008af94c9f6fb6e8f63b8c40616ede0bbcbc3988`
- 4I workflow run: `33136581025`
- 4I job: `98737795553`
- 4I artifact: `9672845149`
- artifact digest: `sha256:e31090849de2cb87af7e2309ebc63a8ba127ed4a7378a3340f89493dfe3a9b06`
- decision: `REASSESS_4I_STRUCTURAL_IDENTIFIER_ROLE_INFERENCE`
- fixed model: `gpt-4.1-mini-2025-04-14`

## Frozen 4I outcome
- formal manufactures: 7
- formal successful families: 4
- replay: 100%
- R4 recovery: 4/6 (`npm_package_metadata`, `cocktail_name_metadata`, `gender_estimate_by_name`, `artwork_object_metadata`)
- OFF: zero accepted structural roles, zero hypotheses, zero probes
- NHTSA: zero accepted structural roles, zero hypotheses, zero probes
- placeholder preservation fixed: zero failures, zero non-auth mutations
- `authLikeRenderedRequests = 1`
- false-positive success observed: `fictional_character_metadata` accepted an Ice And Fire `/api/books/{...}` operation and returned a book, not a character
- controls 42/42

## 4J hypothesis
4I proved that request preservation and exact structural substitution are useful, but it still conflates two questions:
1. Which request variable is controlled by the task input?
2. Is this operation about the same entity/action as the requested task?

4J splits these explicitly.

```text
operation evidence
  ↓
VARIABLE ROLE INFERENCE
  ├── named parameter
  ├── placeholder label
  ├── query-key label
  ├── path-variable label
  ├── documented example route
  └── local descriptions around variable
  ↓
ENTITY/ACTION COMPATIBILITY GUARD
  ├── task entity
  ├── operation entity
  ├── task action
  └── operation action
  ↓
request hypothesis
  ↓
safe probe → observed mapping → double live → replay
```

## Variable-role inference
4J may infer a variable role without requiring the documentation example to contain the frozen build value.

Allowed evidence:
- exact or morphological parameter/placeholder correspondence
- generic identifier (`id`, `code`, `name`, etc.) only when local semantic context disambiguates the entity
- query-key and path-segment labels
- prose immediately local to the operation that names the variable's entity or identifier role
- repeated examples of the same route shape that prove one segment/value position varies

Forbidden:
- provider-specific synonym maps
- endpoint allowlists
- domain-specific seed tables
- using task case IDs to choose literal provider paths
- arbitrary one-input/one-slot binding

Required variable-role metrics:
- `variableRoleCandidates`
- `variableRoleAcceptedNamed`
- `variableRoleAcceptedGenericContextual`
- `variableRoleAcceptedRouteShape`
- `variableRoleRejectedAmbiguous`
- `variableRoleRejectedNoEvidence`

## Entity/action compatibility guard
Before any probe, 4J must prove the operation is semantically compatible with the task.

Task frame is derived only from frozen task intent + input names + required outputs.
Operation frame is derived only from operation title, section title, local context, path/query labels and documented response vocabulary already present in evidence.

Rules:
- explicit contradictory entity evidence is a hard reject
- strong operation entity evidence must overlap task entity evidence
- an identifier match cannot override an entity mismatch
- generic identifiers require entity compatibility before acceptance
- output vocabulary may support entity compatibility but cannot invent missing task semantics
- action mismatch is a reject when both task and operation actions are explicit and contradictory

Canonical expected behavior:
- character task + `/books/{id}` + response/title semantics about books => reject before probe
- VIN task + vehicle/decode operation + `{vin}`/generic identifier role => eligible
- barcode task + product lookup operation + `{code}`/generic identifier role => eligible when product/entity evidence is sufficient

Required entity metrics:
- `entityGuardCandidates`
- `entityGuardAccepted`
- `entityGuardRejectedExplicitMismatch`
- `entityGuardRejectedInsufficientEntityEvidence`
- `actionGuardRejectedMismatch`
- `wrongEntityHypothesesBeforeProbe`

## Auth safety
Retain 4I surgical auth pruning and 4H required-auth blocking.
Additionally, auth-like rendered hypotheses MUST be removed before they count as renderable hypotheses.
Required:
- `authLikeRenderedRequests = 0`
- `knownAuthProbeAttempts = 0`
- no credential literals or auth headers

## Same-graph invariant
Planner and validator reconstruct the same 4J graph.
Successful contracts use:
`4J_VARIABLE_ROLE_ENTITY_COMPATIBILITY:<hypothesis_id>`
Older prefixes reject.

## Required causal tests
1. character task rejects a book operation with matching generic id before probe.
2. character task accepts a character operation with generic id when local entity evidence is strong.
3. VIN task accepts `{vin}` without requiring the example to equal the frozen build VIN.
4. VIN task may accept generic `{id}` only when vehicle/VIN/decode context independently supports the role.
5. barcode task may accept `{code}` only with product/barcode lookup context.
6. generic `{id}` under unrelated entity context rejects.
7. npm and Met placeholder-preservation behavior from 4I remains intact.
8. optional auth pruning remains representation-preserving.
9. auth-like rendered hypotheses are eliminated before the final probe packet.
10. same graph validates; older prefixes reject.
11. no provider/domain/endpoint seed literals are introduced.
12. expanded-evidence provenance remains measurable.

## GO gates
4J is GO only if ALL required gates pass:
- recover >=5 of 6 R4 capabilities
- >=8 semantically valid manufactures
- >=4 successful families
- changed-input replay >=95%
- zero replay cognition/docs/synthesis/schema-probe deltas
- zero numeric-index decisions
- zero docs-origin fallbacks
- zero standalone URL promotions
- zero validator graph mismatch rejects
- zero duplicate rendered URLs actually executed
- `authLikeRenderedRequests = 0`
- `knownAuthProbeAttempts = 0`
- `wrongTaskProbeAttempts = 0`
- `wrongEntityHypothesesBeforeProbe = 0`
- placeholder preservation failures = 0
- non-auth request text mutations = 0
- controls 42/42 and event-derived safety clean
- >=1 confirmed relative-operation/API-base recipe
- >=1 successful recipe from reference-expanded evidence
- aggregate diagnostics equal per-attempt recomputation

Preferred economics:
- total LLM cost <= `$0.60`
- mean LLM cost/success <= `$0.15`

Diagnostic targets:
- retain npm + Met
- recover at least one of OFF or NHTSA
- eliminate the Ice And Fire books false positive before probe
- semantic pre-probe failure rate <70%

If R4 remains <5/6, do NOT auto-create 4JR/4JR2. Attribute the remaining ceiling first.

## Formal decision
- `GO_4J_VARIABLE_ROLE_ENTITY_COMPATIBILITY`
- otherwise `REASSESS_4J_VARIABLE_ROLE_ENTITY_COMPATIBILITY`
