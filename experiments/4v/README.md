# Experiment 4V — Parameter-Local Semantics + Error-Aware Native Responses + Schema Role Witnesses

## Preregistration

This file is the first experiment-specific commit for 4V. Implementation changes must follow it.

### Frozen baseline

- Base/main SHA: `c289f86aa8d9d6ad44bb4fa896566c24f8f0a6a3`
- Experiment 4U workflow run: `33217090046`
- Experiment 4U artifact: `9704200194`
- Artifact digest: `sha256:5ba664c5aad14c8fa77bef2cdee1103dce23058ec64e6063880c74dca4ff2932`
- 4U report fingerprint: `f1cf8252bcedf62a67590c0eebad00cf3ae01eed97dcd580e9d49c23f0ff86c9`
- 4U decision: `REASSESS_4U_SPEC_QUALIFIED_LAZY_OPENAPI_COMPILER_UNIVERSAL_FROZEN_PROOF`
- Frozen workload: existing 24 cases / 8 families
- Model: `gpt-4.1-mini-2025-04-14`

### Frozen 4U metrics

- successful manufactures: 7
- families with success: 5
- distinct providers: 7
- persisted recipes: 7
- replay successes: 7
- replay rate: 1.0
- validator graph mismatches: 0
- native operations discovered: 676
- native operations eligible: 16
- native hypotheses: 16
- native probes: 3
- native structured 2xx: 1
- native response groundings: 0
- native confirmed recipes: 0
- native replay successes: 0
- frozen request proofs: 7 inherited, 7 validated

### Primary hypothesis

If native OpenAPI input binding uses parameter-local evidence only, generic required-parameter fallback is guarded by operation-level intent compatibility, structured HTTP error envelopes are excluded from usable success, and selected response schemas may provide a frozen semantic role witness for opaque live fields, at least one already discovered native operation will yield a semantically valid replayable recipe without increasing the native network-probe budget or weakening safety.

### Treatment A — parameter-local binding

Individual input-to-parameter scoring may use only parameter name, parameter description, schema title/description, matching path placeholder and parameter location. Operation summary/description/tags and other parameters may rank the operation but may not change which slot an input maps to.

Persist binding evidence with input name, parameter name/location, local overlap components, binding kind and score.

### Treatment B — guarded generic fallback

Generic names remain: `id`, `name`, `q`, `s`, `query`, `search`, `term`, `value`, `input`.

Fallback is allowed only when there is exactly one unresolved task input and exactly one unresolved required non-auth path/query parameter, that parameter is generic, no stronger local mapping exists, and provider-blind operation intent compatibility exceeds a deterministic threshold.

### Treatment C — operation ranking

Rank eligible native operations using separate components for parameter binding confidence, operation intent compatibility, structured-response evidence, documented required-output role coverage and request simplicity. Parameter-local binding confidence dominates generic operation-context overlap.

### Treatment D — transport success is not semantic success

Separate transport 2xx, structured 2xx, rejected error envelopes and usable structured 2xx. Generic strong error envelopes include top-level `error`/`errors`, or `success:false`, or clear failure/status evidence with no required-output grounding. Do not reject valid task data merely because a warning or optional error field is also present.

A native response is usable only when transport and structured decoding succeed, it is not a semantic error envelope, and at least one required output is grounded or a valid schema-role witness can ground it.

### Treatment E — response-schema role witness

4S semantic grounding remains the default. Only after a selected native request yields a non-error structured response and deterministic 4S projection still has unresolved required outputs may one bounded semantic role-resolution call occur.

Resolve only the selected successful 2xx response schema; local refs only, no external fetches. The resolver may map documented schema paths to task output roles but may never generate, alter or normalize output values. Runtime values are copied verbatim from the observed live response.

Persist a frozen `schema_role_witness_4v` containing spec fingerprint, operation pointer, response-schema fingerprint, output role, schema path, semantic-evidence fingerprint and classifier-output fingerprint. Replay uses the frozen witness and performs zero schema-role LLM calls.

### Treatment F — linked provenance closure

Preserve source-document evidence ID, linked-contract evidence ID when an exact inherited linked evidence item exists, contract URL, spec fingerprint and operation pointer into the native hypothesis and confirmed recipe. Existing linked-contract / expanded-reference gates may become true only through exact persisted provenance; no fabricated lineage IDs or boolean shortcuts.

### Treatment G — frozen network budget

Run the inherited lane first. If it does not compile, permit at most one native-operation network probe per provider. No second native endpoint after a failed probe and no global probe-budget increase.

### Treatment H — universal frozen request proof

Retain 4U universal frozen executed-request proof unchanged. `validatorGraphMismatchRejects` must remain zero.

### Required metrics

Retain inherited metrics and add at least:

- parameterBindingCandidates4v
- parameterBindingAcceptedLocal4v
- parameterBindingRejectedContextLeak4v
- parameterBindingGenericFallbacks4v
- parameterBindingGenericFallbackRejectedIntent4v
- parameterBindingAmbiguousRejects4v
- nativeOperationRankedCandidates4v
- nativeOperationSelectedByBinding4v
- nativeOperationSelectedByIntent4v
- nativeOperationSelectedByResponseCoverage4v
- nativeOperationTransport2xx4v
- nativeOperationStructured2xx4v
- nativeOperationErrorEnvelopeRejects4v
- nativeOperationUsableStructured2xx4v
- schemaRoleWitnessCalls4v
- schemaRoleWitnessCandidates4v
- schemaRoleWitnessAccepted4v
- schemaRoleWitnessRejectedAmbiguous4v
- schemaRoleWitnessRejectedUndocumented4v
- schemaRoleWitnessReplayUses4v
- schemaRoleWitnessReplayLlmCalls4v
- nativeLinkedLineageHypotheses4v
- nativeLinkedLineageConfirmedRecipes4v
- nativeLinkedLineageReplaySuccesses4v
- nativeExpandedReferenceRecipes4v

### Required gates

- parameter_local_binding_active
- operation_context_parameter_leak_zero
- generic_fallback_intent_guard_active
- native_operation_usable_structured_2xx
- semantic_error_envelope_rejection_active
- schema_role_witness_active
- schema_role_witness_value_generation_zero
- schema_role_witness_replay_zero_llm
- native_linked_provenance_preserved
- native_request_mutations_zero
- external_refs_not_fetched
- auth_required_operations_not_probed
- universal_frozen_request_proof_active
- validator_graph_mismatch_zero

All inherited mandatory safety, replay, provenance and global coverage gates remain mandatory. No numerical threshold may be lowered.

### Controls

Negative controls must cover operation-context leakage into parameters, optional-parameter competition against a sole required generic parameter, unrelated generic-id operation fallback, ambiguous local mappings, HTTP 200 error envelopes, schema witness undocumented/absent/mutated paths, attempted literal value generation, external response-schema refs, replay schema-role calls, linked-lineage URL/fingerprint/fake-ID mutation and provider/case-specific runtime strings.

Positive controls must cover exact local parameter role, description match, guarded generic `q`, operation ranking by stronger binding, usable structured 2xx, opaque documented schema field mapped to a role, frozen witness replay and genuine linked lineage.

### Primary treatment success

Require at least one native usable structured 2xx, one confirmed native recipe and one successful native replay; error envelopes may not count as usable success; auth/request-mutation/external-ref-fetch regressions are zero; validator graph mismatch remains zero; all seven existing 4U recipes remain successful; replay rate remains >= 0.95; replay schema-role LLM calls are zero.

### Overall decision

Retain all currently frozen global coverage and provenance gates. If the treatment works but inherited global gates remain incomplete, emit REASSESS rather than weakening thresholds.

Decision strings:

- `GO_4V_PARAMETER_LOCAL_SEMANTICS_ERROR_AWARE_SCHEMA_ROLE_WITNESS`
- `REASSESS_4V_PARAMETER_LOCAL_SEMANTICS_ERROR_AWARE_SCHEMA_ROLE_WITNESS`

The live benchmark remains manual-only through `Run MISSING Experiment 4V` after merge to `main`.
