# Experiment 4S — Linked Machine-Readable Contract Ingestion + Semantic Output Grounding

## Status
Preregistered before treatment implementation.

## Frozen base
- Base experiment: 4R
- Base merge SHA: `24916e2a83428588f8dea779a8e34589814619ea`
- 4R benchmark decision: `REASSESS_4R_REPRESENTATION_AGNOSTIC_RESPONSE_IR_COMPOSITIONAL_PROJECTION`
- 4R report fingerprint: `4f9ea7d3d8a02756832bade147af5b07477be1b6331b61c0e2e23b93df0e56b3`
- 4R ledger fingerprint: `e4d9d8927f1e255794401ed1db5c137052cac6cc1f7a8d6c3411fdab2e069fc2`
- 4R ledger events: 5669
- 4R manufactures reported: 7/24
- 4R successful families: 5
- 4R replay: 100%
- 4R R4 recovery: 5/6
- 4R runtime: 1,108,815 ms
- 4R total LLM cost: $0.2300116
- 4R linked/expanded evidence recipes: 0
- 4R executed-trace confirmed recipes: 1
- 4R ROW_LOOKUP recipes: 1
- 4R non-JSON confirmed recipes: 1

The 24-case workload is burned/development data. 4S makes no fresh-holdout claim.

## Motivation
4R established a working path from executed request evidence through non-JSON structured decoding and compositional projection, including a confirmed NHTSA CSV recipe. It also exposed two remaining architecture gaps:

1. An output such as `category`, `make`, or `version` can still be bound to a merely non-empty but semantically unrelated field. This admitted an invalid meal recipe where an archive URL was treated as a meal category.
2. Provider documentation can explicitly link machine-readable API contracts such as OpenAPI/Swagger, but those linked contracts are not yet first-class evidence capable of producing operations and recipes. This leaves a gap for providers whose correct operation is documented structurally but not recovered from ordinary prose/reference expansion.

## Treatment A — Semantic Output Grounding
Every non-identity output binding must be grounded by evidence that the selected field or relational label denotes the requested semantic role.

Allowed mechanical evidence includes:
- exact normalized leaf/label match;
- lexical role compatibility after generic wrapper/prefix removal already supported by the compiler (for example `strCategory` -> `category`);
- schema/property description or documented response-field metadata explicitly naming the output role;
- exact relational label grounding such as `Variable = Make` for output `make`;
- an already-valid identity binding covered by the existing input/output identity rules.

A field that is merely non-empty is insufficient.

Required negative controls include at least:
- `category <- url` rejected;
- `category <- meal_name` rejected;
- `make <- vin` rejected;
- `version <- package_name` rejected;
- semantic grounding must be checked again in validation, not only during planning.

The treatment must remain provider-blind and case-blind. No provider-specific output aliases may be hard-coded.

## Treatment B — Explicitly Linked Machine-Readable Contract Ingestion
When a page already accepted as provider documentation contains an explicit link to a machine-readable API contract, 4S may fetch and ingest that linked artifact as first-class evidence.

Eligible contract forms:
- OpenAPI 3.x JSON/YAML;
- Swagger/OpenAPI 2.0 JSON/YAML.

Rules:
- The contract must be reached by an explicit hyperlink from accepted provider documentation or an already accepted same-provider reference page.
- Same-provider provenance must be preserved. Cross-provider contract links are rejected.
- The contract URL itself must not be guessed, searched externally, or mutated from another URL.
- Contract ingestion must not create provider- or case-specific seeds.
- Operations must come from the contract's documented HTTP method/path/parameters/server/base URL semantics.
- Required auth/security operations remain blocked by the existing safety rules.
- Input bindings require documented parameter/path/query roles compatible with the task input.
- Response fields/schemas may supply semantic output grounding evidence.
- A linked contract may produce a request hypothesis only if the operation is compatible with the case entity/action/output requirements.
- Live probing, double-live verification, replay, origin-drift controls, mutation controls, and caches remain unchanged.

## Explicitly out of scope
- Searching the public web for OpenAPI specifications.
- Guessing `/openapi.json`, `/swagger.json`, `.json`, `.xml`, or other alternate representations.
- Provider-specific URL rewrites.
- Relaxing semantic validators merely to increase success count.
- New case-specific providers/seeds.
- Reducing the workload, provider-attempt budget, documentation budget, probes, double-live verification, replay, controls, or reranker calls.
- Increasing rerank concurrency above 3.

## Runtime invariants
4P/4Q/4R reranking concurrency remains exactly 3. The experiment must preserve:
- 24 rerank cases prepared;
- 24 rerank cases completed;
- max observed rerank concurrency <= 3.

Runtime <=20 minutes remains a preferred diagnostic, not a substitute for scientific gates.

## New instrumentation
The report must include at least:
- semanticGroundingCandidates
- semanticGroundingAccepted
- semanticGroundingRejected
- semanticGroundingValidatorRejects
- ungroundedOutputSelections
- linkedContractLinksDiscovered
- linkedContractFetches
- linkedContractFetchSuccesses
- linkedContractParseSuccesses
- linkedContractRejectedCrossProvider
- linkedContractRejectedAuth
- linkedContractOperationsDiscovered
- linkedContractOperationHypotheses
- linkedContractProbeCalls
- linkedContractProbeStructured2xx
- linkedContractConfirmedRecipes
- linkedContractResponseGroundings

For each linked-contract recipe, evidence must preserve the documentation page, explicit contract link, contract artifact provenance, selected operation, parameter binding, response grounding, live verification, and replay evidence.

## Scientific gates
Formal GO requires all of the following:

1. Exact 24-case workload.
2. No case-specific provider seeds.
3. Mechanical frontier unchanged.
4. R4 recovery >= 5/6.
5. At least 8/24 successful manufactures.
6. At least 4 successful families.
7. Double-live verification for every persisted recipe.
8. Changed-input replay >= 95%.
9. Replay cognitive/documentation/probe deltas remain zero.
10. 42/42 controls active.
11. Event-derived safety gates remain clean.
12. Zero auth-like rendered requests.
13. Zero known-auth probe attempts.
14. Zero wrong-task probe attempts.
15. Zero entity-incompatible structural probes.
16. Zero placeholder-preservation failures.
17. Zero non-auth request mutations.
18. False character->books control remains absent.
19. At least one confirmed executed-trace recipe.
20. At least one confirmed documented-role trace recipe.
21. At least one confirmed ROW_LOOKUP recipe.
22. Zero numeric-index ROW_LOOKUP recipes.
23. Zero forbidden input-source selections.
24. 24/24 rerank cases prepared and completed; max concurrency <=3.
25. At least one successful non-JSON structured decode and one confirmed non-JSON recipe.
26. Compositional locked bindings active; locked-binding mutations = 0.
27. At least one exact relational-label selection.
28. Documentation-route network probes = 0.
29. Confirmed trace origin drift = 0.
30. Confirmed trace non-slot/request mutation = 0.
31. Duplicate probe/acquisition/spec network fetches = 0.
32. Documentation-origin fallback = 0.
33. Standalone URL promotions = 0.
34. Validator graph mismatch = 0.
35. At least one relative-operation/API-base recipe.
36. At least one expanded-reference or explicitly linked machine-readable-contract recipe.
37. `ungroundedOutputSelections = 0`.
38. `semanticGroundingValidatorRejects >= 1` on the burned workload or causal controls, proving the validator path is active.
39. `linkedContractLinksDiscovered >= 1`.
40. `linkedContractParseSuccesses >= 1`.
41. `linkedContractOperationHypotheses >= 1`.
42. `linkedContractConfirmedRecipes >= 1`.
43. At least one linked-contract confirmed recipe must survive changed-input replay.
44. Preferred total LLM cost <= $0.50.

Runtime <=20 minutes and <=18 minutes are diagnostic targets only.

## Decision rule
- `GO_4S_LINKED_MACHINE_READABLE_CONTRACTS_SEMANTIC_OUTPUT_GROUNDING` only if every scientific gate above passes.
- Otherwise `REASSESS_4S_LINKED_MACHINE_READABLE_CONTRACTS_SEMANTIC_OUTPUT_GROUNDING`.

If linked contracts are discovered and parsed but do not yield operation hypotheses, the next bottleneck is operation/entity/parameter correspondence. If operation hypotheses probe successfully but do not become recipes, the next bottleneck is response grounding/projection. If semantic grounding removes false positives but total valid coverage remains below 8, do not weaken grounding; diagnose the remaining acquisition/contract-selection failures instead.
