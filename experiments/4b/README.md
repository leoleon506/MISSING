# Experiment 4B — Provenance Request Graph

## Status
Development/recovery experiment over the already-burned 4A workload. No fresh blind holdout is consumed.

## Frozen parent evidence
- 4A-P1 merge SHA: `08cf59875690709990a20ff93f31a8e72c0891a9`
- 4A-P1 run: `33096326116`
- job: `98602086687`
- artifact: `9657603006`
- artifact digest: `sha256:32dbf5eb4fc0a5ac80f51317f03e6f94dfdb066a08d6f23432a8bba51d5a9568`
- report fingerprint: `93ea7f3c62d4d68fe46054a10ddacd3d0f2a1781a4411079399ca4ac072ccc5f`
- ledger fingerprint: `f1b95f26d3ae818b45505114e33fb07a0bf7c22a02363921ae393cf318c5f92f`
- ledger events: `4864`

This file is the **first commit on the 4B branch**.

## Frozen P1 outcome
- 24 cases / 8 families
- 4 successful manufactures / 2 successful families
- 4 distinct providers / 4 recipes
- 4/4 changed-input replay = 100%
- median success latency 49.497s / p90 66.431s
- total LLM cost `$0.2282584`
- mean LLM cost/success `$0.0570646`
- 26 LLM calls
- 2,188 doc fetches / 1,342 spec probes
- 87 active-schema probes, 11 successful 2xx JSON, 76 rejected
- 5 probe-derived contracts / 4 probe-confirmed contracts
- 42/42 controls; event-derived safety clean
- formal result `REASSESS_4A_P1_ACTIVE_SCHEMA_INDUCTION`

## Frozen diagnosis before 4B
P1 proved that response-schema induction can recover real capabilities once a correct safe request exists. It recovered TheCocktailDB, which R7 had been unable to compile because response-field evidence was incomplete, while preserving double verification, 100% zero-cognition replay, 42/42 controls, and clean safety counters.

However P1 failed its explicit engineering recovery gate: only 2/6 capabilities previously demonstrated by R4 were recovered. The dominant pre-probe bottleneck was request induction:
- 150 provider synthesis attempts;
- 111/150 had `request_inventory_count = 0`;
- only 39 attempts produced any request inventory;
- 87 schema probes produced only 11 successful 2xx JSON responses;
- major probe rejection classes included 404, 401, 403, and non-JSON responses.

P1 also exposed a structural provenance defect: a documentation host can be mistaken for an API host. A path extracted from documentation must never be silently joined to the documentation page origin unless that origin is itself explicitly proven to be the API origin for that request.

## 4B hypothesis
A request compiler should not manufacture an API request from loosely co-occurring `origin + path + parameter` facts. It should manufacture only from a **provenance graph** in which every request component is connected by explicit source evidence.

The graph must distinguish:
- documentation resource;
- evidence fragment;
- absolute request example;
- API origin;
- path/template;
- method;
- query/path slot;
- literal;
- OpenAPI server/base path relation;
- request-template node;
- task-input binding.

A safe probe request is eligible only when the graph proves that the selected API origin and selected path belong to the same documented operation or are connected by an explicit specification relation.

## Architecture

```text
provider evidence corpus
        ↓
PROVENANCE REQUEST GRAPH
        ↓
source/evidence nodes
        ↓
absolute-request / OpenAPI-server / endpoint nodes
        ↓
explicit origin ↔ path relation
        ↓
request-template node
        ↓
input/literal binding proof
        ↓
request feasibility + safety
        ↓
P1 SAFE SCHEMA PROBE
        ↓
observed response schema
        ↓
P1 stable-ID projection mapping
        ↓
contract validation
        ↓
2 independent post-mapping live verifications
        ↓
persist recipe
        ↓
changed-input zero-cognition replay
```

## 1. API-origin provenance
The documentation page origin is **not** an API-origin fallback.

An API origin may be accepted only from provider-blind evidence such as:
- an absolute HTTPS request/example URL;
- an absolute HTTPS endpoint URL;
- an OpenAPI/Swagger `servers[].url` relation;
- Swagger 2 `schemes + host + basePath`;
- an absolute URL contained in a code/curl request example;
- an explicit same-source statement tying a base API URL to an operation path.

Relative paths are not executable until connected to a proven API-origin node.

## 2. No arbitrary cross-source stitching
An origin from evidence fragment A and a path from unrelated fragment B may not be combined merely because they came from the same provider crawl.

A join is legal only when at least one explicit relation exists:
- same absolute request example;
- same parsed OpenAPI operation/server relation;
- same evidence fragment with explicit base-URL/path semantics;
- direct same-document anchor/operation relation mechanically established by the extractor.

The graph records all source evidence IDs and URLs supporting every joined component.

## 3. Request templates are immutable proof products
Once a request-template node is emitted, downstream schema probing may not mutate:
- origin;
- method;
- path/template;
- parameter names;
- literals;
- headers;
- authentication state.

P1 active-schema probing remains response-only evidence acquisition.

## 4. Input correspondence remains strict
4B inherits P1's rejection of zero-overlap arbitrary slot binding.

Task inputs may bind only through provider-blind evidence:
- normalized token overlap;
- exact documented placeholder/example relation to the frozen build value;
- exact concrete path-segment relation with nearby input-concept evidence;
- a single generic request slot (`id`, `name`, `q`, `s`, `query`, `search`, `term`, `value`, `input`) for a single-input task.

No provider-, domain-, endpoint-, case-, or workload-specific synonym map is allowed.

## 5. Graph-stable IDs
All nodes and edges receive deterministic IDs derived from their evidence-bearing content. Planner/model decisions, if needed, may reference only stable IDs; no numeric positional selection is allowed.

## 6. Safety and budgets
Unchanged:
- anonymous HTTPS GET only;
- no credentials or auth headers;
- public DNS/private-host checks;
- redirect guards;
- max 8 provider attempts/case;
- max 3 safe schema-probe hypotheses/provider;
- existing documentation/spec acquisition limits;
- fixed model `gpt-4.1-mini-2025-04-14`;
- unchanged 4A semantic validators;
- existing 3X projection execution;
- two post-manufacture live verifications;
- changed-input zero-cognition replay;
- 42 controls.

## 7. Attribution metrics
4B must emit at least:
- `requestGraphNodes`
- `requestGraphEdges`
- `provenApiOrigins`
- `provenRequestTemplates`
- `unboundRelativePaths`
- `crossSourceJoinRejects`
- `documentationOriginFallbacks`
- `requestInventoryZeroAttempts`
- `requestInventoryNonZeroAttempts`
- inherited P1 schema-probe metrics
- inherited replay deltas
- graph/report/ledger fingerprints.

## Engineering recovery gate
4B is an engineering-recovery success only if all of the following hold:
- recover **>=5 of the 6 capabilities already demonstrated by R4**;
- >=5 successful manufactures total;
- >=4 families with success;
- changed-input replay >=95%;
- zero replay cognition/documentation/synthesis/schema-probe deltas;
- zero numeric-index decisions;
- `documentationOriginFallbacks = 0`;
- zero safe probes whose origin/path relation lacks provenance proof;
- zero request mutation from probe response;
- zero probes without complete input influence;
- zero required-auth probes;
- 42/42 controls and event-derived safety clean;
- >=1 confirmed probe-derived recipe whose API origin differs from its documentation source origin and is explicitly provenance-proven;
- total LLM cost <= `$0.60` preferred;
- mean LLM cost/success <= `$0.15` preferred.

Diagnostic target, not a formal pass/fail gate:
- reduce `requestInventoryZeroAttempts` from P1's 111/150 to <=50% of provider synthesis attempts.

If 4B recovers <5/6 of the R4-demonstrated capabilities, **do not automatically proceed to 4BR/4BR2**. Treat the remaining failure as evidence that the unresolved ceiling is outside the request provenance compiler and diagnose before another iteration.

## Original 4A formal decision
The generated benchmark report still uses the original formal 4A gates plus the new provenance integrity gate. Formal result:
- `GO_4B_PROVENANCE_REQUEST_GRAPH`
- otherwise `REASSESS_4B_PROVENANCE_REQUEST_GRAPH`.

A development/recovery GO does not consume or replace a future fresh blind breadth validation.
