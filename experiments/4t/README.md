# Experiment 4T — Native Machine-Readable Operation Compiler + Frozen Request Proof

## Preregistration

This file is the first experiment-specific commit for 4T. Implementation changes must follow it.

### Frozen baseline

- Base SHA: `6f1174556494f529594799a75fc43f32d82ffa52`
- Previous experiment: 4S
- Previous workflow run: `33209268286`
- Previous artifact: `9701443020`
- Previous report fingerprint: `5d333d3dff95e333ab4e0082525210128a7fd0c43b42dc39bb0585e8e9627ecf`
- Previous decision: `REASSESS_4S_LINKED_MACHINE_READABLE_CONTRACTS_SEMANTIC_OUTPUT_GROUNDING`
- Frozen workload: the existing 24-case / 8-family 4A workload
- Model: `gpt-4.1-mini-2025-04-14`
- Pricing: inherited unchanged from 4A/4S

### 4S baseline metrics

- successful manufactures: 6
- families with success: 5
- distinct providers: 6
- persisted recipes: 6
- replay successes: 6
- replay rate: 1.0
- linked contract links discovered: 163
- linked contract fetches: 113
- linked contract fetch successes: 103
- linked contract parse successes: 21
- linked contract operations discovered: 80
- linked contract operation hypotheses: 7
- linked contract probe calls: 5
- linked contract structured 2xx: 0
- linked contract confirmed recipes: 0
- linked contract replay successes: 0
- validator graph mismatch rejects: 1

### Primary hypothesis

If an explicitly linked same-provider OpenAPI/Swagger contract is preserved as a native machine-readable operation graph, local references are deterministically resolved, compatible anonymous GET operations are compiled directly into request hypotheses, and the selected request is frozen as an immutable proof snapshot, MISSING can produce at least one structured 2xx response and at least one confirmed replayable recipe from this evidence class without weakening safety or semantic-grounding invariants.

### Treatment A — native OpenAPI operation IR

- Parse OpenAPI 3.x JSON/YAML and Swagger 2 structurally.
- Preserve servers/host/basePath, operation pointers, parameters and response schema evidence.
- Resolve local `$ref` only, with recursion bounds and cycle detection.
- Reject external refs.
- Do not round-trip executable operations through prose before request construction.

### Treatment B — direct operation compiler

- Compile eligible anonymous GET operations directly into P1 request hypotheses.
- Preserve exact origin, path, parameter locations, evidence lineage and spec fingerprint.
- Allow only deterministic provider-blind input binding.
- Required literals may only come from `const`, explicit `default`, or a single-value enum.
- No credentials, guessed paths, guessed hosts, case-specific mappings or provider-specific mappings.

### Treatment C — response-schema semantic evidence

Documented response schema may rank operation plausibility but may not fabricate output values. Runtime projection remains grounded exclusively in the observed live response using 4S semantic grounding.

### Treatment D — frozen selected-request proof

Persist a canonical immutable snapshot of the selected executed hypothesis. Validation must verify its fingerprint, origin, path, slots, bindings, literals and evidence lineage directly rather than requiring a rebuilt graph to independently rediscover it.

### Added probe budget

Run the inherited 4S lane first. Only when it yields no successful usable probe and at least one eligible native operation exists, permit at most **one additional native-operation probe per provider**. No other probe budget is increased.

### Required metrics

At minimum record:

- nativeContractsParsed4t
- nativeContractsJsonParsed4t
- nativeContractsYamlParsed4t
- nativeLocalRefsResolved4t
- nativeLocalRefsRejected4t
- nativeExternalRefsRejected4t
- nativeOperationsDiscovered4t
- nativeOperationsEligible4t
- nativeOperationsRejectedAuth4t
- nativeOperationsRejectedUnsupportedRequest4t
- nativeOperationsRejectedSemanticMismatch4t
- nativeOperationHypotheses4t
- nativeOperationUniqueInputBindings4t
- nativeOperationAmbiguousBindings4t
- nativeOperationProbeCalls4t
- nativeOperationProbeStructured2xx4t
- nativeOperationResponseGroundings4t
- nativeOperationConfirmedRecipes4t
- nativeOperationReplaySuccesses4t
- nativeOperationOriginMutationRejects4t
- nativeOperationPathMutationRejects4t
- frozenRequestProofs4t
- frozenRequestProofValidationSuccesses4t
- frozenRequestProofMutationRejects4t

### Required gates

All inherited safety gates remain mandatory. Add:

- native_contract_parse_success
- native_operation_hypothesis_created
- native_operation_probe_executed
- native_operation_structured_2xx
- native_operation_confirmed_recipe
- native_operation_replay_success
- native_operation_request_mutations_zero
- native_external_refs_rejected
- native_auth_required_operations_not_probed
- frozen_request_proof_active
- frozen_request_proof_mutation_control_active
- validator_graph_mismatch_zero

### Decision rule

Primary treatment success requires at least one recipe confirmed through the native OpenAPI lane, at least one successful replay of such a recipe, zero auth/safety regression, zero endpoint mutation, zero validator graph mismatch, no regression of existing 4S recipes, and replay rate >= 0.95.

Overall GO additionally retains the inherited coverage objective: at least 8 successful manufactures and required inherited provider/family gates. If the treatment works but total coverage remains below the GO threshold, emit REASSESS rather than weakening the benchmark.

Decision strings:

- `GO_4T_NATIVE_MACHINE_READABLE_OPERATION_COMPILER_FROZEN_REQUEST_PROOF`
- `REASSESS_4T_NATIVE_MACHINE_READABLE_OPERATION_COMPILER_FROZEN_REQUEST_PROOF`

The live 4T benchmark must remain manual and may only be executed after merge through `Run MISSING Experiment 4T`.
