# Experiment 4W — Feasibility-Constrained Binding + Distinctive Semantic Contract Gate + Bounded Schema Role Resolver

## Preregistration

This file is the first experiment-specific commit for 4W. No 4W implementation file may be modified before this commit.

### Frozen baseline

- Base/main SHA: `dc28d53b18740f3ea83585877fb851b4ff6a9c11`
- Experiment 4V workflow run: `33222919583`
- Experiment 4V artifact: `9706158528`
- Artifact digest: `sha256:222655129199b147654ea7e0b2c7d228340e131d8fb11958de2f916e4e25ec04`
- 4V report fingerprint: `a3dc77592d18d50dd5378f98c1322fa2dc6b0da0894210cd0937f8857898f9b5`
- 4V decision: `REASSESS_4V_PARAMETER_LOCAL_SEMANTICS_ERROR_AWARE_SCHEMA_ROLE_WITNESS`
- Frozen workload: existing 24 cases / 8 families
- Frozen model: `gpt-4.1-mini-2025-04-14`

### Frozen 4V metrics

- successful manufactures: 7
- families with success: 5
- distinct providers: 7
- persisted recipes: 7
- replay successes: 7
- replay rate: 1.0
- validator graph mismatch rejects: 0
- parameter binding candidates: 31
- accepted local bindings: 2
- generic fallbacks: 7
- ranked native operation candidates: 7
- native transport 2xx: 0
- native usable structured 2xx: 0
- schema role witness calls/accepts: 0/0
- native linked lineage hypotheses: 7
- native confirmed recipes/replays: 0/0

### Scientific observations frozen before implementation

1. 4V did not regress inherited recipes or safety, but did not reach an HTTP 2xx native result.
2. All seven 4V native candidates were concentrated inside one provider/case path and a semantically unrelated generic `{id}` operation could pass because the generic fallback guard required only `intentScore > 0`.
3. `postal_code_location` already ranked a relevant provider first and found an OpenAPI document with multiple operations, but produced zero eligible native operations even though a required generic query parameter can satisfy the sole input while weak optional-parameter lexical overlap can distract a greedy binder.
4. 4V witness logic never activated because no selected native request reached a usable structured response.

These observations motivate a general binding/search change. No provider, domain, endpoint, case identifier or benchmark answer may be hardcoded into runtime implementation.

## Primary hypothesis

If input-to-parameter assignment is solved globally under executable-request feasibility constraints rather than greedily, generic slot fallback is permitted only when distinctive task semantics are anchored in the selected contract/operation, and a bounded schema-role resolver may choose only among observed documented response fields after a usable structured response, then at least one already discovered native OpenAPI operation will become a confirmed replayable recipe without increasing the network-probe budget or weakening any safety gate.

## Treatment A — global feasibility-constrained assignment

Generate candidate input-to-slot mappings using parameter-local evidence, then solve the complete assignment before selecting an operation.

A candidate assignment is feasible only when every required non-auth path/query slot is either:

- bound to exactly one task input, or
- satisfied by an explicit deterministic documented literal (`const`, explicit `default`, or one-value `enum`).

Optional slots do not need bindings. Inputs cannot bind to more than one slot and a slot cannot be bound by more than one input.

Greedy partial assignments that leave a required slot unresolved must never become executable hypotheses.

The global solver must prefer, in order:

1. feasibility,
2. strong parameter-local role evidence,
3. guarded generic required fallback,
4. fewer optional weak bindings,
5. simpler requests.

A weak match to an optional slot must not prevent a sole required generic slot from receiving the only unresolved input when that generic fallback is otherwise semantically admissible.

## Treatment B — weak/generic token suppression

Tokens that are structurally generic must not by themselves establish semantic role equivalence. At minimum, treat the following as weak tokens for semantic role evidence:

`id`, `identifier`, `code`, `name`, `value`, `data`, `query`, `search`, `term`, `input`, `result`, `response`, `api`, `operation`, `return`, `get`.

Weak tokens may contribute tie-breaking/request-shape information, but cannot alone authorize a binding or semantic contract gate.

The weak-token set is generic and provider-blind.

## Treatment C — distinctive semantic contract gate

Before a generic fallback (`id`, `name`, `q`, `s`, `query`, `search`, `term`, `value`, `input`) can make an operation eligible, require distinctive semantic support derived mechanically from the task.

Task semantic anchors are derived from:

- task intent,
- input role names,
- required output role names,

minus generic/structural stop tokens.

Contract/operation evidence may come from:

- OpenAPI info title/description,
- tags,
- operationId,
- operation summary/description,
- path tokens,
- parameter names/descriptions/schema titles/descriptions,
- documented response property names/titles/descriptions.

At least one distinctive task anchor must overlap contract/operation evidence for a generic fallback to be eligible. A score caused only by words such as `api`, `operation`, `id`, `name`, `return`, `get`, `data`, `search`, etc. is insufficient.

Persist the derived anchors and matched anchors for auditability.

## Treatment D — operation ranking after feasible assignment

Only operations with at least one complete feasible assignment may enter native ranking.

Rank with separately persisted components:

- feasibility status,
- strong local binding score,
- generic fallback count/penalty,
- distinctive semantic anchor support,
- operation intent score excluding generic tokens,
- documented response-role support,
- request simplicity.

A feasible required-slot assignment with distinctive support must outrank an infeasible optional-slot lexical match.

## Treatment E — one native network probe remains frozen

Inherited 4S behavior runs first unchanged.

Only if inherited synthesis does not compile and a 4W native hypothesis exists may 4W execute at most ONE additional native network probe for that provider.

No second endpoint retry, no provider-specific retry, no global probe-budget increase.

The treatment must improve selection rather than brute-force alternatives.

## Treatment F — persist failed native probe diagnostics

Persist a bounded diagnostic record for every actually executed 4W native probe, including failures/non-2xx, with:

- hypothesis ID,
- origin/path fingerprint,
- disposition/status when available,
- structured format when available,
- selected operation pointer,
- assignment fingerprint,
- semantic-anchor evidence fingerprint.

Diagnostics must not contain secrets and must not change recipe acceptance. This is observability only.

## Treatment G — semantic error-envelope handling retained

Retain 4V distinction between transport success, structured decoding, semantic error envelopes and usable structured success.

A raw HTTP 2xx is not a usable native success unless it is structured, non-error and can ground at least one required output or provide a valid schema-role witness.

## Treatment H — bounded schema role resolver

4S deterministic semantic grounding remains first and unchanged.

Only after a selected 4W request obtains a non-error structured response and required outputs remain unresolved may one bounded semantic role-resolution step execute.

The resolver receives only:

- generic task intent and required output role names,
- a closed list of documented response-field descriptors from the selected operation,
- the corresponding closed list of fields actually observed in the live response.

The resolver must return strict JSON selecting an `observed_path` from that closed list or `NO_VALID_SOURCE` for each unresolved role.

It may not:

- invent a path,
- return a literal output value,
- transform or normalize a runtime value,
- receive provider name/domain, benchmark case ID, expected answer, or replay value.

Accepted mappings require:

- documented schema support,
- exact observed-path membership,
- one winning path per role,
- confidence above a frozen threshold,
- no ambiguous path reuse unless identity-compatible.

Projected values are copied verbatim from the live response.

Persist a frozen `schema_role_witness_4w` with spec fingerprint, operation pointer, response-schema fingerprint, output role, documented schema path, observed path, semantic evidence fingerprint and resolver-output fingerprint.

Replay performs zero schema-role LLM calls and verifies the frozen path still exists.

## Treatment I — provenance and universal request proof retained

Retain exact linked-contract lineage requirements from 4V and the 4U universal frozen executed-request proof. No fabricated `-lc` IDs, no boolean aliases, no endpoint mutation allowances.

`validatorGraphMismatchRejects` must remain zero.

## Required new metrics

Retain inherited metrics and add at least:

- assignmentCandidates4w
- assignmentFeasible4w
- assignmentInfeasibleRequiredSlots4w
- assignmentSelected4w
- optionalWeakBindingSuppressed4w
- weakTokenOnlyBindingsRejected4w
- distinctiveTaskAnchorsDerived4w
- distinctiveContractAnchorsMatched4w
- genericFallbackAnchorRejects4w
- genericFallbackAnchorAccepts4w
- nativeOperationsRejectedNoDistinctiveSupport4w
- nativeOperationRankedFeasible4w
- nativeOperationProbeCalls4w
- nativeOperationProbeDiagnostics4w
- nativeOperationProbeNon2xx4w
- nativeOperationTransport2xx4w
- nativeOperationStructured2xx4w
- nativeOperationErrorEnvelopeRejects4w
- nativeOperationUsableStructured2xx4w
- schemaRoleResolverCalls4w
- schemaRoleResolverClosedFieldCandidates4w
- schemaRoleResolverAccepted4w
- schemaRoleResolverNoValidSource4w
- schemaRoleResolverRejectedInventedPath4w
- schemaRoleResolverRejectedAmbiguous4w
- schemaRoleResolverReplayUses4w
- schemaRoleResolverReplayLlmCalls4w
- nativeOperationConfirmedRecipes4w
- nativeOperationReplaySuccesses4w
- nativeLinkedLineageConfirmedRecipes4w
- nativeLinkedLineageReplaySuccesses4w

## Required gates

- feasibility_constrained_assignment_active
- required_slots_never_left_unbound
- optional_weak_binding_suppression_active
- weak_token_only_binding_rejected
- distinctive_semantic_contract_gate_active
- generic_fallback_requires_distinctive_anchor
- native_probe_budget_frozen
- native_probe_diagnostics_active
- native_operation_usable_structured_2xx
- semantic_error_envelope_rejection_active
- bounded_schema_role_resolver_active
- schema_role_resolver_closed_world
- schema_role_resolver_value_generation_zero
- schema_role_resolver_replay_zero_llm
- native_linked_provenance_preserved
- native_request_mutations_zero
- external_refs_not_fetched
- auth_required_operations_not_probed
- universal_frozen_request_proof_active
- validator_graph_mismatch_zero

All inherited mandatory safety, replay, provenance, cost and global coverage gates remain mandatory. No threshold may be lowered.

## Negative controls

Provider-neutral synthetic tests must verify at minimum:

1. weak optional `country code` overlap cannot steal a sole input from required generic `q`;
2. infeasible assignment with unbound required slot is rejected;
3. feasible required generic `q` assignment is selected over optional weak match;
4. generic `{id}` operation with only generic task overlap is rejected by distinctive semantic gate;
5. operation with a mechanically derived distinctive task anchor is admitted;
6. weak token `code` alone cannot bind semantically distinct roles;
7. ambiguous complete assignments are rejected or deterministically unresolved rather than guessed;
8. required auth-like slot is never probed;
9. non-2xx native probe is recorded diagnostically but never accepted;
10. HTTP 200 error envelope is not usable;
11. schema resolver cannot select an undocumented or unobserved field;
12. schema resolver cannot provide a literal output value;
13. schema witness mutation is rejected;
14. replay performs zero schema-role resolver calls;
15. fake linked lineage does not satisfy provenance;
16. provider/domain/case-specific strings are absent from runtime implementation.

Positive controls must include:

- globally feasible sole-required generic query assignment;
- exact strong local binding;
- distinctive-anchor generic fallback;
- operation ranking by feasible complete assignment;
- usable structured response;
- bounded closed-world schema-role selection for an opaque documented field;
- frozen witness replay;
- genuine linked lineage.

## Primary treatment success

Require:

- at least one 4W native probe,
- at least one native usable structured 2xx,
- at least one confirmed 4W native recipe,
- at least one successful 4W native replay,
- all seven inherited 4V recipes remain successful,
- replay rate >= 0.95,
- zero auth regression,
- zero request/endpoint mutation,
- zero external-ref fetch,
- replay schema-role LLM calls == 0,
- `validatorGraphMismatchRejects == 0`.

## Overall GO

Retain the existing global GO gates exactly, including the inherited requirement for at least 8 successful manufactures. If 4W treatment succeeds but any inherited global/provenance gate remains incomplete, emit REASSESS rather than weakening it.

Decision strings:

- `GO_4W_FEASIBILITY_CONSTRAINED_BINDING_DISTINCTIVE_SEMANTIC_GATE`
- `REASSESS_4W_FEASIBILITY_CONSTRAINED_BINDING_DISTINCTIVE_SEMANTIC_GATE`

The live benchmark remains manual-only through `Run MISSING Experiment 4W` after merge to `main`.
