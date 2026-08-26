# MISSING Experiment 3T — Multi-Substrate Live Supply Acquisition

## Status
Preregistered before implementation and before benchmark execution.

## Motivation
3S showed that APIs.guru can expose multiple semantically compatible suppliers while still failing to provide live usable supply. 3T tests whether MISSING can improve supply coverage by combining independent discovery substrates and building a small live-supply index before procurement.

## Frozen question
Can MISSING combine multiple independent public discovery substrates, verify which discovered supply is live now, and resolve at least two of the same frozen semantic capability requests such that at least one successful supplier comes from a substrate other than APIs.guru, while also verifying live MCP supply independently?

## Frozen substrates
Exactly three discovery substrates are allowed:

1. **APIs.guru OpenAPI registry**
   - `https://api.apis.guru/v2/list.json`
   - same 3Q/3R/3S generic retrieval limits and parsers.

2. **Official MCP Registry**
   - `https://registry.modelcontextprotocol.io/v0.1/servers?version=latest&limit=100`
   - only public remote `streamable-http` or `sse` entries with literal HTTPS URLs and no required headers are eligible.
   - MCP supply is used to prove substrate diversity and live tool availability; it is not required to satisfy the three frozen OpenAPI semantic cases.

3. **Public-APIs catalog**
   - raw README from the public `public-apis/public-apis` GitHub repository default branch.
   - the catalog contributes candidate documentation/origin URLs only.
   - no provider-specific API URL, spec URL, operation path, or capability mapping may be hardcoded.
   - for each retained catalog entry, MISSING may derive the HTTPS origin and probe only the following frozen standard machine-readable contract paths:
     - `/openapi.json`
     - `/swagger.json`
     - `/api/openapi.json`
     - `/v3/api-docs`
     - `/.well-known/openapi.json`
   - at most 12 catalog entries per case and at most 5 standard-path probes per retained entry.

## Frozen semantic cases
Exactly the same semantic cases and build/replay inputs as 3R/3S are retained:

A. repository metadata: `openai/openai-python` -> replay `nodejs/node`; required `full_name`, `stargazers_count`, `language`.

B. fantasy ability score: `cha` -> replay `str`; required `index`, `name`, `full_name`.

C. currency metadata: `USD` -> replay `EUR`; required `code`, `name`.

The same frozen semantic validators from 3R apply.

## APIs.guru path
APIs.guru candidates are produced using the unchanged registry scorer, live contract parser, operation scorer, and per-case bounds from 3Q/3S. Candidate supplier verification reuses the bounded typed binding compiler and live JSON semantic verification from 3S.

## Public-APIs path
1. Fetch the live raw catalog.
2. Parse table rows generically into `(name, description, auth, https, cors, link)` records.
3. Deterministically rank records against each capability case using only case text versus name/description/category text.
4. Retain at most 12 entries per case.
5. Only entries declaring HTTPS support are eligible.
6. Resolve the catalog link and derive its HTTPS origin.
7. Probe only the frozen five standard OpenAPI paths above, with public-DNS, no redirects, no credentials, bounded timeout/size.
8. A probe counts only if it returns a parseable OpenAPI/Swagger contract with at least one GET operation.
9. The resulting contract enters exactly the same operation scoring, typed binding, live execution, semantic validation, recipe, and replay pipeline as an APIs.guru contract.

No fallback URL patterns, provider names, custom path rules, or hand-authored specs may be added after execution.

## MCP live-supply path
The MCP portion reuses the conservative readiness mechanism demonstrated in 3F:

- fetch registry;
- retain literal HTTPS public remote endpoints without required headers;
- inspect at most 30 servers;
- connect and list tools;
- candidate tool must have valid input schema, zero required parameters, affirmative `readOnlyHint=true`, no destructive hint, explicit read signal, and no mutation signal;
- execute at most 8 such tools with `{}` only;
- a server counts as live MCP supply only if the safe tool succeeds twice on two fresh connections with stable tool presence.

No non-empty arguments, credentials, or mutating tools may be executed.

## Unified live-supply index
Every verified supply record persists:

- `substrate`: `apis_guru`, `public_apis`, or `mcp_registry`;
- provider/server identity discovered from that substrate;
- live endpoint/remote URL fingerprint;
- contract/tool-schema fingerprint;
- verification timestamp;
- verification status;
- capability evidence summary;
- verification trace fingerprint.

Semantic-case recipes additionally persist the typed bindings and output projection needed for zero-discovery replay.

## Replay
For any successful semantic-case recipe:

- registry/catalog/MCP discovery calls = 0;
- spec probing/fetch calls = 0;
- planner calls = 0;
- supplier-selection calls = 0;
- output-projection induction calls = 0;
- only the persisted live recipe is executed with the frozen replay input.

## Frozen active negative controls
All controls must execute real predicates used by the benchmark.

1. non-HTTPS OpenAPI execution base rejected;
2. IP-literal execution host rejected;
3. auth-required OpenAPI operation rejected;
4. absent operation rejected;
5. undeclared binding rejected;
6. missing required binding rejected;
7. missing DIRECT input rejected;
8. SPLIT out-of-range rejected;
9. unsupported transform rejected;
10. semantic identity mismatch rejected;
11. empty recipe fingerprint evidence rejected;
12. Public-APIs catalog non-HTTPS entry rejected;
13. Public-APIs probe outside frozen standard path set rejected;
14. non-OpenAPI probe response rejected;
15. MCP endpoint with required/unresolved headers rejected;
16. MCP tool with required input rejected;
17. MCP tool without affirmative readonly hint rejected;
18. MCP tool with mutation signal rejected.

## Frozen GO gates
Formal decision is `GO_MULTI_SUBSTRATE_LIVE_SUPPLY_ACQUISITION` only if all of the following hold:

- all three discovery substrates are fetched successfully;
- APIs.guru registry has >=1,000 entries;
- Public-APIs catalog yields >=200 parsed API entries;
- MCP registry yields >=20 records;
- zero case-to-provider/spec/operation mappings exist;
- at least 2 semantic cases reach live semantic success and persist recipes;
- selected semantic suppliers span at least 2 distinct providers;
- **at least one successful semantic supplier originates from `public_apis` rather than APIs.guru**;
- at least 1 successful case demonstrates rejection of an earlier supplier before later live success;
- 100% of persisted semantic recipes replay successfully on different frozen inputs;
- all replay discovery/spec/planner/selection/projection counters are zero;
- at least 2 MCP servers from distinct namespaces are independently verified live via safe zero-arg readonly tools;
- unified live-supply index contains verified records from at least 2 independent substrates;
- at least 4 total verified live-supply records exist across all substrates;
- all successful semantic recipes and all verified MCP records have non-empty evidence fingerprints;
- all 18 frozen negative controls are executed and rejected;
- credentials supplied = 0;
- unsafe/mutating MCP tools executed = 0;
- MCP tools with required parameters executed = 0;
- non-empty MCP argument executions = 0;
- host-policy violations accepted = 0;
- arbitrary code executed = 0.

Otherwise the formal decision is `REASSESS_MULTI_SUBSTRATE_LIVE_SUPPLY_ACQUISITION`.

No threshold may be relaxed after execution.

## Interpretation boundary
A GO would show that MISSING can improve live-supply coverage by combining independent public discovery ecosystems and that at least one real semantic capability can be sourced outside APIs.guru while MCP contributes independently verified live supply.

It would not establish unrestricted open-web discovery, universal API discovery, arbitrary documentation scraping, paid procurement, credential acquisition, economic optimization, universal MCP argument synthesis, or autonomous payment/revenue.