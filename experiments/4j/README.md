# Experiment 4J — Role-Complete Structural Binding

## Status
Preregistered engineering-recovery experiment over the already-burned 4A workload. No fresh blind holdout is consumed.

This README MUST be the first commit on the 4J branch.

## Frozen base
- 4I merge SHA: `008af94c9f6fb6e8f63b8c40616ede0bbcbc3988`
- workflow: `Run MISSING Experiment 4I`
- run: `33136581025`
- job: `98737795553`
- artifact: `9672845149`
- artifact digest: `sha256:e31090849de2cb87af7e2309ebc63a8ba127ed4a7378a3340f89493dfe3a9b06`
- report fingerprint: `333a84fa2a16fa595b4ce58d27f49dde0974a224a89fa9cbf1df7a7b1b56e630`
- ledger fingerprint: `53bf234905cd143057b00efd83689cfa5aaf0988b9cc76e2f5618c2e63cbb2d0`
- ledger events: `4203`
- decision: `REASSESS_4I_STRUCTURAL_IDENTIFIER_ROLE_INFERENCE`
- model: `gpt-4.1-mini-2025-04-14`

## Frozen 4I outcome
- 24 cases / 8 families
- 7 formal manufactures / 4 families / 7 providers / 7 recipes
- replay 7/7 = 100%
- R4 recovery 4/6: npm, CocktailDB, Genderize, Met
- OFF and NHTSA not recovered
- total LLM cost `$0.2303052`
- mean LLM cost/success `$0.03290074285714285`
- 130 synthesis attempts
- 32 no-operation + 86 alignment-unusable = `90.7692%` pre-probe semantic failure
- placeholder preservation 66/66, failures 0
- non-auth request mutations 0
- auth-like rendered requests 1, network auth probes 0
- controls 42/42; all event-derived safety counters zero

## Frozen forensic findings
1. 4I fixed the 4H placeholder encoding regression and restored npm + Met.
2. 4I structural role acceptance was incomplete relative to its preregistration:
   - accepted by unique build value: 59
   - accepted by documented placeholder: 0
   - accepted by query-key role: 0
   - accepted by path-segment role: 0
   - no implemented echo-relation class
3. OFF still exposed operations but rejected all identifier bindings. Public documentation represents the task input as a path parameter named generically (`code`) whose description identifies it as the product barcode. 4I did not use parameter-description semantics to bridge task input to a generic placeholder.
4. NHTSA still exposed operations but rejected identifier bindings. Public documentation contains code-expression examples where the request URL is built by concatenating a URL literal with a VIN variable. 4I did not reconstruct code-concatenation request roles.
5. Formal `wrongTaskProbeAttempts` stayed zero, but manual recipe inspection found a semantic false positive: `fictional_character_metadata` compiled an `.../api/books/{structural_character}` endpoint. Structural substitution therefore requires a target-entity compatibility guard before probing.
6. One auth-like rendered candidate was blocked before network for `chemical_element_metadata`; 4J must independently reclassify final query slot names rather than trust upstream `auth_like` annotations only.

## 4J hypothesis
The remaining ceiling is not evidence acquisition. It is incomplete structural-role compilation plus insufficient target-entity discrimination.

4J retains 4G/4H/4I acquisition, Documentation IR, reference expansion, operation normalization, surgical auth pruning, probing, observed mapping, double-live verify, persistence, and zero-cognition replay.

4J changes only:
1. complete provider-blind structural-role evidence classes,
2. structural target-entity compatibility,
3. independent final auth-slot reclassification.

## Allowed structural-role evidence
For each task input, influence may be proven only from local documented evidence:

### A. Parsed parameter
Existing exact/morphological parsed parameter evidence.

### B. Placeholder syntax
Recognize provider-blind variable markers in documented request targets:
- `{name}`
- `<name>`
- `[name]`
- `:name` path segment

A generic marker such as `code`, `id`, `key`, `value`, `name` may bind only if:
- its local parameter/section description lexically supports the task input/entity, and
- structural target-entity compatibility passes.

### C. Query-key role
A documented query key may bind when its name/description mechanically corresponds to the input. Generic keys require the same two safeguards above.

### D. Path-segment role
A variable-looking path segment may bind when its label or local description supports the task input and target-entity guard passes.

### E. Unique concrete build value
Retain 4I exact single-occurrence substitution, but require target-entity compatibility. Host/scheme and ambiguous occurrences reject.

### F. Code-expression concatenation
Recover GET request templates from local code expressions only when the evidence explicitly concatenates:
- an HTTPS URL/path literal,
- one task-corresponding variable,
- optional literal suffix/query text.

Examples of allowed generic expression forms include string concatenation, interpolation, and functions that concatenate literal + variable + literal. No provider-specific function/name table may be added.

The variable name must mechanically correspond to the task input by exact token, morphology, or generic suffix/prefix (`input`, `in`, `value`, `query`, `param`).

## Target-entity compatibility guard
Applied to every *structural fallback* before hypothesis rendering.

- Build a task target frame from frozen case intent + input names + required outputs.
- Build an operation target frame from operation title + section title + request path only; response-body vocabulary must not satisfy this gate.
- Require at least one discriminative target token overlap, after simple mechanical normalization/singularization.
- Exact input/query-key correspondence may satisfy identifier influence but does not waive target compatibility for structural fallbacks.
- Generic tokens (`id`, `name`, `code`, `value`, `key`, `identifier`) do not count as target-entity evidence.

Expected effect: a character task cannot structurally bind to a `/books/...` operation merely because the response contains `id`, `name`, or character links.

Required metrics:
- `structuralTargetChecks`
- `structuralTargetAccepted`
- `structuralTargetRejected`
- `roleAcceptedParsedParameter`
- `roleAcceptedPlaceholder`
- `roleAcceptedGenericPlaceholderByDescription`
- `roleAcceptedQueryKey`
- `roleAcceptedPathSegment`
- `roleAcceptedUniqueBuildValue`
- `roleAcceptedCodeConcat`
- `roleRejectedAmbiguous`
- `roleRejectedTargetMismatch`
- `roleRejectedNoDescriptionSupport`
- `roleRejectedAuthLike`

## Independent final auth gate
Before a hypothesis can enter the probe packet:
- independently test embedded query keys and slot names against the auth-name classifier,
- do not trust only upstream `auth_like`,
- optional/rate-limit auth-like material is removed surgically,
- required auth rejects,
- rendered auth-like candidates are rejected before network and do not count as acceptable hypotheses.

Required metrics:
- `finalAuthSlotReclassifications`
- `finalAuthCandidatesRejected`
- `authLikeRenderedRequests = 0`
- `knownAuthProbeAttempts = 0`

## Same-graph invariant
Planner and validator must reconstruct the identical 4J graph from the same evidence.

Successful contract reason prefix:
`4J_ROLE_COMPLETE_STRUCTURAL_BINDING:<hypothesis_id>`

All 4I/4H/older prefixes reject.

## Mandatory causal tests before benchmark
Tests must contain meaningful positive and negative assertions; vacuous `>= 0` assertions are forbidden.

1. npm placeholder remains literal and compiles to the build package.
2. Met object placeholder remains literal and compiles to build object id.
3. generic `{code}` plus local description saying it is a barcode binds to a barcode task under product target context.
4. the same generic `{code}` without barcode/input description support rejects.
5. VIN code-concatenation expression reconstructs a GET target with a variable VIN role.
6. repeated concrete build value rejects as ambiguous.
7. concrete build value in host/scheme rejects.
8. fictional-character task rejects a `/books/{id}` structural operation.
9. fictional-character task accepts a `/characters/{id}` structural operation when other evidence is valid.
10. optional auth query removal preserves all non-auth request text.
11. independently detected auth-like slot rejects even if upstream `auth_like=false`.
12. required auth rejects before render.
13. same 4J graph validates; 4I/older prefix rejects.
14. source scan confirms no provider/domain/endpoint seed literals were introduced.
15. derivation emits exact 4I merge base and 4J decision strings.

## GO gates
4J is GO only if ALL required gates pass:
- recover >=5 of 6 R4 capabilities
- >=8 successful manufactures total
- >=4 families with success
- changed-input replay >=95%
- replay cognition/docs/synthesis/schema-probe deltas all zero
- zero numeric-index decisions
- zero documentation-origin fallbacks
- zero standalone navigation URL promotions
- zero validator graph mismatch rejects
- zero duplicate rendered probe URLs actually executed per provider/case
- `authLikeRenderedRequests = 0`
- `knownAuthProbeAttempts = 0`
- `wrongTaskProbeAttempts = 0`
- `placeholderPreservationFailures = 0`
- `nonAuthRequestTextMutations = 0`
- `structuralTargetRejected > 0` to prove the guard actually fired
- no successful recipe may have an operation target noun incompatible with its task target frame
- controls 42/42 and event-derived safety clean
- retain >=1 relative-operation/API-base confirmed recipe
- retain >=1 successful recipe from actually reference-expanded evidence
- aggregate diagnostics equal per-attempt recomputation

Preferred economics:
- total LLM cost <= `$0.60`
- mean LLM cost/success <= `$0.15`

Diagnostic target:
- R4 >=5/6
- recover at least one of OFF/NHTSA
- structural false-positive count zero
- semantic pre-probe failure rate <70%

If R4 remains <5/6, do NOT auto-create 4JR/4JR2. Attribute the remaining ceiling first.

## Formal decision
- `GO_4J_ROLE_COMPLETE_STRUCTURAL_BINDING`
- otherwise `REASSESS_4J_ROLE_COMPLETE_STRUCTURAL_BINDING`
