# Experiment 4A-R6R — Deterministic Operation Compiler Recovery

## Status
Development/recovery only over the already-burned 4A workload. No fresh blind holdouts are consumed.

## Frozen parent evidence
- 4A-R6 merge SHA: `f5c34c8598698ad9ee9e2cff856a298b7dd00690`
- 4A-R6 run: `33038630313`
- job: `98406954836`
- artifact: `9633749547`
- artifact digest: `sha256:bf9b49a2b17cff695b676c50d2f733242cd93c834c257d46f5ec70e7bb576302`
- report fingerprint: `9402d2488cfc71e83bc9c80595bf42ebe1937007e1f679dce3d0de08f06f2df6`
- ledger fingerprint: `518a95d6f53dbbd819783609b0224737b289291415d4a82fc2d73655acd819ef`

## Frozen R6 outcome
- 24 cases / 8 families
- 2 successful manufactures
- 1 successful family
- 2 distinct providers / 2 persisted recipes
- 2/2 changed-input replay = 100%
- median success latency 52.947s
- p90 success latency 59.992s
- total LLM cost `$0.4692`
- mean LLM cost/success `$0.2346`
- 157 LLM calls
- 2,468 doc fetches / 1,489 spec probes
- 170 synthesis attempts / 4 repairs
- 7 live calls
- 42/42 controls and event-derived safety clean

## Frozen diagnosis before R6R
R6 proved that a typed `DocumentedOperation` boundary can produce correct, replayable recipes when the operation facts are extracted correctly. Its two successes were simple URL-example IR cases. Breadth did not improve because operation extraction remained lossy/noisy:

1. Arbitrary absolute URLs from documentation were promoted as API operations (assets, social links, navigation, CDN URLs), consuming the 24-operation cap.
2. Endpoint template syntax was incompletely canonicalized (`[id]`, HTML/Markdown wrappers, escaped delimiters).
3. Concrete URL examples such as `/npm` were not generalized to documented relative endpoint templates even when the same documentation contained a parameterized endpoint form.
4. Relative endpoint snippets were not compiled even though R6 preregistration allowed exact relative endpoints anchored to cited evidence origins.
5. OpenAPI server normalization could duplicate host/path text in the canonical path.
6. Request URL and nearby response examples were not robustly paired into one operation proof, leaving useful operations without response paths.
7. One-shot mapping over a heterogeneous operation list could emit parameter indices invalid for the selected operation.

## R6R hypothesis
A deterministic endpoint-block compiler that first extracts *endpoint candidates*, rejects non-API/navigation/assets, canonicalizes endpoint templates, attaches structured response examples, and only then constructs `DocumentedOperation` IR will recover already-demonstrated capabilities without weakening safety or increasing discovery breadth.

## Recovery objectives
These are diagnostic targets, not replacement formal GO gates:
- exceed R6's 2/24 manufactures;
- recover at least 4 successful manufactures if the frozen evidence supports them;
- recover at least 3 families;
- demonstrate at least one successful structured-spec/OpenAPI-derived operation if present;
- keep replay >=95% and all safety/control gates clean;
- keep total LLM cost <= R6 total + 25% (`<= $0.5865`) if possible;
- reduce invalid-selection/materialization errors to zero by construction.

## Allowed changes

### 1. Endpoint-block extraction
Compile evidence into bounded endpoint blocks before operation IR construction. An endpoint block may contain:
- exact absolute HTTPS API-looking URL/template;
- exact relative HTTP endpoint/template found in code/pre/example/inline-code or API-reference context;
- exact request query keys/literals;
- nearby JSON response example paths;
- evidence id, resolved evidence URL, and deterministic character offsets.

### 2. API-likeness filter
Deterministically reject URL candidates that are clearly non-operations, including:
- static assets/extensions (js/css/map/font/image/video/archive);
- social/account/navigation links;
- docs legal/privacy/terms/community links;
- mailto/tel/javascript fragments;
- anchors without request evidence;
- cross-provider/cross-domain candidates not allowed by existing scope rules.

No provider/domain-specific denylist is allowed. Filtering must use generic structural/path/content rules.

### 3. Complete endpoint-template canonicalization
Mechanically canonicalize documented placeholders while preserving names:
- `{id}`
- `<id>`
- `:id`
- `[id]`
- encoded/HTML forms of those delimiters

Strip HTML/Markdown wrappers/punctuation without inventing path segments. Never rename a documented endpoint parameter to a task input name.

### 4. Relative endpoint anchoring
A documented relative endpoint may be anchored only to an exact HTTPS origin mechanically proven by the same cited provider evidence (`resolved_url` origin) or an exact verified OpenAPI server origin. Existing same-domain/public-DNS/private-host/HTTPS controls remain active.

### 5. Concrete-example/template reconciliation
When a documentation block contains both a parameterized endpoint template and a concrete example URL with the same static path shape/query keys, merge them mechanically:
- preserve parameter names from the explicit template;
- preserve documented concrete literal/query examples;
- attach response paths from the paired response example;
- never infer a template solely by replacing arbitrary concrete values.

### 6. Correct OpenAPI server normalization
Normalize OpenAPI/Swagger server information mechanically:
- absolute `https://host/path` -> origin + base_path;
- scheme-relative `//host/path` -> HTTPS only when HTTPS is documented/allowed by spec;
- host/path without scheme -> parse host separately, never as a relative path;
- relative server path -> anchor to exact spec `resolved_url` origin;
- Swagger `host + basePath + schemes` -> exact HTTPS origin/base path;
- reject templated/unresolved server variables unless all values are mechanically fixed by spec defaults.

No duplicated hostname/path components may enter `full_path`.

### 7. Request/response block pairing
Within a bounded documentation block, pair an endpoint with nearby structured JSON examples and extract exact response paths. Prefer code/pre/JSON/script blocks over arbitrary page prose. Do not use live response bodies.

### 8. Two-stage planner boundary
Stage A: LLM chooses only `operation_index` or REJECT from the supplied operation packet.
Stage B: a second structured-output call receives only the selected operation and maps:
- documented path/query parameters -> exact case inputs/documented literals/OMIT;
- required outputs -> exact operation response paths or INPUT.

This removes cross-operation parameter-index ambiguity. Repair, if used, may only re-map within the same selected operation; it may not select a new endpoint after a live call.

### 9. Deterministic preselection before LLM
Rank operation IR using generic structural fitness:
- required output-name/token overlap with response paths;
- case-input token overlap with path/query parameter names;
- proof quality: OpenAPI/schema > endpoint+JSON example > endpoint-only;
- API-likeness confidence;
- completeness penalties for unbound required params / absent response paths.

Supply at most 12 high-quality operations to Stage A, while persisting the full extracted operation inventory and dropped reasons for audit.

## Frozen unchanged
- exact 24 cases / 8 families and build/replay inputs
- R2 top-120 provider frontier
- R5 deterministic provider reranker/scoring/order
- max 8 provider attempts per case
- existing crawl depth/byte limits and acquisition calls
- anonymous HTTPS GET only
- DNS/private-host/redirect/cross-domain/credential/header controls
- semantic validators
- 3X projection execution semantics
- double-live verification
- changed-input zero-cognition replay
- 42 controls
- original 4A gates
- no response-body repair

## Forbidden
- provider/domain/case/endpoint-specific maps or regexes
- curated provider allowlists or hand-authored recipes
- external search engine/API directory discovery
- expanding R2 top-120 or max-8 provider attempts
- fresh blind holdouts
- loosening semantic/safety/replay gates
- constructing endpoint templates by arbitrary value substitution from concrete URLs
- using live response bodies to invent/repair endpoint, parameter, or projection facts

## Attribution requirements
Persist for every provider attempt:
- raw endpoint candidate count;
- accepted/rejected endpoint blocks and generic reject reasons;
- full operation inventory count/fingerprint;
- top-12 operation packet/fingerprint;
- proof source per operation;
- Stage A selected operation index/id or REJECT;
- Stage B mapping and any mapping error;
- exact validated operation proof;
- live and replay disposition.

## Formal gates
Same original 4A gates:
- >=12/24 successful manufactures
- >=6/8 successful families
- >=8 distinct provider hosts
- all persisted recipes double-live verified
- >=95% changed-input replay
- zero replay cognition deltas
- 42/42 controls
- event-derived safety clean
- median success latency <=90s
- p90 success latency <=180s
- mean LLM cost/success <=$0.15
- total LLM cost <=$3.00

Formal decision:
- `GO_4A_R6R_DETERMINISTIC_OPERATION_COMPILER_RECOVERY`
- otherwise `REASSESS_4A_R6R_DETERMINISTIC_OPERATION_COMPILER_RECOVERY`

A GO remains engineering recovery evidence only. Fresh blind breadth validation is still required afterward.
