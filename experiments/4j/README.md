# Experiment 4J — Shape-Aware Identifier Compatibility

## Status
Preregistered engineering-recovery experiment over the already-burned 4A workload. No fresh blind holdout is consumed.

This README MUST be the first commit on the 4J branch.

## Frozen base
- 4I merge SHA: `008af94c9f6fb6e8f63b8c40616ede0bbcbc3988`
- 4I workflow run: `33136581025`
- job: `98737795553`
- artifact: `9672845149`
- artifact digest: `sha256:e31090849de2cb87af7e2309ebc63a8ba127ed4a7378a3340f89493dfe3a9b06`
- report fingerprint: `333a84fa2a16fa595b4ce58d27f49dde0974a224a89fa9cbf1df7a7b1b56e630`
- ledger fingerprint: `53bf234905cd143057b00efd83689cfa5aaf0988b9cc76e2f5618c2e63cbb2d0`
- ledger events: `4203`
- model: `gpt-4.1-mini-2025-04-14`
- decision: `REASSESS_4I_STRUCTURAL_IDENTIFIER_ROLE_INFERENCE`

## Frozen 4I result
- 24 cases / 8 families
- 7 reported manufactures / 4 families / 7 providers / 7 recipes
- replay 7/7 = 100%
- R4 recovery = 4/6: npm, CocktailDB, Genderize, Metropolitan Museum
- OFF = no hypotheses
- NHTSA = no hypotheses
- semantic pre-probe failure rate = `(32 + 86) / 130 = 90.7692%`
- `authLikeRenderedRequests = 1` but `knownAuthProbeAttempts = 0`
- placeholder checks 66 / failures 0
- non-auth request mutations 0
- structural unique-build-value accepts 59
- total LLM cost `$0.2303052`; mean/success `$0.0329007429`
- controls 42/42; event-derived safety clean

## Frozen forensic findings
1. 4I repaired the 4H placeholder-encoding defect: npm compiled `/{package}` and Met compiled `/objects/{objectID}` correctly.
2. 4I did not recover OFF or NHTSA because exact frozen build values were not present in the normalized operation targets and no parsed identifier parameter survived.
3. `identifierRoleAcceptedPlaceholder = 0`; the new structural path was dominated by exact unique build-value occurrences.
4. A semantic false positive remains: `fictional_character_metadata` compiled against `https://anapioficeandfire.com/api/books/1`, producing `/api/books/{structural_character}`. A successful HTTP response is therefore insufficient evidence of task-operation compatibility.
5. `wrongTaskProbeAttempts = 0` failed to detect the books-vs-character mismatch and is not trusted as the sole wrong-task diagnostic.
6. One auth-like render was detected for `chemical_element_metadata`/AstroWay and blocked before network; network safety remained clean.

## 4J hypothesis
Retain 4I request preservation and auth safety. Modify only structural identifier-role inference and task-operation compatibility.

4J may infer a task input role from a documented placeholder/example whose VALUE SHAPE matches the frozen input even when the literal differs, provided operation identity is semantically compatible.

### Generic value shapes
Computed mechanically from strings, without provider/case tables:
- digits-only + length
- alpha-only + length + case profile
- alphanumeric + length + case profile
- hex-like + length
- UUID-like
- URL-like
- free text

No domain/provider/endpoint/vertical lookup table is allowed.

### Candidate sources
- parsed parameter
- literal documented placeholder
- documented query value example
- documented path-segment example
- exact unique build-value occurrence (retained from 4I)

### Shape acceptance
A non-exact example may establish influence only when:
- exactly one request slot/example in the operation has the same mechanical shape as the frozen build input, OR one placeholder has compatible identifier morphology;
- host/scheme are excluded;
- auth-like slots are excluded;
- every other request byte/slot remains grounded;
- the slot is variable-looking rather than a fixed protocol literal;
- semantic compatibility gate passes.

### Task-operation compatibility
Define two provider-blind frames.

Task entity frame:
- intent tokens
- non-generic tokens from input names after removing suffixes such as id/name/code/identifier
- required-output tokens, but output-only generic words do not establish entity identity

Operation identity frame:
- operation title
- local section title
- path segment labels
- query key labels
- placeholder labels

Do NOT use broad response-body/context vocabulary as primary entity identity because it can mention related entities.

For shape-based or generic-identifier bindings, require at least one non-generic task-entity token to overlap the operation identity frame. Exact identifier morphology may satisfy identifier evidence but still requires no explicit entity contradiction.

A generic output word such as `name` cannot by itself make an operation compatible.

Expected causal effect:
- OFF product/code/barcode example becomes eligible when product operation identity + numeric identifier shape agree.
- NHTSA VIN example becomes eligible when VIN/vehicle/decode identity + 17-char alphanumeric shape agree.
- Ice & Fire `/api/books/{id}` must reject for `fictional_character_metadata` because `book` identity does not support `character` identity.

## Auth hardening
Retain surgical 4I pruning. Additionally, any hypothesis that renders auth-like material is rejected before entering the probe packet and must be attributed to the exact operation/case. Required gate remains zero rendered auth-like requests, not merely zero network auth probes.

## Required diagnostics
- `shapeRoleCandidates`
- `shapeRoleUniqueCompatible`
- `shapeRoleRejectedAmbiguous`
- `shapeRoleRejectedFixedLiteral`
- `shapeRoleRejectedNoEntityCompatibility`
- `taskOperationCompatibilityAccepted`
- `taskOperationCompatibilityRejected`
- `taskEntityTokens`
- `operationIdentityTokens`
- `wrongEntityHypothesesRejected`
- `authLikeRenderedRequests`
- 4I placeholder preservation metrics retained

## Causal tests required
1. npm placeholder remains preserved and compiles.
2. Met placeholder remains preserved and compiles.
3. NHTSA-style example VIN different from build VIN is accepted from shape + VIN/decode identity.
4. OFF-style 13-digit example different from build barcode is accepted from shape + product identity.
5. same-shape candidates in two slots reject as ambiguous.
6. numeric protocol literals are not treated as identifier slots without variable evidence.
7. `/api/books/{id}` rejects for fictional-character task even when build value fits `{id}`.
8. character endpoint `{id}` with character identity may accept.
9. output-only `name` overlap cannot establish task-operation compatibility.
10. auth-like rendered hypothesis is excluded before probe and counted.
11. required auth remains blocked.
12. same planner/validator graph; older provenance prefixes reject.

## GO gates
ALL required:
- R4 recovery >=5/6
- >=8 valid manufactures after semantic compatibility audit
- >=4 families
- replay >=95%
- replay cognition/docs/synthesis/schema-probe deltas = 0
- controls 42/42; event-derived safety clean
- `authLikeRenderedRequests = 0`
- `knownAuthProbeAttempts = 0`
- `wrongTaskProbeAttempts = 0`
- no accepted recipe with task-operation entity mismatch
- `placeholderPreservationFailures = 0`
- `nonAuthRequestTextMutations = 0`
- validator graph mismatch = 0
- documentation-origin fallback = 0
- standalone URL promotions = 0
- duplicate rendered probe URLs actually executed = 0
- >=1 relative-operation/API-base recipe
- >=1 successful expanded-reference recipe
- semantic pre-probe failure rate <70%

Preferred economics:
- total LLM <= `$0.60`
- mean LLM/success <= `$0.15`

If R4 remains <5/6, do not create an automatic retry. Attribute the ceiling first.

## Formal decision
- `GO_4J_SHAPE_AWARE_IDENTIFIER_COMPATIBILITY`
- otherwise `REASSESS_4J_SHAPE_AWARE_IDENTIFIER_COMPATIBILITY`
