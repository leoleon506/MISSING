# Experiment 4E — DOM-Native API Evidence + Operation Correspondence

## Status
Development/recovery experiment over the already-burned 4A workload. No fresh blind holdout is consumed.

This README is the **first commit on the 4E branch**.

## Frozen parent evidence
- 4D merge SHA: `34bf4ee7fbb2c922f625dae2e367175288b8b774`
- 4D workflow run: `33116945432`
- 4D job: `98673908998`
- 4D artifact: `9665795170`
- artifact digest: `sha256:83bb8f02fe8a4031bdc2d257e632884a51341d38936ecf81e36b91c0db4d6c01`
- formal decision: `REASSESS_4D_STRUCTURED_REQUEST_BLOCK_COMPILER`
- report fingerprint: `335981bc814f571036fc2d0886339ba01b9903565dcabfd8f0827eea56d8fe72`
- ledger fingerprint: `d163450cad1d2ab684d11ef34a19f54af18cfdc5662402efec62831d84ca03f4`
- ledger events: `5521`

## Frozen 4D outcome
- 24 cases / 8 families
- 0 successful manufactures / 0 families / 0 providers / 0 recipes
- 175 synthesis attempts
- 53 structured request blocks
- 58 structured request hypotheses
- 17 unique rendered probe URLs
- 17 schema probes / 0 successful 2xx JSON / 17 rejected
- 0 base-relative links formed
- 0 validator graph mismatches
- 0 standalone URL promotions
- 0 documentation-origin fallbacks
- controls 42/42
- total LLM cost `$0.2341872`

## Frozen forensic interpretation
4D proved that bounded structured-request parsing can remain provider-blind and preserve safety invariants, but it failed end-to-end because request evidence was still acquired and interpreted incorrectly.

The dominant ceilings are now frozen as:
1. **DOM/markup recall loss**: request examples embedded inside HTML `<pre>`, `<code>`, entities, inline markup, or rendered-document text were missed by line-anchored extraction even when earlier experiments had recovered them.
2. **Reference acquisition was not actually performed**: the 4D `boundedReferenceExpansions` metric counted evidence containing API-reference language but did not fetch and add those attributable reference targets to the evidence graph.
3. **Operation-task correspondence was too weak**: the generic fallback `one task input + one request slot => bind them` permitted semantically unrelated operations to be probed.
4. **Auth evidence was incomplete**: auth detection focused on parameter names and did not reject operations requiring Authorization headers, bearer tokens, basic auth, OAuth, or equivalent textual requirements before probing.
5. **Document segmentation was too coarse**: a bounded region containing multiple request examples could collapse to a single operation rather than yielding one operation node per request.
6. **4D aggregate diagnostics were partially miswired**: `noStructuredRequestBlockAttempts` and `structuredBlockUnusableAttempts` remained zero despite per-attempt evidence showing many such cases. 4E must expose these diagnostics directly from the planner result and cross-check aggregate counts against synthesis evidence.

## 4E hypothesis
MISSING should not execute a request because it merely has a valid URL template. Before any probe, four independently grounded facts must exist:

`API provenance + operation provenance + auth eligibility + task/operation correspondence`.

4E will acquire request evidence from document structure, not line shape alone, will perform real bounded API-reference expansion, and will require explicit or mechanically defensible correspondence between the task and the operation/parameter semantics.

## Architecture

```text
provider documentation corpus
        ↓
DOM / MARKDOWN STRUCTURAL NORMALIZATION
        ├─ HTML <pre>/<code>
        ├─ inline code and entities
        ├─ fenced Markdown blocks
        ├─ request lines / curl / fetch / axios
        ├─ labeled endpoint/base-url sections
        ├─ OpenAPI / Swagger operations
        └─ one operation node per request example
        ↓
REAL BOUNDED API-REFERENCE EXPANSION
        ├─ attributable href/URL already present in evidence
        ├─ API Reference / REST API / OpenAPI / Swagger / Endpoints
        ├─ HTTPS only
        ├─ bounded per provider
        ├─ same-domain documentation safety unless explicit relation proves otherwise
        └─ every fetch + source→target edge recorded in ledger
        ↓
API PROVENANCE GRAPH
        +
OPERATION PROVENANCE GRAPH
        +
AUTH ELIGIBILITY PROOF
        +
TASK ↔ OPERATION CORRESPONDENCE PROOF
        ↓
GENERIC TEMPLATE COMPILER
        ├─ {id}
        ├─ :id
        ├─ [id]
        ├─ <id>
        └─ {{id}}
        ↓
canonical GET request candidate
        ↓
SAFE ANONYMOUS SCHEMA PROBE
        ↓
observed response mapping
        ↓
4E SAME-GRAPH VALIDATOR
        ↓
double live verify → persist → changed-input zero-cognition replay
```

## DOM/markup normalization invariants
1. HTML/Markdown syntax may be normalized only to recover text and explicit structural relations already present in the fetched evidence.
2. HTML entities may be decoded mechanically.
3. `<pre>` and `<code>` regions are independent extraction scopes. Each request example inside them becomes a separate operation candidate.
4. Inline markup may not cause request keywords and URLs from unrelated DOM regions to be joined.
5. The parser may not invent an endpoint, parameter, method, host, API base, or auth requirement.
6. Standalone navigation URLs are never executable request proofs.

## Real bounded reference acquisition
4E must actually fetch attributable API-reference targets rather than count reference language.

Eligible reference signals include provider-blind terms such as:
- `API Reference`
- `REST API`
- `Developer API`
- `API Docs`
- `Endpoints`
- `OpenAPI`
- `Swagger`

Constraints:
- target must be an explicit URL/href already present in acquired evidence;
- HTTPS only;
- bounded expansion count per provider;
- same registrable-domain documentation expansion unless an explicit source relation proves a different API/docs domain;
- no search-engine invention;
- no provider/domain/case-specific seeds;
- redirects preserve existing safety guards;
- every expansion must record source evidence ID, source URL, target URL, status, bytes, and resulting evidence ID in the ledger;
- `referenceExpansionFetches` counts actual HTTP fetches, not regex matches.

## Auth eligibility proof
A request is ineligible before probing if its operation evidence proves or strongly indicates required credentials through any of:
- `Authorization` header requirement;
- bearer token;
- basic auth / `curl -u`;
- OAuth / access token;
- required API key header/query/path parameter;
- client secret / client id pair used as credentials;
- explicit phrases such as `authentication required`, `requires authentication`, or equivalent structured OpenAPI security requirement.

Anonymous examples with optional auth remain eligible only when the concrete operation can be executed without credentials.

Required metrics:
- `authRequiredOperationsRejected`
- `knownAuthProbeAttempts`

Hard invariant: `knownAuthProbeAttempts = 0`.

## Task ↔ operation correspondence proof
The 4D fallback `one task input + one request slot => bind` is forbidden.

A request may be probed only when every task input has a mechanically defensible relation to an operation parameter or concrete example. Acceptable evidence may include:
- normalized lexical/semantic overlap between task input name and documented parameter name;
- exact build-value occurrence in a documented example request with a unique replaceable position;
- OpenAPI parameter name/description associated with the selected operation;
- local operation title/summary/description that corresponds to the task intent together with parameter evidence;
- provider-blind deterministic aliases derived from generic identifier morphology only when unambiguous (for example `object_id` ↔ `objectId`), never domain-specific synonym tables.

Forbidden:
- binding solely because one input and one slot exist;
- binding an input to a generic `{id}` without independent operation/task correspondence;
- using response fields to repair request semantics;
- LLM invention of parameter names, URLs, hosts, or literals.

Required metrics:
- `operationCorrespondenceCandidates`
- `operationCorrespondenceAccepted`
- `operationCorrespondenceRejected`
- `wrongTaskProbeAttempts`

Hard invariant: `wrongTaskProbeAttempts = 0`.

## API base + relative operation linking
A relative operation is executable only when its API base is proven by:
1. the same structural section/block; or
2. an explicit source-local relation; or
3. a fetched API-reference document whose provenance edge links it to the source provider evidence.

Documentation origin is never used as an API-origin fallback.

Required metrics:
- `baseRelativeLinksFormed`
- `crossRegionJoinRejects`
- `documentationOriginFallbacks`

## Same-graph validator invariant
The planner and validator must reconstruct the exact same 4E request graph. Successful contracts use:

`4E_OPERATION_CORRESPONDENCE:<hypothesis_id>`

The validator rejects P1/4B/4C/4D prefixes.

A causal integration test is mandatory:

`DOM request evidence → operation correspondence → safe successful probe proof → materialized COMPILE → validate4e accepts the exact same hypothesis`.

## Required diagnostics
At minimum:
- `domScopesParsed`
- `requestExamplesExtracted`
- `operationsExtracted`
- `operationsByProofKind`
- `placeholderSyntaxCounts`
- `referenceLinksDiscovered`
- `referenceExpansionFetches`
- `referenceExpansionSuccesses`
- `referenceExpansionEvidenceAdded`
- `authRequiredOperationsRejected`
- `knownAuthProbeAttempts`
- `operationCorrespondenceCandidates`
- `operationCorrespondenceAccepted`
- `operationCorrespondenceRejected`
- `wrongTaskProbeAttempts`
- `baseRelativeLinksFormed`
- `crossRegionJoinRejects`
- `noOperationEvidenceAttempts`
- `operationEvidenceUnusableAttempts`
- `requestHypotheses`
- `uniqueRenderedProbeUrls`
- `duplicateRenderedProbeUrlsRejected`
- schema-probe metrics
- `successfulProbeMappingRejects`
- `validatorGraphMismatchRejects`
- `standaloneUrlPromotions`
- `documentationOriginFallbacks`
- replay deltas
- report and ledger fingerprints.

Aggregate `noOperationEvidenceAttempts` and `operationEvidenceUnusableAttempts` must be cross-checked against per-attempt synthesis evidence; mismatch is a diagnostic failure.

## Engineering recovery gate
4E is an engineering-recovery success only if all are true:
- recover **>=5 of the 6 capabilities previously demonstrated by R4**;
- >=5 successful manufactures total;
- >=4 families with success;
- changed-input replay >=95%;
- zero replay cognition/documentation/synthesis/schema-probe deltas;
- zero numeric-index decisions;
- zero documentation-origin fallback;
- zero standalone absolute-URL promotions;
- zero validator graph mismatch rejects;
- zero duplicate rendered probe URLs actually executed per provider/case;
- `knownAuthProbeAttempts = 0`;
- `wrongTaskProbeAttempts = 0`;
- 42/42 controls and event-derived safety clean;
- >=1 confirmed recipe whose relative operation was linked to an explicitly proven API base, or whose API origin differs from documentation origin with explicit provenance;
- >=1 successful manufacture derived from evidence added by an actual bounded API-reference expansion if an eligible reference link exists in the acquired corpus;
- total LLM cost <= `$0.60` preferred;
- mean LLM cost/success <= `$0.15` preferred.

## Diagnostic targets
Compared with 4D:
- actual API-reference expansion fetches must be >0 if eligible links are present;
- recover both previously demonstrated simple anonymous name APIs (Agify and Genderize) if their request examples remain in acquired evidence;
- form at least one base+relative operation hypothesis when such evidence exists;
- eliminate probes to operations whose documented auth is required;
- eliminate probes where task↔operation correspondence is not independently proven;
- preserve zero validator mismatch, zero standalone URL promotion, and zero documentation-origin fallback;
- aggregate diagnostic counters must equal recomputed per-attempt counts.

If 4E recovers <5/6 R4 capabilities, **do not automatically create 4ER/4ER2**. Attribute the remaining ceiling to reference acquisition, DOM extraction, API-base provenance, auth eligibility, task-operation correspondence, request compilation, or response semantics before another experiment.

## Formal benchmark decision
Decision string:
- `GO_4E_DOM_NATIVE_OPERATION_CORRESPONDENCE`
- otherwise `REASSESS_4E_DOM_NATIVE_OPERATION_CORRESPONDENCE`.
