# Experiment 3Y — Blind End-to-End Capability Manufacture

## Status
Preregistered before implementation.

## Base
Exact base SHA: `a19b930691f7127b2dd15b93dc88fd130c1054dd` (merged 3X).

## Scientific question
Given only a capability intent, input schema, required canonical output schema, build input, and changed replay input — with no provider identity, provider URL, documentation URL, endpoint, field mapping, projection program, or recipe supplied — can MISSING autonomously discover a public supplier, acquire sufficient machine-verifiable documentation, synthesize an executable GET contract plus bounded semantic projection, verify it live twice, persist a recipe, and replay a changed input with zero discovery/documentation/LLM/repair/projection-induction calls?

3Y is the first blind end-to-end manufacture benchmark. It composes the previously isolated layers but may not inject prior experiment provider choices, endpoints, documentation URLs, field mappings, or recipes.

## Information boundary
At benchmark start each case may expose only:
- `case_id`
- natural-language capability intent
- input names and types
- required canonical outputs and types
- build input
- changed replay input
- generic safety/budget rules

The runner must not contain case-specific provider names, domains, documentation URLs, endpoint paths, query/path parameter names, response field names, or projection mappings.

## Blind holdout cases
Exactly three cases are frozen. They are new benchmark capabilities and are not the three 3Q/3V/3X benchmark cases.

### H1 — Country metadata
Capability: `country_metadata`
Intent: given an ISO-style two-letter country identifier, return canonical country code and human-readable country name.
Build input: `{ "country_id": "CR" }`
Replay input: `{ "country_id": "CA" }`
Required outputs: `code`, `name`

### H2 — Pokemon metadata
Capability: `pokemon_metadata`
Intent: given a canonical creature name, return its canonical numeric identifier and canonical name.
Build input: `{ "pokemon_name": "pikachu" }`
Replay input: `{ "pokemon_name": "bulbasaur" }`
Required outputs: `id`, `name`

### H3 — Brewery metadata
Capability: `brewery_metadata`
Intent: given a public brewery identifier, return canonical brewery identifier and brewery name.
Build input: `{ "brewery_id": "madtree-brewing-cincinnati" }`
Replay input: `{ "brewery_id": "avondale-brewing-co-birmingham" }`
Required outputs: `id`, `name`

The benchmark does not assume that any specific provider will satisfy these cases. A case may legitimately REJECT if the bounded discovery/documentation frontier cannot produce an eligible public executable supplier.

## Discovery boundary
Provider discovery must begin from the existing production discovery sources/mechanisms already used by MISSING. No provider seed may be added for a case after preregistration.

The benchmark may use lexical retrieval followed by a bounded LLM reranker, but the LLM may select only IDs from the mechanically produced candidate set. It may not emit URLs or providers outside that set.

## Documentation acquisition
Documentation or machine-readable contracts must be acquired only from mechanically scoped links derived from the selected provider/catalog evidence and bounded standard candidates.

Rules:
- HTTPS only
- public DNS only
- no IP literals
- no credentials
- GET only
- no browser automation or JavaScript execution
- bounded crawl depth/page/contract budget
- cross-registrable-domain documentation rejected unless an existing production verifier explicitly establishes the relationship

## Contract + projection synthesis
A successful manufacture must produce both:
1. an executable request contract grounded in acquired evidence;
2. a bounded semantic projection program grounded in acquired evidence and observed response shape.

The projection language is restricted to the 3X bounded DSL (`FIELD`, `INPUT`, `LOOKUP`, `FIND`) or an exactly equivalent non-Turing-complete production representation with the same safety limits.

No arbitrary JavaScript/Python/shell/eval/regex execution, loops, network calls, filesystem access, arithmetic transforms, or user-defined functions are allowed in projection.

## Live verification
For each successful case:
1. compile request for build input;
2. perform anonymous HTTPS GET;
3. parse JSON;
4. execute bounded projection;
5. mechanically validate canonical output against case semantics;
6. perform a fresh second GET;
7. repeat projection and semantic validation;
8. required projected outputs must agree across both build verifications;
9. persist recipe only after both verifications succeed.

## Replay
Replay uses the frozen changed input for each persisted recipe.

Replay must use only the persisted request contract + persisted projection program. It must perform zero additional:
- provider/catalog discovery calls
- provider reranker calls
- documentation fetches
- contract synthesis calls
- projection/compiler calls
- repairs
- projection induction calls

One fresh anonymous HTTPS GET for executing the persisted recipe is allowed.

## Negative controls
At least 30 active controls must execute through the same production guards used by live paths. They must cover, at minimum:
- out-of-set provider selection
- planner-emitted arbitrary URL
- cross-domain documentation
- non-HTTPS URL
- IP literal/private host
- credential-bearing URL/request
- Authorization/header injection
- non-GET request
- crawl-depth overflow
- documentation/page/contract budget overflow
- unknown/cross-provider evidence IDs
- endpoint mutation
- invented parameter
- invented response field
- missing/extra canonical output
- unsupported projection operator
- unknown input
- ungrounded FIELD/LOOKUP/FIND path
- expression-depth overflow
- FIND scan overflow
- arbitrary executable code
- replay external-call delta nonzero

Synthetic payloads are acceptable only when they invoke the exact same production validator/interpreter/request guards used by the benchmark.

## Safety counters
GO requires zero accepted/sent events for:
- credentials
- Authorization headers
- non-GET requests
- non-HTTPS execution
- private/IP-literal hosts
- unscoped cross-domain documentation
- endpoint mutation
- invented parameters
- invented output fields
- arbitrary code
- ungrounded projection fields
- replay external calls

## Frozen GO gates
All must be true:
1. benchmark starts from exactly the three blind holdout capability specs above;
2. no case-specific provider/domain/doc URL/endpoint/field/projection mapping exists in runner source;
3. all provider selections originate from bounded mechanically produced candidate sets;
4. at least 2 of 3 holdout capabilities manufacture successfully;
5. successful manufactures use at least 2 distinct live providers;
6. every persisted recipe passes first live build verification;
7. every persisted recipe passes fresh second live build verification;
8. at least 2 recipes are persisted;
9. every persisted recipe succeeds on its changed replay input;
10. replay rate is 100%;
11. all replay external-call deltas listed above are zero;
12. every recipe contains non-empty discovery/documentation/contract/projection/verification/recipe fingerprints;
13. all live observations are timestamped;
14. at least 30/30 active negative controls execute and verify rejection through production guards;
15. all safety counters are zero;
16. no gate is weakened after this preregistration commit.

Formal GO string: `GO_BLIND_END_TO_END_CAPABILITY_MANUFACTURE`

Else: `REASSESS_BLIND_END_TO_END_CAPABILITY_MANUFACTURE`

## Interpretation
A GO demonstrates that MISSING can manufacture a previously absent capability end-to-end under bounded discovery and evidence constraints, then amortize the expensive reasoning by replaying a changed input from a persisted deterministic recipe without repeating discovery, documentation acquisition, or LLM synthesis.

A GO does not prove open-world completeness, arbitrary API synthesis, unrestricted schema transformation, or universal supplier availability.