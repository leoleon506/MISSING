# Experiment 4J — Contextual Identifier Role Transfer

## Status
Preregistered engineering-recovery experiment over the already-burned 4A workload. No fresh blind holdout is consumed.

This README MUST be the first commit on the 4J branch.

## Frozen base
- 4I merge SHA: `008af94c9f6fb6e8f63b8c40616ede0bbcbc3988`
- 4I workflow: `Run MISSING Experiment 4I`
- run: `33136581025`
- job: `98737795553`
- event: `workflow_dispatch`
- artifact: `9672845149`
- artifact digest: `sha256:e31090849de2cb87af7e2309ebc63a8ba127ed4a7378a3340f89493dfe3a9b06`
- formal decision: `REASSESS_4I_STRUCTURAL_IDENTIFIER_ROLE_INFERENCE`
- report fingerprint: `333a84fa2a16fa595b4ce58d27f49dde0974a224a89fa9cbf1df7a7b1b56e630`
- ledger fingerprint: `53bf234905cd143057b00efd83689cfa5aaf0988b9cc76e2f5618c2e63cbb2d0`
- ledger events: `4203`
- fixed model: `gpt-4.1-mini-2025-04-14`

## Frozen 4I outcome
- 24 cases / 8 families
- 7 successful manufactures / 4 families / 7 providers / 7 recipes
- replay 7/7 = 100%
- R4 recovery 4/6: npm, CocktailDB, Genderize, Metropolitan Museum
- OFF and NHTSA still failed before hypothesis generation
- 130 synthesis attempts
- 32 no-operation attempts
- 86 alignment-unusable attempts
- semantic pre-probe failure `(32+86)/130 = 90.7692%`
- placeholder-bearing operations: 66
- placeholder preservation checks: 66
- placeholder preservation failures: 0
- auth pairs pruned surgically: 7
- non-auth request text mutations: 0
- auth-like rendered requests: 1
- known auth probe attempts: 0
- wrong task probe attempts counter: 0
- controls 42/42
- total LLM cost `$0.2303052`
- mean LLM cost/success `$0.0329007429`

## Frozen forensic interpretation
4I validated the placeholder-preserving request path change: npm and Metropolitan Museum were restored with literal placeholders and zero preservation failures. However, structural identifier inference remained too dependent on exact build literals or exact placeholder labels.

For OFF and NHTSA, operations were present but identifier-role acceptance stayed zero because documentation commonly names the input role in nearby prose/title while the request target uses a generic slot, another example value, or a concrete segment not equal to the frozen build value.

A second failure became explicit: `fictional_character_metadata` compiled `https://anapioficeandfire.com/api/books/{structural_character}`. The probe returned valid JSON, but it was the wrong resource entity. This proves that successful HTTP + output field mapping is insufficient without target-entity compatibility.

## 4J hypothesis
Keep the 4G acquisition / Documentation IR / reference expansion stack, keep 4H auth classification, and keep 4I request-preservation invariants. Change only identifier-role transfer and pre-probe entity-target compatibility.

```text
Task input role
   ↓
explicit local role mention near operation
   ↓
unique documented mutable request position
   ↓
contextual role transfer
   ↓
entity-target compatibility gate
   ↓
safe probe → observed mapping → validator → double live → replay
```

## Contextual identifier role transfer
A task input may bind to a documented path/query position even when the slot label is generic or the example value differs from the frozen build value, but only if ALL are true:

1. The normalized task identifier role is explicitly present in local operation evidence: operation title, local heading, parameter description, or bounded source-section text.
2. Exactly one candidate request position is structurally mutable in the operation target.
3. The candidate position is not host/scheme and is not auth-like.
4. The operation has at least one independent semantic support from task entity/action/output vocabulary.
5. If the candidate label is generic (`id`, `code`, `name`, `key`, `value`, `identifier`), require at least two independent non-identifier supports.
6. Transfer changes only the candidate value/placeholder; all other request bytes remain preserved.
7. No provider/domain/endpoint/vertical synonym table is allowed.

Allowed candidate positions:
- documented placeholder
- documented query value slot
- concrete path segment adjacent to an explicit local identifier-role mention
- concrete query value adjacent to an explicit local identifier-role mention
- a segment proven variable by two documented request examples with identical surrounding structure

The rule `one task input + one slot => bind` remains forbidden. The local role mention is mandatory.

Required metrics:
- `contextualRoleCandidates`
- `contextualRoleAcceptedExplicitLocalLabel`
- `contextualRoleAcceptedGenericWithTwoSupports`
- `contextualRoleAcceptedCrossExampleVariation`
- `contextualRoleRejectedNoLocalRole`
- `contextualRoleRejectedAmbiguousPosition`
- `contextualRoleRejectedInsufficientSupport`
- `contextualRoleRejectedAuthLike`

## Entity-target compatibility gate
Before any network probe, 4J must test whether the operation resource target is compatible with the task entity.

Evidence is provider-blind and lexical only:
- task entity tokens come from frozen intent, input role, and required outputs
- operation target tokens come from operation title, section heading, path resource segments, and local context
- a positive compatibility signal exists when the task entity or a mechanically stemmed variant is present in target evidence
- if a competing resource noun dominates the path/operation target and the task entity is absent, reject before probe
- generic action/path tokens (`api`, `get`, `lookup`, `search`, `v1`, `v2`, numbers) do not count as entity support
- no hand-written `character→books`, `VIN→vehicle`, `barcode→product` pair table is allowed

This gate must reject the observed 4I false positive `/api/books/{structural_character}` for `fictional_character_metadata` because the inserted synthetic slot name may not be used as evidence; only original operation evidence counts.

Required metrics:
- `entityTargetChecks`
- `entityTargetAccepted`
- `entityTargetRejectedMismatch`
- `entityTargetRejectedNoEntityEvidence`
- `wrongEntityProbeAttempts = 0`

## Auth invariant
Retain 4H/4I auth safety:
- required auth blocks before render
- optional/rate-limit auth-like query pairs are pruned surgically
- no credential literal copied
- `authLikeRenderedRequests = 0`
- `knownAuthProbeAttempts = 0`
- placeholder preservation failures = 0
- non-auth request text mutations = 0

The single 4I auth-like rendered candidate must be attributed and eliminated before 4J benchmark.

## Same-graph invariant
Planner and validator reconstruct exactly the same 4J request graph.

Successful contracts use:
`4J_CONTEXTUAL_IDENTIFIER_ROLE:<hypothesis_id>`

4I and older prefixes reject.

## Causal tests required before benchmark
1. npm `{package}` remains preserved and compiles correctly.
2. Met `{objectID}` remains preserved and compiles correctly.
3. Optional auth pruning preserves all non-auth bytes.
4. Required auth blocks before render.
5. An NHTSA-style operation with local text `Decode VIN` and a different documented VIN example may bind the unique request segment to `vin` without an `IrParameter`.
6. An OFF-style operation with local text `barcode` and a generic documented `{code}` may bind only with >=2 product/entity/output supports.
7. Generic `{code}` without explicit local `barcode` role rejects.
8. Two candidate mutable positions reject as ambiguous.
9. `/api/books/{id}` with task `fictional_character_metadata` rejects before probe when original evidence lacks character entity support.
10. `/api/characters/{id}` with explicit character context may pass entity-target gate.
11. Synthetic slot names inserted by 4J may not contribute entity evidence.
12. Same 4J graph validates; 4I/older prefixes reject.
13. No provider/domain/endpoint/vertical seed or synonym table introduced.

## GO gates
4J is GO only if ALL required gates pass:
- recover >=5 of 6 R4 capabilities
- >=8 successful manufactures total
- >=4 families with success
- changed-input replay >=95%
- zero replay cognition/documentation/synthesis/schema-probe deltas
- zero numeric-index decisions
- zero documentation-origin fallbacks
- zero standalone navigation URL promotions
- zero validator graph mismatch rejects
- zero duplicate rendered probe URLs actually executed per provider/case
- `authLikeRenderedRequests = 0`
- `knownAuthProbeAttempts = 0`
- `wrongTaskProbeAttempts = 0`
- `wrongEntityProbeAttempts = 0`
- placeholder preservation failures = 0
- non-auth request text mutations = 0
- controls 42/42 and event-derived safety clean
- >=1 confirmed relative-operation/API-base recipe
- >=1 successful recipe from actually reference-expanded evidence
- aggregate diagnostics equal per-attempt recomputation

Preferred economics:
- total LLM cost <= `$0.60`
- mean LLM cost/success <= `$0.15`

Diagnostic target:
- restore/retain npm and Met
- recover at least one of OFF or NHTSA
- eliminate fictional-character→books false positive
- semantic pre-probe failure rate <70%

If R4 recovery remains <5/6, do NOT automatically create 4JR/4JR2; attribute the ceiling first.

## Formal decision
- `GO_4J_CONTEXTUAL_IDENTIFIER_ROLE_TRANSFER`
- otherwise `REASSESS_4J_CONTEXTUAL_IDENTIFIER_ROLE_TRANSFER`
