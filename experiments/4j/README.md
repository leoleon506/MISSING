# Experiment 4J — Entity-Gated Documented Identifier Roles

## Status
Preregistered engineering-recovery experiment over the already-burned 4A workload. No fresh blind holdout is consumed.

This README MUST be the first commit on the 4J branch.

## Frozen base
- 4I merge SHA: `008af94c9f6fb6e8f63b8c40616ede0bbcbc3988`
- 4I workflow: `Run MISSING Experiment 4I`
- workflow run: `33136581025`
- job: `98737795553`
- event: `workflow_dispatch`
- artifact: `9672845149`
- artifact digest: `sha256:e31090849de2cb87af7e2309ebc63a8ba127ed4a7378a3340f89493dfe3a9b06`
- decision: `REASSESS_4I_STRUCTURAL_IDENTIFIER_ROLE_INFERENCE`
- report fingerprint: `333a84fa2a16fa595b4ce58d27f49dde0974a224a89fa9cbf1df7a7b1b56e630`
- ledger fingerprint: `53bf234905cd143057b00efd83689cfa5aaf0988b9cc76e2f5618c2e63cbb2d0`
- ledger events: `4203`
- fixed model: `gpt-4.1-mini-2025-04-14`

## Frozen 4I outcome
- 24 cases / 8 families
- 7 successful manufactures / 4 families / 7 providers / 7 recipes
- replay 7/7 = 100%
- R4 capability recovery: 4/6 (`npm_package_metadata`, `cocktail_name_metadata`, `gender_estimate_by_name`, `artwork_object_metadata`)
- 130 synthesis attempts
- 32 no-operation attempts
- 86 alignment-unusable attempts
- semantic pre-probe failure rate: `(32 + 86) / 130 = 90.7692%`
- `authLikeRenderedRequests = 1`
- `knownAuthProbeAttempts = 0`
- `wrongTaskProbeAttempts = 0` (known incomplete metric; see forensic finding below)
- placeholder preservation failures: 0
- non-auth request text mutations: 0
- controls 42/42
- total LLM cost `$0.2303052`
- mean LLM cost/success `$0.03290074285714285`

## Frozen 4I successful recipes
1. npm Registry — `/ {package}` equivalent path `/{package}`
2. TheMealDB
3. TheCocktailDB
4. Agify.io
5. Genderize.io
6. Metropolitan Museum — `/public/collection/v1/objects/{objectID}`
7. An API of Ice And Fire — **incorrect semantic match**: `/api/books/{structural_character}` for `fictional_character_metadata`

The seventh item returned valid JSON and passed mechanical mapping, but the operation entity is a **book**, not a **character**. Therefore `wrongTaskProbeAttempts = 0` did not adequately measure task-operation entity compatibility.

## Frozen forensic attribution
### What 4I proved
- The placeholder-encoding regression from 4H is recoverable: npm and Met returned to success.
- Surgical auth removal preserved placeholders (`placeholderPreservationFailures = 0`) and non-auth request text (`nonAuthRequestTextMutations = 0`).
- Structural evidence can produce live/replay-safe contracts when it is semantically compatible.

### What 4I did not solve
1. **OFF and NHTSA still produced zero hypotheses.** Their operations existed, but structural inference reported no usable identifier evidence:
   - OFF: structural candidates present, `identifierRoleAcceptedUniqueBuildValue = 0`, no hypotheses.
   - NHTSA: structural candidates present, `identifierRoleAcceptedUniqueBuildValue = 0`, no hypotheses.
   The frozen build literal was not present in the useful documented operation targets, so `UNIQUE_BUILD_VALUE` was the wrong primary proof for those providers.
2. **Documented placeholders were not promoted sufficiently.** Aggregate `identifierRoleAcceptedPlaceholder = 0`, even though providers can document request roles as `{VIN}`, `{code}`, `{id}`, etc. without producing a normalized `IrParameter`.
3. **Unique literal matching was too semantically permissive.** A literal matching the character build value appeared in a book operation and was promoted because the previous support function accepted generic token overlap such as output `name`. That produced `/api/books/{structural_character}`.
4. **Auth metric conflated invalid rendering with actual auth.** The 4I `renderedAuthLike()` helper returned `true` on compile/URL-parse failure, so `authLikeRenderedRequests = 1` is not proven to represent an actual credential-bearing rendered request. No auth-like request reached network (`knownAuthProbeAttempts = 0`, safety counters clean).

## 4J hypothesis
Keep 4I acquisition, Documentation IR, reference expansion, API-base linking, projection, double-live verification and replay. Replace only the final identifier-role acceptance policy and render classification.

```text
Operation4G
   ↓
DOCUMENTED IDENTIFIER ROLE
   ├── normalized named parameter
   ├── exact/morphological documented placeholder
   ├── generic documented placeholder + ENTITY gate + secondary support
   └── unique concrete path/query value + ENTITY gate + secondary support
   ↓
representation-preserving auth pruning
   ↓
render classification (compile-invalid != auth-like)
   ↓
safe probe → observed mapping → validator → double live → replay
```

## Entity gate
For structural evidence that does not already have an exact/morphological identifier label, **entity compatibility is mandatory**.

Task entity tokens come only from the frozen task intent/input/output vocabulary after removing generic action/metadata/noise tokens.
Operation entity tokens come only from operation title, local section heading, local context, path tokens and already-documented response vocabulary.

No provider/domain/endpoint/vertical seed tables or provider-specific synonyms are permitted.

### Acceptance classes
#### A. Named parameter
Retain the 4H/4I normalized named-parameter rule.

#### B. Exact/morphological documented placeholder
Examples: task `vin` ↔ `{VIN}`, task `object_id` ↔ `{objectID}`, task `package_name` ↔ `{package}`.
- mechanical stem correspondence required
- at least one semantic support category (entity/action/output) required
- must not be auth-like

#### C. Generic documented placeholder
Examples: `{code}`, `{id}`, `{name}` when task input has a different lexical label.
- placeholder must be documented in the operation target
- **entity compatibility required**
- at least one additional independent support category from action/output required
- one-input/one-slot alone remains forbidden

#### D. Unique concrete build-value role
- exact build literal must occur exactly once
- occurrence must be an entire path segment or entire query value
- never host/scheme/substrings
- **entity compatibility required**
- at least one additional independent action/output support required
- surrounding request bytes preserved
- no transformation of build literal

This rule must reject a fictional-character task binding to `/api/books/1` even if the build value is `1` and the response contains `name`.

## Render classification
Do not count compile/URL-parse failures as auth-like requests.

Required independent metrics:
- `renderCompileRejected`
- `renderUrlParseRejected`
- `authLikeRenderedRequests`
- `knownAuthProbeAttempts`

`authLikeRenderedRequests` increments only when a successfully compiled URL or request slot actually contains an auth-like key/name.

## Required 4J metrics
- `identifierRoleCandidates`
- `identifierRoleAcceptedNamedParameter`
- `identifierRoleAcceptedExactPlaceholder`
- `identifierRoleAcceptedGenericPlaceholder`
- `identifierRoleAcceptedUniqueBuildValue`
- `identifierRoleAcceptedQueryKey`
- `identifierRoleAcceptedPathSegment`
- `identifierRoleRejectedEntityMismatch`
- `identifierRoleRejectedSecondarySupport`
- `identifierRoleRejectedAmbiguousOccurrence`
- `identifierRoleRejectedAuthLike`
- `placeholderPreservationChecks`
- `placeholderPreservationFailures`
- `nonAuthRequestTextMutations`
- `renderCompileRejected`
- `renderUrlParseRejected`
- `authLikeRenderedRequests`

## Same-graph invariant
Planner and validator must reconstruct the identical 4J graph from the same evidence.

Successful contracts use:
`4J_ENTITY_GATED_IDENTIFIER_ROLE:<hypothesis_id>`

All 4I/4H/older prefixes reject.

## Causal tests required before benchmark
1. npm `{package}` remains literal until input substitution and compiles to package build value.
2. Met `{objectID}` remains literal and compiles to object id.
3. NHTSA-style `{VIN}` without `IrParameter` is accepted through exact/morph placeholder evidence.
4. OFF-style `{code}` for a food/product lookup is accepted only with entity compatibility plus action/output support.
5. Generic `{id}` under book semantics rejects for fictional-character task.
6. Concrete `/api/books/1` rejects for fictional-character task even when build `character_id = 1`.
7. Concrete VIN as a unique path segment is accepted only with vehicle entity + action/output support.
8. Repeated concrete identifier rejects as ambiguous.
9. Concrete identifier substring rejects.
10. Required auth rejects before render.
11. Optional auth pair is removed without altering placeholders/non-auth bytes.
12. Compile-invalid hypothesis increments `renderCompileRejected`, not `authLikeRenderedRequests`.
13. Actual auth-like rendered query increments `authLikeRenderedRequests` and never reaches probe packet.
14. Provider-blind source audit finds no provider/domain/endpoint seed literals.
15. Expanded evidence provenance remains eligible.
16. 4J graph validates; 4I and older provenance prefixes reject.

## Engineering recovery gate
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
- **zero entity-incompatible structural probes**
- false character→books recipe absent
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
- retain npm + Met
- recover at least one of OFF/NHTSA, targeting both
- R4 >=5/6
- eliminate fictional-character→books false semantic success
- semantic pre-probe failure rate <70%

If 4J recovers <5/6 R4 capabilities, do NOT automatically create 4JR/4JR2. Attribute the remaining ceiling first.

## Formal decision
- `GO_4J_ENTITY_GATED_DOCUMENTED_IDENTIFIER_ROLES`
- otherwise `REASSESS_4J_ENTITY_GATED_DOCUMENTED_IDENTIFIER_ROLES`
