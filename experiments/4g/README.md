# Experiment 4G — Evidence-Native Operation Semantics

## Status
Preregistered engineering-recovery experiment over the already-burned 4A workload. No fresh blind holdout is consumed.

This README MUST be the first commit on the 4G branch.

## Frozen base
- 4F merge SHA: `550a77a08e1cc48fa79ec9487df9ca4a7ba60798`
- 4F workflow: `Run MISSING Experiment 4F`
- workflow run: `33126864239`
- job: `98706981859`
- event: `workflow_dispatch`
- artifact: `9669372872`
- artifact digest: `sha256:985f9b8eaca4385980c1db31d2ac4a89d8df355398a6b8fe4f8caa4d24be9aa6`
- decision: `REASSESS_4F_DOCUMENTATION_IR_OPERATION_GRAPH`
- report fingerprint: `141dba0be0c43569b607fc16666b87a1014ad6b00e80c2a2fa13dbed57f3d211`
- ledger fingerprint: `222a5d5ad41be255f500fae8d39a2a59c4d0c0ae3b6c8177a5c18d235acfc924`
- ledger events: `5122`
- fixed model: `gpt-4.1-mini-2025-04-14`

## Frozen 4F outcome
- 24 cases / 8 families
- 2 successful manufactures / 2 families / 2 providers / 2 recipes
- replay 2/2 = 100%
- R4 capability recovery: 2/6 (`Genderize.io`, `Metropolitan Museum of Art`)
- 161 synthesis attempts
- 90 `noIrOperation` attempts
- 68 `irOperationUnusable` attempts
- pre-usable-operation failure rate: `(90 + 68) / 161 = 98.1366%`
- 887 IR documents
- 12,008 IR sections
- 2,228 IR operations
- 1,741 IR parameters
- 246 IR API bases
- 1,379 operation↔API-base links
- 43 ancestor API-base links
- 106 source-local namespace links
- 782 relative operations still unlinked
- 126 reference links discovered
- 39 actual reference fetches
- 31 successful reference fetches
- 31 evidence documents added
- 45 operations created from expanded evidence
- 0 hypotheses from expanded evidence
- 0 recipes from expanded evidence
- 5 schema probes / 5 successful 2xx JSON
- `authLikeRenderedRequests = 0`
- `knownAuthProbeAttempts = 0`
- `wrongTaskProbeAttempts = 0`
- `documentationOriginFallbacks = 0`
- `standaloneUrlPromotions = 0`
- `validatorIrFingerprintMismatchRejects = 0`
- controls 42/42
- total LLM cost `$0.2292` approximately
- mean LLM cost/success `$0.1146` approximately

## Frozen forensic interpretation
4F validated the Documentation IR architecture itself: the Metropolitan Museum capability was recovered through a relative operation linked to an explicit API base via structural ancestry, and rendered credential material was blocked before probing. However, 4F regressed total breadth because three narrower semantic boundaries remained unresolved.

1. **Multi-form endpoint normalization is incomplete.** Open Food Facts, TheCocktailDB, and NHTSA reached documentation but produced zero useful IR operations in their failing attempts. Their docs often express requests as URLs in tables, links, prose labels, rendered code fragments, Swagger-generated structures, or other markup not covered by the narrow request atom patterns.
2. **Auth inheritance is too broad.** Agify public anonymous operations were rejected because auth evidence from a containing documentation scope contaminated operations that can execute anonymously. Safety must remain strict at the rendered-request boundary while operation-level auth semantics become more precise.
3. **Parameter correspondence is too literal.** npm operations were present and linked to API bases but `package_name` did not correspond to documented `package` strongly enough. Provider-blind morphological normalization is needed without restoring the forbidden `one input + one slot => bind` fallback.
4. **Expanded evidence reaches operation IR but not executable hypotheses.** 45 operations came from actually expanded documents, yet zero hypotheses and zero recipes depended on that evidence. 4G must expose exactly which semantic gate rejects them.

## 4G hypothesis
Keep the 4F Documentation IR and request/validator architecture. Improve only the semantic normalization layer between evidence and executable operation hypotheses.

```text
raw docs/specs + bounded reference expansion
        ↓
4F DOCUMENTATION IR (retained)
        ↓
EVIDENCE-NATIVE OPERATION NORMALIZATION
  ├─ explicit GET/curl/fetch/axios
  ├─ endpoint/request URL labels
  ├─ standalone API-like HTTPS URLs in endpoint-local context
  ├─ table cells / links whose local heading labels them as endpoint/request/example
  ├─ OpenAPI-like server + path structures already present in evidence
  └─ one operation per evidenced request form
        ↓
OPERATION-SCOPED AUTH SEMANTICS
  REQUIRED | OPTIONAL | RATE_LIMIT_UPGRADE | UNRELATED | UNKNOWN
        ↓
PROVIDER-BLIND PARAMETER SEMANTICS
  morphology + local operation context + documented concrete example
        ↓
4F safe request compiler / rendered-auth hard gate
        ↓
schema probe → observed mapping → same-graph validation → double live → replay
```

## Multi-form endpoint normalization invariants
4G may normalize an endpoint only when the URL/path itself is explicitly present in acquired evidence. It may not invent hosts, paths, parameters, methods, literals, or query keys.

Eligible evidence forms include:
- explicit `GET ...`
- `curl`, `fetch`, `axios.get`
- labels such as `Endpoint`, `Request URL`, `API URL`, `Example Request`, `Base URL`
- HTTPS URLs inside `<code>`, `<pre>`, table cells, or anchor `href` values when the local structural context identifies API/endpoint/request semantics
- Markdown links in an endpoint/example section
- explicit relative paths inside endpoint-local code/table/text when an API base is already structurally proven
- OpenAPI/Swagger operation material already present in evidence

Standalone navigation/product URLs remain non-executable.

Required metrics:
- `operationFormsExplicitHttp`
- `operationFormsCodeUrl`
- `operationFormsEndpointLabel`
- `operationFormsTableOrLink`
- `operationFormsOpenApi`
- `operationFormsRelative`
- `operationsRejectedAsNavigation`
- `operationsFromExpandedEvidence`

## Operation-scoped auth semantics
Auth evidence must be classified relative to the exact operation rather than inherited indiscriminately from every ancestor.

Closed classes:
- `REQUIRED`: explicit operation-local requirement or credential-bearing example needed to execute the operation
- `OPTIONAL`: operation-local evidence explicitly says anonymous use is permitted and auth is optional
- `RATE_LIMIT_UPGRADE`: credentials are described only for higher quota/premium usage, while anonymous execution is explicitly available
- `UNRELATED`: auth text belongs to another operation/section
- `UNKNOWN`: ambiguous; may not weaken the rendered-request hard gate

Rules:
- only `REQUIRED` blocks because of documentation semantics
- any rendered request containing auth-like header/query/path/cookie material blocks regardless of class
- `OPTIONAL`/`RATE_LIMIT_UPGRADE` operations may execute only when the rendered anonymous request omits all auth-like material
- auth may propagate from an ancestor only when the ancestor explicitly defines a security requirement for all contained operations; generic product-page mentions do not propagate

Required metrics:
- `authClassRequired`
- `authClassOptional`
- `authClassRateLimitUpgrade`
- `authClassUnrelated`
- `authClassUnknown`
- `authRequiredOperationsRejected`
- `authLikeRenderedRequests = 0`
- `knownAuthProbeAttempts = 0`

## Provider-blind parameter semantics
The forbidden rule `one task input + one request slot => bind` remains forbidden.

4G may additionally compare normalized identifier morphology. Generic removable suffixes are frozen as:
- `_name`, `Name`
- `_id`, `Id`, `ID`
- `_code`, `Code`
- `_identifier`, `Identifier`

Examples of mechanically related forms:
- `package_name` ↔ `package`
- `object_id` ↔ `objectId`
- `drink_name` ↔ `drink`

Morphology alone is insufficient when the remaining stem is generic (`id`, `name`, `code`, `value`, `key`). Acceptance also requires at least one of:
- operation title/heading/context overlap with task intent
- exact build value in the documented operation example at a unique replaceable position
- parameter description/local label overlap
- OpenAPI parameter metadata on that exact operation

No provider- or vertical-specific synonym tables.

Required metrics:
- `parameterMorphologyCandidates`
- `parameterMorphologyAccepted`
- `parameterMorphologyRejectedGeneric`
- `concreteExampleBindings`
- `wrongTaskProbeAttempts = 0`

## Expanded-evidence causality
For every operation derived from reference-expanded evidence, 4G must record whether it was rejected by:
- no API base
- auth required
- task/operation mismatch
- parameter mismatch
- rendered auth hard gate
- duplicate rendered URL
- schema probe failure
- successful mapping reject

At least one successful recipe must depend on actually expanded evidence if eligible expanded operations exist.

## Same-graph invariant
Planner and validator must reconstruct identical evidence-native operation semantics from the same Documentation IR. Successful contracts use:

`4G_EVIDENCE_NATIVE_OPERATION:<hypothesis_id>`

Old P1/4B/4C/4D/4E/4F prefixes reject.

## Causal tests required before benchmark
1. Existing 4F Met-style ancestor base + relative operation still compiles.
2. A table/link labeled `Endpoint` containing an explicit HTTPS API URL becomes an operation.
3. A plain navigation link does not become an operation.
4. A CocktailDB-like endpoint URL in local endpoint/example text is normalized without provider-specific literals.
5. An OFF-like product lookup URL in code/table evidence is normalized.
6. An NHTSA-like explicit API URL in rendered docs is normalized.
7. `package_name` ↔ `package` is accepted only with operation-context support.
8. unrelated task input ↔ generic `{id}` remains rejected.
9. operation-local `API key required` blocks.
10. ancestor `API keys increase rate limits; anonymous requests are supported` does not block a credential-free child operation.
11. rendered `?key=...`, Authorization, bearer, basic auth, OAuth credential material still blocks before network execution.
12. expanded evidence operation preserves expansion provenance through hypothesis and recipe metadata.
13. same-graph 4G compile validates; old prefixes reject.
14. source audit proves no frozen provider/domain/endpoint seeds.

## Engineering recovery gate
4G is GO only if ALL required gates are satisfied:
- recover >=5 of 6 capabilities previously demonstrated by R4
- >=5 successful manufactures total
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
- 42/42 controls and event-derived safety clean
- retain >=1 confirmed relative-operation/API-base recipe
- >=1 successful recipe from actually reference-expanded evidence if eligible expanded operations exist
- aggregate diagnostics equal per-attempt recomputation

Preferred economics:
- total LLM cost <= `$0.60`
- mean LLM cost/success <= `$0.15`

## Diagnostic targets
Compared with 4F:
- pre-usable-operation failure rate <70%
- retain Genderize and Met
- recover npm without weakening generic-id safeguards
- recover Agify without permitting credential-bearing requests
- recover >=3 of the four historically missing R4 targets among npm/OFF/Cocktail/Met/NHTSA as necessary to reach >=5/6 total
- at least one accepted hypothesis from expanded evidence when expanded evidence contains eligible operations

If 4G recovers <5/6 R4 capabilities, do NOT automatically create 4GR/4GR2. Attribute the remaining ceiling before another experiment.

## Formal benchmark decision
- `GO_4G_EVIDENCE_NATIVE_OPERATION_SEMANTICS`
- otherwise `REASSESS_4G_EVIDENCE_NATIVE_OPERATION_SEMANTICS`
