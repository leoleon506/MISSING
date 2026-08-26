# Experiment 3W — Documentation-to-Executable Contract Synthesis

## Status

**Preregistered before implementation and before any live 3W benchmark.**

Base commit: `6486da5b575246afb5381ff902a693045a837061` (the exact `main` SHA used by the completed 3V run).

Experiment 3V ended in `REASSESS_SEMANTIC_PROVIDER_RETRIEVAL`: semantic reranking was valid for all three frozen cases, but the 3U OpenAPI acquisition stage obtained zero contracts. 3W isolates the next question: can MISSING manufacture a narrow, executable read-only HTTP contract directly from human-facing documentation when no machine-readable contract was acquired?

## Scientific question

> Given only a frozen provider documentation entry selected by 3V, a frozen capability intent, and bounded live documentation pages, can MISSING synthesize a minimal evidence-grounded GET contract, verify it live, and persist a changed-input replayable recipe without inventing undocumented hosts, paths, parameters, output fields, credentials, or code?

This is a **contract synthesis** experiment, not provider discovery. Provider selection is frozen from the completed 3V artifact and may not be changed after preregistration.

## Frozen cases

The semantic cases and build/replay inputs remain exactly those used in 3R–3V:

1. `public_source_code_repository_metadata`
   - build input: `openai/openai-python`
   - replay input: `nodejs/node`
   - required output leaves: `full_name`, `stargazers_count`, `language`
   - frozen 3V provider: `Code.gov`
   - frozen catalog start: `https://code.gov`
   - 3V opaque candidate ID: `p004_5746ab3901`

2. `fantasy_role_playing_ability_score_metadata`
   - build input: `cha`
   - replay input: `str`
   - required output leaves: `index`, `name`, `full_name`
   - frozen 3V provider: `Dungeons and Dragons (Alternate)` / Open5e
   - frozen catalog start: `https://open5e.com/`
   - 3V opaque candidate ID: `p014_6fec1446bc`

3. `currency_metadata`
   - build input: `USD`
   - replay input: `EUR`
   - required output leaves: `code`, `name`
   - frozen 3V provider set, in 3V reranker order:
     1. Frankfurter — `https://www.frankfurter.app/docs` — `p019_611fbbfa8b`
     2. Currency-api — `https://github.com/fawazahmed0/currency-api#readme` — `p010_236230d4c5`
     3. Amdoren — `https://www.amdoren.com/currency-api/` — `p006_773cdab283`
     4. CurrencyScoop — `https://currencyscoop.com/api-documentation` — `p003_27f6223956`
     5. Exchangerate.host — `https://exchangerate.host?utm_source=Github&utm_medium=Referral&utm_campaign=Public-apis-repo-Best-sellers` — `p016_1dae4bc72f`
     6. National Bank of Poland — `http://api.nbp.pl/en.html` — `p022_0fdec33072`
     7. CurrencyBeacon — `https://currencybeacon.com/` — `p011_1434d08808`
     8. CurrencyFreaks — `https://currencyfreaks.com/` — `p012_e3c788ce5b`

No other provider may be added. A provider requiring credentials for the relevant operation may be rejected but may not be supplied credentials.

## Inputs the synthesizer may see

For each frozen provider, the synthesizer may receive only:

- frozen capability intent;
- frozen input names and required output leaf names;
- provider opaque ID;
- bounded documentation evidence fetched from the frozen catalog start and same-site documentation crawl;
- URLs that occur literally in fetched documentation evidence.

The model may not receive an OpenAPI contract discovered by another substrate, a provider-specific knowledge base, search-engine results, Common Crawl, GitHub code search, MCP registry data, or manually supplied endpoint mappings.

## Documentation crawl

For each provider:

- GET only;
- maximum depth: **2**;
- maximum HTML/text pages: **8**;
- maximum response body: **4 MiB**;
- per-request timeout: **12 seconds**;
- HTTPS required for execution; an HTTP catalog documentation start may be fetched only if it immediately redirects canonically to HTTPS under the same registrable domain and preserves path/query;
- documentation links may remain within the same registrable domain;
- GitHub documentation starts may follow raw/blob links only within the same GitHub repository or its `raw.githubusercontent.com` representation;
- no browser automation or JavaScript execution;
- no cookies, credentials, Authorization headers, API keys, OAuth, shell, plugins, or arbitrary code.

Persist for every documentation fetch: requested URL, resolved URL, UTC verification timestamp, HTTP status, content type, body SHA-256 fingerprint, and rejection/error state.

## Manufactured micro-contract

The LLM may emit at most one candidate micro-contract per provider plus at most one repair after deterministic contract validation.

Strict schema:

- `case_id`
- `provider_candidate_id`
- `decision`: `COMPILE` or `REJECT`
- if `COMPILE`:
  - `method`: exactly `GET`
  - `base_url`: HTTPS origin
  - `path_template`
  - `path_bindings`: map from documented path placeholder to one frozen input field
  - `query_bindings`: map from documented query key to one frozen input field or a documented literal constant
  - `output_paths`: map from each required output leaf to a documented JSON field/path
  - `evidence_ids`: nonempty list of documentation evidence IDs supporting the host/path/parameter/output claim

The model may not emit headers, credentials, POST bodies, JavaScript, code snippets, alternate providers, or arbitrary URLs outside documentation evidence.

## Deterministic evidence gate

A synthesized contract is statically eligible only if all of the following are mechanically grounded in fetched evidence before execution:

1. provider ID exactly matches the provider currently being evaluated;
2. `case_id` exactly matches the frozen case;
3. method is `GET`;
4. `base_url` origin appears literally in cited evidence or is the origin of a literal documented absolute request URL;
5. `path_template` appears literally in cited evidence, allowing only normalization of a concrete example value into a single `{input}` placeholder;
6. every path/query parameter name appears literally in cited evidence;
7. every required output leaf or its exact declared JSON path leaf appears literally in cited evidence associated with a response/example/schema context;
8. all cited evidence IDs exist in the fetched evidence set;
9. execution URL is public HTTPS and passes the existing DNS/private-network boundary;
10. no credentials are required by the synthesized operation.

If any item fails, the contract is rejected before live execution.

## Live verification

For every statically eligible contract:

1. compile the build input into the manufactured contract;
2. perform one bounded public GET;
3. require HTTP success and parseable JSON;
4. deterministically project all required output paths;
5. require semantic validation under the same frozen case validator used by 3R–3V;
6. immediately perform a **fresh confirmation GET** of the same build request;
7. require the same required output values on the fresh confirmation;
8. persist a recipe only after both build verifications succeed.

Each live fetch persists timestamp, final URL, HTTP status, content type, body SHA-256, and a verification trace fingerprint over the actual observations.

## Replay

Every persisted recipe is replayed with the frozen changed input. Replay must use **zero**:

- documentation fetches;
- LLM calls;
- provider-selection calls;
- contract synthesis/repair calls;
- projection induction calls.

Replay performs only deterministic request compilation, public GET, stored projection, and semantic validation.

## Active negative controls

At least **22/22** controls must be actively executed and verified:

1. wrong `case_id`;
2. wrong provider candidate ID;
3. POST method;
4. undocumented base URL;
5. undocumented path;
6. invented path parameter;
7. invented query parameter;
8. invented output field;
9. empty evidence list;
10. unknown evidence ID;
11. evidence from another provider;
12. credential-bearing URL;
13. Authorization/header request field;
14. HTTP execution URL;
15. IP-literal host;
16. private/non-public DNS;
17. cross-registrable-domain documentation link;
18. crawl depth > 2;
19. HTML page budget > 8;
20. JavaScript execution path;
21. arbitrary code/shell path;
22. replay attempts any LLM/documentation/synthesis call.

Synthetic controls are acceptable only when they call the same validator/rejection functions used by the live benchmark path. The report must persist concrete evidence for each control.

## Safety counters

The report must derive these counters from actual rejection/acceptance events, not hard-coded constants:

- credentials_supplied
- authorization_headers_sent
- non_get_requests_sent
- undocumented_hosts_accepted
- undocumented_paths_accepted
- invented_parameters_accepted
- invented_output_fields_accepted
- cross_domain_docs_accepted
- private_ip_accepted
- http_execution_accepted
- arbitrary_code_executed

All must equal zero for GO.

## GO criteria

Formal GO string: `GO_DOCUMENTATION_TO_EXECUTABLE_CONTRACT_SYNTHESIS`.

GO requires **all** of the following:

- frozen provider population unchanged from this preregistration;
- at least **2 of 3 capability families** produce an evidence-grounded manufactured micro-contract;
- at least **2 distinct providers** produce successful live semantic recipes;
- at least **1 successful recipe** must come from a provider for which 3V acquired no OpenAPI contract (all frozen providers satisfy this historical condition, but the report must record the provenance);
- every successful recipe has two successful build verifications;
- every successful recipe replays successfully on changed input;
- replay rate = **100%**;
- all persisted recipe, documentation, evidence, synthesis, and live-verification fingerprints are nonempty;
- all documentation/live observations have UTC timestamps;
- replay control deltas are zero;
- **22/22 active controls** execute and verify;
- every safety counter above is zero.

Otherwise the formal decision is `REASSESS_DOCUMENTATION_TO_EXECUTABLE_CONTRACT_SYNTHESIS`.

The thresholds may not be reduced after a run.

## Interpretation boundaries

A GO would show bounded conversion of human-readable documentation into reusable executable GET capability recipes for multiple unrelated frozen families. It would **not** establish arbitrary-web understanding, authenticated API support, write operations, browser/JavaScript documentation execution, or open-world provider discovery.

A REASSESS must preserve the failure layer: documentation acquisition, evidence extraction, static grounding, live execution, semantic validation, fresh confirmation, or changed-input replay. A green GitHub Actions workflow is not scientific GO.