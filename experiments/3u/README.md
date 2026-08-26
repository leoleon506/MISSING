# MISSING Experiment 3U — Autonomous Contract Acquisition from Documentation

## Status
Preregistered before implementation and before benchmark execution.

## Motivation
3T showed that adding more discovery catalogs does not by itself solve REST supply acquisition. Public-APIs exposed many relevant documentation URLs, but standard fixed OpenAPI paths usually failed to yield a usable machine-readable contract. 3U isolates this acquisition step.

## Frozen scientific question
Given only a documentation URL discovered from a generic public API catalog, can MISSING autonomously locate a live OpenAPI/Swagger contract for the same API through a bounded same-site documentation crawl, without provider-specific URLs, paths, regexes, host mappings, or search-engine rescue?

## Frozen source substrate
The only source catalog is the live raw README of `public-apis/public-apis`:

`https://raw.githubusercontent.com/public-apis/public-apis/master/README.md`

No APIs.guru records, MCP records, Google/Bing/web search, GitHub code search, Common Crawl, provider-specific knowledge base, or manually seeded spec URLs may be used for contract acquisition.

## Frozen semantic cases
Exactly the same three semantic capability cases and build/replay values from 3R/3S/3T are retained:

### A — repository metadata
Build: `owner=openai`, `repo=openai-python`
Replay: `owner=nodejs`, `repo=node`
Required outputs: `full_name`, `stargazers_count`, `language`

### B — fantasy ability-score metadata
Build: `ability_index=cha`
Replay: `ability_index=str`
Required outputs: `index`, `name`, `full_name`

### C — currency metadata
Build: `currency_id=USD`
Replay: `currency_id=EUR`
Required outputs: `code`, `name`

The same semantic validators from 3R remain frozen.

## Frozen catalog ranking
For each case, MISSING parses the catalog generically and ranks entries using only lexical affinity between case intent/input/output terms and catalog name/description/category.

- retain top 20 entries per case;
- only entries declaring HTTPS support are crawl-eligible;
- no provider name bonus, exact provider keyword, host allowlist, or case-to-catalog mapping;
- no manual reordering after execution.

## Frozen documentation crawl budget
For each retained catalog entry:

- start only from the catalog-provided HTTPS documentation URL;
- maximum crawl depth = 2 from the start page;
- maximum fetched HTML pages = 8 per catalog entry;
- maximum candidate contract fetches = 12 per catalog entry;
- maximum response body = 4 MiB;
- timeout = 12 seconds per fetch;
- GET only;
- no credentials, cookies, Authorization headers, browser automation, JavaScript execution, shell, plugins, or arbitrary code;
- redirects are not automatically followed; one safe HTTPS canonical redirect may be accepted only under the existing 3S path-preservation policy.

## Frozen navigation scope
Every crawled HTML page and candidate contract URL must remain within the same **registrable domain** as the original catalog documentation URL. Subdomain changes are allowed only within that registrable domain.

IP literals, localhost, private/non-public DNS, HTTP downgrade, credential-bearing URLs, data/file/javascript schemes, and cross-registrable-domain navigation are rejected.

## Frozen contract acquisition mechanisms
The crawler may discover candidate contract URLs only through the following generic mechanisms.

### 1. HTML link attributes
Inspect same-site values from:
- `href`
- `src`
- `data-url`
- `data-spec-url`
- `data-swagger-url`

Candidate URLs receive positive evidence when their URL/path contains generic machine-contract terms such as `openapi`, `swagger`, `api-docs`, `spec`, or extensions `.json`, `.yaml`, `.yml`.

### 2. HTML/text configuration references
Without executing JavaScript, scan fetched HTML/text for absolute or relative quoted URL-like strings adjacent to generic configuration tokens:
- `url:` / `url=`
- `spec-url`
- `specUrl`
- `swaggerUrl`
- `openapi`
- `api-docs`

Only syntactically extractable URL/path strings are allowed; no generated JavaScript or DOM execution.

### 3. Swagger UI / ReDoc evidence
Generic static references in HTML to Swagger UI, ReDoc, Stoplight, OpenAPI Explorer, or RapiDoc may raise the priority of nearby candidate spec URLs, but do not themselves count as a contract.

### 4. Standard same-origin paths
The five 3T standard paths remain allowed as one acquisition mechanism:
- `/openapi.json`
- `/swagger.json`
- `/api/openapi.json`
- `/v3/api-docs`
- `/.well-known/openapi.json`

They do not receive provider-specific bonuses.

### 5. Same-site documentation links
HTML links whose anchor text or URL indicates API reference/docs/developer/openapi/swagger may be queued for crawl up to the frozen depth/page limit.

## Contract validity
A candidate counts as an acquired contract only if the live response parses as OpenAPI 3.x or Swagger/OpenAPI 2.0 and contains at least one operation.

For each acquired contract MISSING persists:
- originating catalog entry;
- documentation start URL;
- acquisition mechanism;
- crawl depth;
- contract URL;
- contract fingerprint;
- operation count;
- acquisition trace fingerprint.

## Capability relevance check
Acquiring arbitrary OpenAPI files is insufficient.

For each case, acquired contracts enter the unchanged deterministic operation scorer from 3Q. A case is **relevantly acquired** only if at least one exact GET operation has:
- positive input evidence; and
- positive required-output evidence.

No LLM is used for contract URL discovery. A planner may be used only after a live contract has already been acquired and scored, for the existing typed binding compilation stage.

## Optional downstream execution
To ensure acquisition is useful rather than decorative, a relevant acquired contract may enter the unchanged 3R typed-binding + 3S live-execution + semantic-validation pipeline.

No provider substitution outside the catalog/crawl results is allowed.

## Frozen replay
If a semantic recipe is persisted:
- catalog fetches during replay = 0;
- documentation crawl calls during replay = 0;
- contract acquisition calls during replay = 0;
- spec fetches during replay = 0;
- planner calls during replay = 0;
- projection induction during replay = 0.

Replay uses only the persisted recipe on the frozen different input.

## Frozen active negative controls
Every control must exercise production predicates.

1. cross-registrable-domain crawl URL rejected;
2. HTTP downgrade rejected;
3. IP-literal URL rejected;
4. non-public/private DNS rejected;
5. crawl depth >2 rejected;
6. HTML page budget >8 rejected;
7. contract candidate budget >12 rejected;
8. disallowed URL scheme rejected;
9. credential-bearing URL rejected;
10. candidate JSON without OpenAPI/Swagger marker rejected;
11. OpenAPI marker without operations rejected;
12. candidate URL lacking live fetch evidence does not count as acquired;
13. empty contract fingerprint does not count;
14. same-site ordinary HTML link without docs/spec evidence is not promoted as a contract candidate;
15. planner-emitted contract URL is rejected as an acquisition source;
16. arbitrary JavaScript execution path is rejected/not used.

## Frozen GO gates
Formal decision is `GO_AUTONOMOUS_DOCUMENTATION_CONTRACT_ACQUISITION` only if all are true:

- Public-APIs catalog fetched live and >=200 entries parsed;
- zero case-to-provider/spec/operation mappings;
- >=2 of the 3 frozen cases acquire at least one live OpenAPI/Swagger contract from documentation crawling;
- those >=2 acquired contracts originate from >=2 distinct catalog providers;
- >=2 cases are **relevantly acquired** with at least one exact GET operation having positive input and output evidence;
- at least one successful acquisition is found through an HTML/config/documentation-link mechanism rather than one of the five fixed standard paths;
- every counted contract has non-empty contract and acquisition-trace fingerprints;
- at least one relevant acquired contract reaches live semantic execution and persists a recipe;
- every persisted recipe replays successfully on the frozen changed input;
- replay catalog/crawl/acquisition/spec/planner/projection counters are all zero;
- all 16 frozen negative controls are executed and rejected;
- cross-domain accepts = 0;
- HTTP downgrades accepted = 0;
- private/IP hosts accepted = 0;
- credentials supplied = 0;
- redirects followed outside safe canonical policy = 0;
- arbitrary JavaScript/code executed = 0.

Otherwise the formal decision is `REASSESS_AUTONOMOUS_DOCUMENTATION_CONTRACT_ACQUISITION`.

No threshold or case may be changed after benchmark execution.

## Interpretation boundary
A GO would demonstrate bounded autonomous acquisition of machine-readable contracts from human-facing documentation discovered in a generic catalog, including at least one acquisition that was not found by a fixed standard path.

It would not demonstrate unrestricted web search, arbitrary web crawling, universal API contract discovery, browser/JS execution, paid or authenticated API procurement, economic routing, or universal integration.