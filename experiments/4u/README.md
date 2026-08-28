# Experiment 4U — Spec-Qualified Lazy OpenAPI Compiler + Universal Frozen Request Proof

## Preregistration

This file is the first experiment-specific commit for 4U. Implementation changes must follow it.

### Frozen baseline

- Base SHA: `9c287721af10e86d86e588a405ac52eb7811cc9d`
- Previous experiment: 4T
- Previous workflow run: `33213383992`
- Previous artifact: `9702845878`
- Previous artifact digest: `sha256:cdd05e5b15c209c0d7209ab2f2e574a68d7b1b6e86250b5631172ca1c4366786`
- Previous report fingerprint: `688dd1f734052d2c8586f1b0c30bc59c16c378e9dbd7ff8830cbc05dc56f7f60`
- Previous decision: `REASSESS_4T_NATIVE_MACHINE_READABLE_OPERATION_COMPILER_FROZEN_REQUEST_PROOF`
- Frozen workload: existing 24 cases / 8 families
- Model: `gpt-4.1-mini-2025-04-14`

### 4T baseline

- successful manufactures: 6
- families with success: 5
- distinct providers: 6
- persisted recipes: 6
- replay successes: 6
- replay rate: 1.0
- nativeContractsParsed4t: 42
- nativeContractsJsonParsed4t: 33
- nativeContractsYamlParsed4t: 9
- nativeLocalRefsResolved4t: 22
- nativeLocalRefsRejected4t: 19
- nativeExternalRefsRejected4t: 1
- nativeOperationsDiscovered4t: 3
- nativeOperationsEligible4t: 0
- nativeOperationsRejectedAuth4t: 3
- nativeOperationHypotheses4t: 0
- nativeOperationProbeCalls4t: 0
- nativeOperationProbeStructured2xx4t: 0
- nativeOperationConfirmedRecipes4t: 0
- nativeOperationReplaySuccesses4t: 0
- frozenRequestProofs4t: 0
- frozenRequestProofValidationSuccesses4t: 0
- validatorGraphMismatchRejects: 1

### Scientific interpretation

4T did not falsify the native OpenAPI hypothesis because the treatment failed to activate. The implementation counted generic JSON parse success as a contract, used an incomplete custom YAML parser, eagerly resolved the entire specification before operation extraction, and only froze native selections.

### Primary hypothesis

If explicitly linked same-provider OpenAPI/Swagger documents are strictly qualified as API specifications, parsed with standards-compliant JSON/YAML parsing, and GET operations are extracted before unrelated schemas are resolved, MISSING will create at least one executable native request hypothesis that 4T failed to create. A local reference failure unrelated to the selected operation must not invalidate the entire specification.

### Treatment A — strict machine spec qualification

A document counts as a qualified API specification only when the parsed root is an object, `paths` is a non-array object, and either `openapi` is a supported 3.x string or `swagger` is exactly `2.0`.

### Treatment B — standards-compliant YAML parsing

Use the maintained `yaml` npm package. JSON remains `JSON.parse`. No custom YAML execution, no network tag resolution, no provider-specific parsing rules.

### Treatment C — lazy request-relevant local ref resolution

Extract candidate GET operations before resolving unrelated schemas. Resolve only path-item, parameter and parameter-schema refs required to compile the request. External refs are never fetched. Missing/circular/unrelated response-schema refs must not invalidate an otherwise executable request operation.

### Treatment D — native operation IR

Preserve immutable operation metadata: spec fingerprint, contract URL, operation pointer, method, origin, path, operationId, summary, description, security requirement, parameters, documented response content types and response schema fingerprint when available.

### Treatment E — provider-blind input binding

Retain deterministic lexical binding and the sole-input/sole-required-generic-slot rule. Allowed deterministic literals remain const, explicit default or a single-value enum. No examples as executable constants. No provider names, endpoint seeds, case IDs or benchmark answers.

### Treatment F — one extra native probe only

Run inherited 4S behavior first. Only when it does not compile and an eligible native operation exists, permit at most one additional native-operation probe for that provider.

### Treatment G — universal frozen selected-request proof

Every COMPILE result, inherited or native, must persist a canonical frozen snapshot of the actual executed P1RequestHypothesis. Validation must compare the frozen snapshot to the successful probe hypothesis and must not accept a request merely because an ID matches. A verified frozen executed request does not need to be rediscovered in a rebuilt graph, while all existing method/origin/path/binding/auth/fingerprint/projection guards remain active.

### Required metrics

Retain inherited metrics and add at least:

- machineDocumentFetches4u
- machineJsonParseSuccesses4u
- machineYamlParseSuccesses4u
- machineNonSpecJsonRejected4u
- machineNonSpecYamlRejected4u
- qualifiedOpenApi3Documents4u
- qualifiedSwagger2Documents4u
- operationLocalRefsResolved4u
- operationLocalRefsRejected4u
- operationExternalRefsRejected4u
- operationRefCyclesRejected4u
- unrelatedRefFailuresIsolated4u
- nativeOperationsDiscovered4u
- nativeOperationsEligible4u
- nativeOperationHypotheses4u
- nativeOperationProbeCalls4u
- nativeOperationProbeStructured2xx4u
- nativeOperationResponseGroundings4u
- nativeOperationConfirmedRecipes4u
- nativeOperationReplaySuccesses4u
- frozenRequestProofs4u
- frozenRequestProofValidationSuccesses4u
- frozenRequestProofMutationRejects4u
- frozenInheritedRequestProofs4u
- frozenNativeRequestProofs4u

### Required gates

- qualified_machine_contract_present
- non_spec_json_not_counted_as_contract
- real_yaml_parser_active
- native_operation_discovered
- native_operation_hypothesis_created
- native_operation_probe_executed
- native_operation_structured_2xx
- native_operation_confirmed_recipe
- native_operation_replay_success
- unrelated_ref_failure_isolation_active
- external_refs_not_fetched
- auth_required_operations_not_probed
- native_request_mutations_zero
- universal_frozen_request_proof_active
- frozen_request_proof_mutation_control_active
- validator_graph_mismatch_zero

All inherited safety and replay gates remain mandatory.

### Primary treatment success

Require at least one native hypothesis, one native probe, one native structured 2xx, one confirmed native recipe, one successful native replay, zero auth probe regression, zero request mutation, universal frozen proof validation active, `validatorGraphMismatchRejects == 0`, no regression of existing recipes, and replay rate >= 0.95.

### Overall GO

Retain inherited global coverage gates including at least 8 successful manufactures, at least 4 families, the inherited distinct-provider requirement and all mandatory safety gates. If the treatment works but coverage remains below the inherited GO threshold, return REASSESS rather than lowering the benchmark.

Decision strings:

- `GO_4U_SPEC_QUALIFIED_LAZY_OPENAPI_COMPILER_UNIVERSAL_FROZEN_PROOF`
- `REASSESS_4U_SPEC_QUALIFIED_LAZY_OPENAPI_COMPILER_UNIVERSAL_FROZEN_PROOF`

The live benchmark must remain manual and may only be executed after merge through `Run MISSING Experiment 4U`.
