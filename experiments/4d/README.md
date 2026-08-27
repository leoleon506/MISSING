# Experiment 4D — Structured Request Block Compiler

## Status
Development/recovery experiment over the already-burned 4A workload. No fresh blind holdout is consumed.

This README is the **first commit on the 4D branch**.

## Frozen parent evidence
- 4C merge SHA: `3c3871cde4252782d7734990307ae681423544d1`
- 4C workflow run: `33109222101`
- 4C job: `98647269870`
- 4C artifact: `9662790183`
- artifact digest: `sha256:8c79de790f0edd7fa0f25c79d2193f18305a62f7e6fd39374d5ca8a086daf249`
- formal decision: `REASSESS_4C_TYPED_REQUEST_EVIDENCE_ACQUISITION`
- report fingerprint: `03948f480e1732edf015871c3b0f2d3eeadcf3b6a28ea5477d711521c5fd9e7e`
- ledger fingerprint: `ae47dc5c086c7d2d6196caf787ca97a15dba7dd619aea587dfe4b70c5ef95566`
- ledger events: `5218`

## Frozen 4C outcome
- 24 cases / 8 families
- 2 successful manufactures / 1 family / 2 providers / 2 recipes
- replay 2/2 = 100%
- 164 synthesis attempts
- 97 `noTypedRequestEvidenceAttempts`
- 52 `typedEvidenceUnusableAttempts`
- 69 typed request hypotheses
- 24 unique rendered probe URLs
- 4 successful 2xx JSON probes / 20 rejected
- `validatorGraphMismatchRejects = 0`
- `standaloneUrlPromotions = 0`
- `documentationOriginFallbacks = 0`
- controls 42/42
- total LLM cost `$0.2416464`
- mean LLM/success `$0.1208232`

## Frozen forensic interpretation
4C fixed the 4B same-graph validator defect and proved that successful typed probes can survive COMPILE, static validation, double live verification, persistence and changed-input zero-cognition replay. However, request recovery collapsed before probing: 149/164 provider attempts had either no typed request evidence or typed evidence that could not be compiled.

Three distinct request-layer ceilings were observed:
1. **Template grammar**: documented paths such as `/:package` were visible but not compiled because 4C recognized only `{name}` placeholders.
2. **Base + relative operation relation**: a correct API base and a correct relative `GET /path/[id]` could coexist in the corpus but were not linked into one request proof.
3. **Acquisition/block recall**: providers with previously demonstrated requests could still expose no request candidate because 4C used flat regex extraction over fetched text rather than bounded request/reference blocks.

Provider ranking and response mapping are not the primary target of 4D. The six historical R4 providers all appeared within the attempt frontier in 4C, and 4C had zero successful-probe mapping rejects.

## 4D hypothesis
MISSING should reason mechanically over **structured request blocks**, not isolated URL matches. A request block is a bounded, attributable source region that may contain method, API base, operation path, parameter syntax, example values and auth requirements. Only internally coherent facts from the same block, or an explicitly proven base↔operation relation, may be compiled into a probe request.

## Architecture

```text
provider docs/spec corpus
        ↓
BOUNDED REQUEST / API-REFERENCE BLOCK EXTRACTION
        ├─ fenced code block / preformatted request example
        ├─ HTTP request-line block
        ├─ curl/fetch/axios block
        ├─ endpoint/base-url labeled block
        ├─ OpenAPI/Swagger operation
        └─ bounded API-reference link expansion
        ↓
STRUCTURED REQUEST BLOCK
        ├─ method
        ├─ api_base
        ├─ operation_path
        ├─ parameter syntax
        ├─ example values
        ├─ auth hints
        └─ evidence/source ranges
        ↓
GENERIC TEMPLATE GRAMMAR
        ├─ {id}
        ├─ :id
        ├─ [id]
        ├─ <id>
        └─ {{id}}
        ↓
SAME-BLOCK / EXPLICIT-RELATION base + relative operation linker
        ↓
strict input influence + anonymous GET eligibility
        ↓
canonical request dedup
        ↓
safe GET schema probe
        ↓
observed response mapping
        ↓
4D SAME-GRAPH validator
        ↓
double live verify → persist → changed-input zero-cognition replay
```

## Closed proof kinds
Every executable 4D request hypothesis must carry one of the following provider-blind proof kinds:
- `openapi_operation`
- `http_request_block`
- `curl_request_block`
- `fetch_request_block`
- `axios_request_block`
- `endpoint_labeled_block`
- `base_relative_operation_block`
- `structured_endpoint_example`

`raw_absolute_url` is forbidden.

## Request block invariants
1. Blocks are bounded. A parser may not associate a URL with a request keyword merely because both appear hundreds of characters apart in unrelated text.
2. Method defaults to GET only for syntaxes whose semantics prove GET-by-default (`curl` without a mutating method, `fetch` without non-GET method, `axios.get`).
3. POST/PUT/PATCH/DELETE blocks are rejected before probing.
4. Relative operations are executable only when an API base is proven in the same block or through an explicit local relation preserved by the parser.
5. Documentation page origin is never an API-origin fallback.
6. Auth-like required parameters make a hypothesis ineligible for anonymous probing.
7. A build input must influence the final request through exactly one mechanically proven slot/path replacement per task input.
8. No response observation may mutate origin, path, method, parameter names, parameter literals or input bindings.

## Generic placeholder grammar
The compiler must normalize provider documentation placeholders mechanically and provider-blindly:
- `{name}`
- `:name`
- `[name]`
- `<name>`
- `{{name}}`

The original literal syntax and source range remain in provenance. Placeholder normalization must not invent names or substitute values unless the task input binding is mechanically defensible.

## Bounded reference acquisition
4D may expand documentation only through attributable API-reference links already present in acquired evidence. Link text/path signals may include provider-blind terms such as `API Reference`, `REST API`, `Endpoints`, `OpenAPI`, `Swagger`, `Developer API`, `API Docs`.

Constraints:
- bounded number of expansions per provider;
- HTTPS only;
- same registrable-domain documentation safety unless an explicit source link proves the API/docs relation;
- no provider/domain/case-specific seeds;
- no search-engine invention of endpoints;
- every expansion recorded in the ledger.

## Same-graph validator invariant
The 4D planner and validator must reconstruct the exact same `buildStructuredRequestGraph4D(...)` inventory. Contracts must use `4D_STRUCTURED_REQUEST:<hypothesis_id>` and validation must reject P1/4B/4C prefixes.

A causal integration test is mandatory:
`structured block → compiled request → successful probe proof → materialized COMPILE → validate4d accepts the same hypothesis`.

## Required diagnostics
At minimum:
- `structuredRequestBlocks`
- `blocksByProofKind`
- `placeholderSyntaxCounts`
- `baseRelativeLinksFormed`
- `boundedReferenceExpansions`
- `noStructuredRequestBlockAttempts`
- `structuredBlockUnusableAttempts`
- `structuredRequestHypotheses`
- `uniqueRenderedProbeUrls`
- `duplicateRenderedProbeUrlsRejected`
- schema-probe metrics
- `successfulProbeMappingRejects`
- `validatorGraphMismatchRejects`
- `standaloneUrlPromotions`
- `documentationOriginFallbacks`
- replay deltas
- report and ledger fingerprints.

## Engineering recovery gate
4D is an engineering-recovery success only if all are true:
- recover **>=5 of the 6 capabilities previously demonstrated by R4**;
- >=5 successful manufactures total;
- >=4 families with success;
- changed-input replay >=95%;
- zero replay cognition/documentation/synthesis/schema-probe deltas;
- zero numeric-index decisions;
- zero documentation-origin fallback;
- zero standalone absolute-URL promotions;
- zero validator graph mismatch rejects;
- zero duplicate rendered probe URLs executed per provider/case;
- zero required-auth probes;
- 42/42 controls and event-derived safety clean;
- >=1 confirmed recipe whose relative operation was linked to an explicitly proven API base, or whose API origin differs from documentation origin with explicit block provenance;
- total LLM cost <= `$0.60` preferred;
- mean LLM cost/success <= `$0.15` preferred.

## Diagnostic targets
Compared with 4C:
- reduce `(noStructuredRequestBlockAttempts + structuredBlockUnusableAttempts) / synthesisAttempts` below **60%**;
- produce hypotheses from at least two non-brace placeholder syntaxes across the benchmark if such syntax exists in the acquired corpus;
- form at least one base+relative-operation request hypothesis when such evidence exists;
- keep successful-probe mapping reject rate at or below 4C;
- preserve zero validator mismatch and zero standalone URL promotion.

If 4D recovers <5/6 R4 capabilities, **do not automatically create 4DR/4DR2**. Attribute the remaining ceiling to block acquisition, placeholder/input binding, auth eligibility, operation-task correspondence, or response semantics before another experiment.

## Formal benchmark decision
Decision string:
- `GO_4D_STRUCTURED_REQUEST_BLOCK_COMPILER`
- otherwise `REASSESS_4D_STRUCTURED_REQUEST_BLOCK_COMPILER`.
