# Experiment 3Y — Blind End-to-End Capability Manufacture

## Status
Preregistered before implementation.

## Exact base
`a19b930691f7127b2dd15b93dc88fd130c1054dd` (merged Experiment 3X).

## Scientific question
Starting only from a new capability contract, build input, replay input, and required canonical outputs — with no provider name, provider URL, documentation URL, endpoint, request template, response mapping, or recipe supplied — can MISSING autonomously discover a provider, acquire provider documentation, compile a bounded executable request plus semantic projection, verify it live twice, persist a recipe, and replay a changed input with zero provider-discovery, documentation, or LLM/compiler calls?

3Y measures the integrated product behavior. It must not count success obtained by preselecting a provider or by injecting endpoint/response mappings into the case definition.

## Holdout capability population
Exactly three capability families are frozen before implementation. None is one of the three historical 3Q–3X families (`public_source_code_repository_metadata`, `fantasy_role_playing_ability_score_metadata`, `currency_metadata`).

### H1 — `book_isbn_metadata`
Build input: `{ "isbn": "9780140328721" }`
Replay input: `{ "isbn": "9780439554930" }`
Required canonical outputs:
- `title`: non-empty string
- `publish_date`: non-empty string

Intent: given an ISBN, return canonical book title and publication-date text from a public read-only API.

### H2 — `uk_postcode_metadata`
Build input: `{ "postcode": "SW1A1AA" }`
Replay input: `{ "postcode": "M11AE" }`
Required canonical outputs:
- `postcode`: non-empty string semantically matching the requested postcode after whitespace/case normalization
- `country`: non-empty string
- `latitude`: finite number
- `longitude`: finite number

Intent: given a UK postcode, return normalized postcode, country, latitude, and longitude from a public read-only API.

### H3 — `ip_geolocation_metadata`
Build input: `{ "ip": "8.8.8.8" }`
Replay input: `{ "ip": "1.1.1.1" }`
Required canonical outputs:
- `ip`: string equal to requested IP
- `city`: non-empty string
- `country`: non-empty string

Intent: given a public IPv4 address, return canonical IP, city, and country from a public read-only API.

## Blindness constraints
The executable case definitions may contain only:
- case id;
- natural-language intent;
- input names;
- build input;
- replay input;
- required canonical output names and semantic validator type.

They must contain zero:
- provider names;
- domains or URLs;
- documentation paths;
- endpoint paths;
- request parameter names other than the canonical input names;
- provider-native response field names;
- provider rankings or IDs;
- expected provider identities.

A mechanical source-level blindness assertion must verify these constraints.

## Provider discovery
Provider discovery starts from the live `public-apis/public-apis` catalog used by prior retrieval experiments.

For each holdout case:
1. fetch the catalog once for the run;
2. perform bounded lexical retrieval (`top_k <= 80`);
3. expose only opaque candidate IDs plus catalog name/description/category/auth/HTTPS metadata to the reranker;
4. allow the LLM reranker to select at most 12 candidates;
5. resolve selected IDs mechanically back to catalog entries.

No provider URL, documentation URL, endpoint, or response mapping may be supplied to the reranker.

## Documentation acquisition
For each selected HTTPS provider, MISSING may crawl only the provider start URL from the catalog and same-registrable-domain documentation links.

Limits per provider:
- max depth: 2;
- max documentation pages: 6;
- max body: 4 MiB per page;
- GET only;
- no credentials or Authorization headers;
- no IP literals/private hosts;
- no browser, JavaScript execution, shell, or arbitrary code.

Canonical HTTP→HTTPS redirects on the same host/path are allowed for documentation only. Execution redirects are forbidden.

## End-to-end compiler
For a selected provider with documentation evidence, the compiler receives only:
- holdout capability contract and build input;
- opaque provider candidate ID and provider name;
- bounded documentation evidence;
- the frozen request/projection schemas below.

It may return only `COMPILE` or `REJECT`.

A COMPILE contains:
- `method: GET`;
- HTTPS `base_url`;
- `path_template`;
- path/query bindings from `$input.<name>` or documented literals;
- canonical outputs expressed with the bounded 3X projection DSL (`FIELD`, `INPUT`, `LOOKUP`, `FIND`);
- cited evidence IDs;
- reason.

The compiler may not emit headers, credentials, arbitrary code, JavaScript, regex execution, shell, filesystem operations, loops, joins, arithmetic transforms, or network calls.

Maximum one initial compile and one repair per attempted provider.

## Mechanical grounding and execution gate
Before any live execution, production guards must reject:
- provider/case mismatch;
- missing/unknown/cross-provider evidence;
- undocumented HTTPS origin or path;
- invented path/query parameters;
- missing required outputs or extra canonical outputs;
- unsupported DSL operators;
- unknown inputs;
- ungrounded provider response path tokens;
- expression depth > 4;
- path segments > 12;
- FIND scans > 500 items;
- headers/Authorization/credentials;
- non-GET or non-HTTPS execution;
- IP literals/private hosts;
- endpoint mutation after compilation;
- arbitrary code/script fields.

## Live manufacture
A holdout case succeeds only if one autonomously selected provider:
1. yields a mechanically valid grounded COMPILE;
2. executes anonymous HTTPS GET successfully;
3. projects provider JSON into the canonical contract;
4. passes the case semantic validator;
5. performs a fresh second GET;
6. passes the semantic validator again;
7. returns the same canonical build output across both fresh observations;
8. persists a recipe containing request, projection, evidence/provenance fingerprints, and both verification traces.

Only the first successfully verified provider per capability is persisted.

## Replay
Each persisted recipe is replayed with the frozen changed input.

Replay may perform exactly one provider GET and deterministic projection/semantic validation. Replay must perform zero:
- catalog fetches;
- provider reranker calls;
- provider selection calls;
- documentation fetches;
- compiler calls;
- compiler repairs;
- projection induction calls.

## Negative controls
At least 26 active controls must call the same production validators/interpreter/request guards used by live manufacture. Controls must cover provider-ID integrity, evidence integrity, request mutation, auth/credentials, non-HTTPS/private hosts, input binding, projection grounding, missing/extra outputs, unsupported DSL, expression/path/FIND limits, arbitrary code fields, and replay external-call deltas.

## Formal decision
GO string:
`GO_BLIND_END_TO_END_CAPABILITY_MANUFACTURE`

Else:
`REASSESS_BLIND_END_TO_END_CAPABILITY_MANUFACTURE`

## Frozen GO gates
All must be true:
1. exact base SHA matches the merged 3X base above;
2. source-level blindness assertion passes for all 3 holdout cases;
3. exactly 3 holdout families run;
4. live public provider catalog contains at least 200 entries;
5. valid bounded provider rerank for all 3 cases;
6. at least 3 provider candidates total have usable documentation evidence;
7. all 3 holdout families produce a grounded COMPILE from autonomously selected providers;
8. all 3 pass first live semantic verification;
9. all 3 pass fresh second live semantic verification;
10. exactly 3 recipes are persisted;
11. persisted recipes use at least 2 distinct provider domains;
12. all 3 changed-input replays succeed;
13. replay rate is 100%;
14. every replay discovery/documentation/LLM/compiler delta is zero;
15. every recipe/evidence/program/body/trace fingerprint is non-empty;
16. all live observations are timestamped;
17. at least 26/26 active negative controls execute and verify rejection;
18. all safety counters are zero.

No GO gate may be weakened after this preregistration commit.

## Interpretation
A GO demonstrates that MISSING can manufacture three previously untested read-only capabilities end-to-end from a capability contract alone, then reuse the manufactured recipes without rediscovery or LLM calls.

A GO does not establish arbitrary-web discovery, write-capability synthesis, authenticated API handling, browser automation, arbitrary schema transformation, or universal API compatibility.
