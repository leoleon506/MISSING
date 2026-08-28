# Experiment 4I — Structural Identifier Role Inference

## Status
Preregistered engineering-recovery experiment over the already-burned 4A workload. No fresh blind holdout is consumed.

This README MUST be the first commit on the 4I branch.

## Frozen base
- 4H merge SHA: `28c83671b4aa38bd87bf6ddefd540e1b5d6035c1`
- 4H workflow: `Run MISSING Experiment 4H`
- workflow run: `33133232140`
- job: `98727269602`
- event: `workflow_dispatch`
- artifact: `9671702517`
- artifact digest: `sha256:43872f8b6ce40f07ecf875cc66d736f1473b77d4abca724d26cbc5a9291ec745`
- decision: `REASSESS_4H_TASK_OPERATION_SEMANTIC_ALIGNMENT`
- report fingerprint: `23d53a0ea7cd2f8b41d48f1cbf17d7f863a0b03a638f8ed0dc265fc3da46fe5d`
- ledger fingerprint: `5e1d6fe2fe34a7ac8007856de770b1bb8283464116337720d986b9bc8c28c71d`
- ledger events: `4846`
- fixed model: `gpt-4.1-mini-2025-04-14`

## Frozen 4H outcome
- 24 cases / 8 families
- 4 successful manufactures / 2 families / 4 providers / 4 recipes
- replay 4/4 = 100%
- R4 capability recovery: 2/6 (`cocktail_name_metadata`, `gender_estimate_by_name`)
- 152 synthesis attempts
- 35 no-operation attempts
- 109 alignment-unusable attempts
- semantic pre-probe failure rate: `(35 + 109) / 152 = 94.7368%`
- `authLikeRenderedRequests = 0`
- `knownAuthProbeAttempts = 0`
- `wrongTaskProbeAttempts = 0`
- controls 42/42
- total LLM cost `$0.22701`
- mean LLM cost/success `$0.05675`

## Frozen forensic interpretation
4H validated the early anonymous-auth pruning model but regressed two previously working capabilities and failed to establish structural identifier influence for Open Food Facts and NHTSA.

1. **Placeholder preservation defect.** 4H auth pruning reparsed request paths through `URL`, encoding documented placeholders such as `{package}` and `{objectID}` into `%7Bpackage%7D` / `%7BobjectID%7D`. This caused otherwise valid npm and Met requests to execute literal encoded placeholders.
2. **Identifier-role evidence is too narrow.** 4H requires an `IrParameter` correspondence for every task input. For OFF and NHTSA, normalized operations exist but identifier signal remains zero because the evidence can live directly in a documented path/query/example rather than a parsed parameter object.
3. **4H auth behavior should be retained.** Optional auth material was pruned before render, required auth was blocked, and no auth-like request reached network.
4. **Reference expansion remains causally useful.** Successful expanded-evidence recipes remain part of the retained architecture.

## 4I hypothesis
Keep 4G evidence acquisition / Documentation IR / reference expansion / operation normalization and keep 4H multi-signal semantic support and auth classification. Change only identifier-role proof and the implementation of auth removal.

```text
4G Operation4G
   ↓
4H semantic support frame
   ↓
STRUCTURAL IDENTIFIER ROLE EVIDENCE
   ├── named parameter
   ├── documented placeholder
   ├── unique concrete build-value occurrence
   ├── query-key role
   ├── path-segment role
   └── documented request/response echo relation
   ↓
PRESERVING AUTH PRUNER
   ↓
unchanged safe probe → validator → double live → replay
```

## Request preservation invariant
Auth pruning MUST be surgical and representation-preserving:
- remove only auth-like query material that is optional/unbound
- preserve path text byte-for-byte except for the removed auth query pair and its separator
- never run placeholder-bearing paths through a serializer that percent-encodes `{}`
- `{name}`, `{package}`, `{objectID}` etc. must remain literal placeholders until the normal request compiler substitutes them

Required metrics:
- `placeholderBearingOperations`
- `placeholderPreservationChecks`
- `placeholderPreservationFailures`
- `authPairsPrunedSurgically`
- `nonAuthRequestTextMutations = 0`

## Structural identifier-role evidence
For every task input, 4I may establish request influence using only evidence already present in the operation/document scope.

Allowed evidence classes:
1. `NAMED_PARAMETER`: existing parsed parameter exact/morphological correspondence.
2. `DOCUMENTED_PLACEHOLDER`: placeholder token in path/query whose label corresponds mechanically to the input.
3. `UNIQUE_BUILD_VALUE`: the frozen build input value occurs exactly once in the documented request target and the position can be replaced without changing surrounding literal structure.
4. `QUERY_KEY_ROLE`: documented query key mechanically corresponds to the input or is a generic identifier with sufficient contextual support.
5. `PATH_SEGMENT_ROLE`: documented variable/example segment is the unique input-varying segment under sufficient semantic support.
6. `ECHO_RELATION`: documented or probed response evidence explicitly relates the request value to an observed field; may support role classification but may not invent a request position.

No provider/domain/endpoint/vertical seed tables are permitted.

### Generic identifiers
Generic labels (`id`, `name`, `code`, `value`, `key`, `identifier`) remain dangerous.
- generic role evidence requires at least two independent non-identifier semantic supports from entity/action/output evidence
- a unique build-value occurrence may establish the varying position, but still requires semantic support
- `one input + one slot => bind` remains forbidden

### Concrete-value substitution
For `UNIQUE_BUILD_VALUE`:
- exact literal build value must occur once in the documented request target
- the substituted target must preserve every other byte
- the occurrence may be path or query value, never host/scheme
- it must not be auth-like
- no transformation of the build value is allowed

Required metrics:
- `identifierRoleCandidates`
- `identifierRoleAcceptedNamedParameter`
- `identifierRoleAcceptedPlaceholder`
- `identifierRoleAcceptedUniqueBuildValue`
- `identifierRoleAcceptedQueryKey`
- `identifierRoleAcceptedPathSegment`
- `identifierRoleRejectedAmbiguousOccurrence`
- `identifierRoleRejectedNoSemanticSupport`
- `identifierRoleRejectedGeneric`
- `identifierRoleRejectedAuthLike`

## Same-graph invariant
Planner and validator must reconstruct the identical 4I identifier-role graph from the same evidence.

Successful contracts use:
`4I_STRUCTURAL_IDENTIFIER_ROLE:<hypothesis_id>`

All older prefixes reject.

## Causal tests required before benchmark
1. npm `{package}` remains unencoded and compiles to the build package value.
2. Met `{objectID}` remains unencoded and compiles to the build object id.
3. Optional auth query removal preserves every non-auth character of a placeholder-bearing target.
4. Required auth still rejects before render.
5. NHTSA-style documented concrete VIN in one path segment can establish input influence with vehicle/decode semantic support even if no `IrParameter` exists.
6. OFF-style product lookup can establish identifier role from a documented barcode/code position only when sufficient product/entity context exists.
7. Same concrete value appearing twice is ambiguous and rejects.
8. Unique concrete value in host/scheme rejects.
9. Generic `{id}` with unrelated semantics rejects.
10. No provider/domain/endpoint literals or synonym tables are introduced.
11. Expanded evidence provenance survives into a successful recipe candidate.
12. Same 4I graph validates; 4H and older prefixes reject.

## Engineering recovery gate
4I is GO only if ALL required gates pass:
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
- `placeholderPreservationFailures = 0`
- `nonAuthRequestTextMutations = 0`
- controls 42/42 and event-derived safety clean
- retain >=1 confirmed relative-operation/API-base recipe
- retain >=1 successful recipe from actually reference-expanded evidence
- aggregate diagnostics equal per-attempt recomputation

Preferred economics:
- total LLM cost <= `$0.60`
- mean LLM cost/success <= `$0.15`

## Diagnostic targets
- restore both npm and Met relative to 4H
- recover at least one of OFF or NHTSA
- therefore reach R4 >=5/6
- semantic pre-probe failure rate <70%
- retain all 4H auth safety properties

If 4I recovers <5/6 R4 capabilities, do NOT automatically create 4IR/4IR2. Attribute the remaining ceiling first.

## Formal benchmark decision
- `GO_4I_STRUCTURAL_IDENTIFIER_ROLE_INFERENCE`
- otherwise `REASSESS_4I_STRUCTURAL_IDENTIFIER_ROLE_INFERENCE`
