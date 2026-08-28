# Experiment 4J — Operation-Local Slot Anchoring

## Status
Preregistered engineering-recovery experiment over the already-burned 4A workload. No new blind holdout is consumed.

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
- R4 recovery 4/6: npm Registry, TheCocktailDB, Genderize, Metropolitan Museum
- OFF and NHTSA remain unrecovered
- 130 synthesis attempts
- 32 no-operation attempts
- 86 alignment-unusable attempts
- semantic pre-probe failure rate: `(32 + 86) / 130 = 90.7692%`
- 96 request hypotheses, 21 unique rendered probes, 11 successful JSON probes
- `placeholderPreservationFailures = 0`
- `nonAuthRequestTextMutations = 0`
- npm path restored as `/{package}`
- Met path restored as `/public/collection/v1/objects/{objectID}`
- `authLikeRenderedRequests = 1`, but `knownAuthProbeAttempts = 0`
- `wrongTaskProbeAttempts = 0` while one semantic false positive remains: `fictional_character_metadata` compiled `/api/books/{structural_character}` and returned a book, not a character
- controls 42/42
- total LLM cost `$0.2303052`
- mean LLM cost/success `$0.03290074285714285`

## Frozen forensic attribution
4I proved that byte-preserving auth pruning fixes the 4H placeholder regression. It also proved that exact build-value occurrence is too narrow as the structural role signal.

Evidence in the 4I run shows documented requests with **other concrete examples**, including:
- Open Food Facts: `/api/v2/product/737628064502.xml`
- NHTSA: `/api/vehicles/decodevin/5UXWX7C5*BA?format=json&modelyear=2011`

Neither contains the frozen build input. Therefore 4I cannot generalize the example segment into a task-input slot even though the surrounding operation-local evidence identifies its role.

A second failure is entity mismatch: `/api/books/1` was generalized into `character_id=1` because the concrete value matched, despite the nearest static endpoint anchor being `books`.

A third safety/instrumentation issue remains: one auth-like rendered hypothesis was generated then blocked before network. 4J must prevent auth-like slots from entering the rendered hypothesis at all, including when parser metadata fails to set `auth_like` but the slot name itself is auth-like.

## 4J hypothesis
A concrete example can be generalized safely when its **operation-local slot anchor** proves the task-input role. The slot must be inferred from the local request target and local documentation context, not from provider-specific knowledge.

Retain:
- 4G documentation acquisition, IR, operation normalization and reference expansion
- 4H auth classification and task semantic frame
- 4I representation-preserving auth pruning and exact-build structural evidence
- same safe probe, observed-field mapping, double live verify and replay

Change only the request-slot role inference and endpoint-local contradiction checks.

```text
operation-local documented target
    ↓
slot candidates
    ├── placeholder
    ├── query key/value
    └── concrete path segment
    ↓
nearest static anchor + source-section semantics
    ↓
TASK INPUT ROLE or REJECT
    ↓
entity contradiction guard
    ↓
safe hypothesis
```

## Operation-local evidence frame
For each operation, evidence may include only:
- operation title
- operation path/query text
- nearest source-section title and original source-section text
- parsed parameter names/descriptions/examples
- documented response vocabulary already present in evidence
- required task output names and frozen task intent/input names

No provider, domain, endpoint, vertical, case-to-API, or synonym seed table is permitted.

## Slot role rules
### A. Partial query-key role
A non-auth query key may bind a task input when:
- it has direct exact/morphological correspondence, OR
- it shares at least one non-generic lexical token with the task input; and
- operation-local semantic support is non-zero.

Example class: `page` may support `page_title` when local page semantics are present.

### B. Concrete path example role
A concrete path segment may be generalized even when it differs from the frozen build value only when all are true:
1. segment is not host/scheme and not an obvious fixed API/version segment;
2. there is operation-local input-role evidence in the original source section, nearest static anchor, operation title, or adjacent query/parameter labels;
3. the example segment and build input have compatible broad lexical shape (numeric, alphabetic, alphanumeric/identifier), allowing documented wildcard characters in the example;
4. replacing the example segment preserves every other byte of the target;
5. an endpoint-local entity contradiction is absent.

### C. Endpoint-local anchor contradiction
For a generalized path slot, inspect the nearest meaningful static path segment before the slot.
- If the anchor directly contains a task-input/entity token, it is positive evidence.
- If the anchor is a clear entity label represented in local documentation but has zero overlap/containment with task entity/input tokens, and the binding otherwise depends only on a generic/concrete identifier, reject before probe.

Required causal example:
- `/api/books/1` MUST reject for fictional-character input.
- `/api/characters/1` MAY proceed.

### D. Independent auth-name guard
Any parameter/query key whose decoded name matches the auth-name grammar is auth-like regardless of parser `auth_like` metadata.
- optional/unbound auth material is surgically removed
- required auth blocks
- auth-like slot names are never emitted into request hypotheses

## Required metrics
- `operationLocalSlotCandidates`
- `slotAcceptedExactOrMorph`
- `slotAcceptedPartialQueryKey`
- `slotAcceptedConcreteExample`
- `slotAcceptedByAnchorContainment`
- `slotRejectedShapeMismatch`
- `slotRejectedNoLocalRoleEvidence`
- `slotRejectedEntityContradiction`
- `slotRejectedVersionOrFixedSegment`
- `authNameGuardPruned`
- `authNameGuardRejected`
- `authLikeRenderedRequests = 0`
- retain all 4I placeholder preservation metrics

## Same-graph invariant
Planner and validator must reconstruct the same 4J graph from identical evidence.

Successful contracts use:
`4J_OPERATION_LOCAL_SLOT_ANCHOR:<hypothesis_id>`

Older provenance prefixes reject.

## Causal tests required before benchmark
1. npm `{package}` remains literal and valid.
2. Met `{objectID}` remains literal and valid.
3. query key `page` can bind `page_title` only with page-local support.
4. OFF-style `/product/737628064502.xml` can generalize the documented product identifier under local barcode/product evidence.
5. NHTSA-style `/decodevin/5UXWX7C5*BA?format=json&modelyear=2011` can generalize the VIN segment while preserving `format` and `modelyear` literals.
6. `/books/1` rejects for fictional-character input.
7. `/characters/1` may bind fictional-character input.
8. version segments such as `v2`, `v3`, `2024` are not generalized merely because an input is numeric/alphanumeric.
9. query key `key`, `token`, `api_key`, etc. is never emitted even when parser says `auth_like=false`.
10. optional auth pruning preserves all non-auth bytes and placeholders.
11. same 4J graph validates; old provenance prefixes reject.
12. no provider/domain/endpoint seed tables are present.

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
- `wrongTaskProbeAttempts = 0`
- `placeholderPreservationFailures = 0`
- `nonAuthRequestTextMutations = 0`
- zero successful recipes whose nearest endpoint entity anchor contradicts the task entity frame
- controls 42/42 and event-derived safety clean
- retain >=1 confirmed relative-operation/API-base recipe
- retain >=1 successful recipe from reference-expanded evidence
- aggregate diagnostics equal per-attempt recomputation

Preferred economics:
- total LLM cost <= `$0.60`
- mean LLM cost/success <= `$0.15`

## Diagnostic targets
- retain npm + Met
- recover at least one of OFF or NHTSA, targeting both
- restore Wikipedia if a locally evidenced page/title query role is found
- eliminate the Ice And Fire `/books/{character}` false positive
- semantic pre-probe failure rate <70%

If R4 recovery remains <5/6, do NOT automatically create 4JR/4JR2. Attribute the remaining ceiling first.

## Formal benchmark decision
- `GO_4J_OPERATION_LOCAL_SLOT_ANCHORING`
- otherwise `REASSESS_4J_OPERATION_LOCAL_SLOT_ANCHORING`
