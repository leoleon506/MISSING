# MISSING Experiment 3V — Semantic Provider Retrieval

## Status
Preregistered before implementation and before benchmark execution.

## Motivation
3U demonstrated bounded acquisition of live OpenAPI/Swagger contracts from human-facing documentation in all three frozen cases, including non-standard HTML/config mechanisms, but **0/3 acquired contracts were semantically relevant** to the capability intents. The failure occurred upstream of contract acquisition: the lexical catalog ranking selected providers that were topically adjacent but functionally wrong.

3V isolates this provider-selection layer.

## Frozen scientific question
Given only a capability intent and a large generic public API catalog, can MISSING use deterministic broad retrieval followed by a bounded LLM semantic reranker over opaque candidate IDs to select providers whose documentation yields a live, semantically relevant OpenAPI/Swagger operation, without allowing the model to invent providers, URLs, endpoints, paths, credentials, or code?

## Frozen source substrate
The only provider catalog is the live raw README of `public-apis/public-apis`:

`https://raw.githubusercontent.com/public-apis/public-apis/master/README.md`

No APIs.guru, MCP Registry, web search, GitHub search, Common Crawl, provider-specific dictionaries, manually seeded provider names, spec URLs, operation paths, or case-to-provider mappings may be used.

## Frozen semantic cases
Exactly the same three cases and build/replay inputs from 3R–3U are retained.

### A — repository metadata
Intent: identify a public source-code repository operation returning canonical full name, star count, and primary language.
Build: `owner=openai`, `repo=openai-python`
Replay: `owner=nodejs`, `repo=node`
Required outputs: `full_name`, `stargazers_count`, `language`

### B — fantasy ability-score metadata
Intent: identify a tabletop fantasy role-playing ability-score operation returning canonical short index, abbreviated name, and full display name.
Build: `ability_index=cha`
Replay: `ability_index=str`
Required outputs: `index`, `name`, `full_name`

### C — currency metadata
Intent: identify a currency metadata operation returning canonical currency code and human-readable currency name.
Build: `currency_id=USD`
Replay: `currency_id=EUR`
Required outputs: `code`, `name`

The semantic validators from 3R remain unchanged.

## Frozen two-stage provider retrieval

### Stage 1 — deterministic broad retrieval
Parse the live Public-APIs catalog generically. For each case, score all entries using the unchanged lexical-affinity mechanism from 3U over only:
- API name;
- description;
- category;
- case intent;
- input names;
- required output leaf names.

Retain the top **80** entries per case. No provider-specific aliases, bonuses, exclusions, or manual reordering are allowed.

### Stage 2 — LLM semantic reranking
The LLM receives:
- case intent;
- generic descriptions of inputs and required outputs;
- an array of at most 80 candidates containing only:
  - opaque `candidate_id`;
  - catalog name;
  - catalog description;
  - category;
  - auth declaration;
  - HTTPS declaration.

The LLM does **not** receive catalog URLs or domains.

It must return a strict structured response containing exactly:
- `case_id`;
- an ordered list of at most **12 opaque candidate IDs**;
- a short semantic rationale per selected candidate.

The model may select only IDs present in the supplied candidate set. Unknown IDs reject the entire rerank response and allow at most **one repair**. The model may not emit or influence URLs, hosts, endpoints, operation paths, headers, credentials, source code, or crawl rules.

## Frozen downstream acquisition
Only the top 12 LLM-selected provider IDs may enter the **unchanged 3U acquisition mechanisms and budgets**:
- same catalog documentation URL as originally parsed;
- same registrable-domain boundary;
- max crawl depth = 2;
- max HTML pages = 8/provider;
- max contract candidates = 12/provider;
- same static href/src/data/config extraction;
- same five standard OpenAPI paths;
- no JavaScript/browser execution;
- GET only, no credentials;
- same contract validity predicate.

No provider outside the reranked 12 may be crawled for that case.

## Frozen relevance and execution pipeline
Every acquired contract enters the unchanged 3Q exact-operation scorer. A case is **relevantly acquired** only if an exact GET operation has both positive input evidence and positive required-output evidence.

Relevant candidates then enter the unchanged typed binding compiler, live semantic execution, recipe persistence, and changed-input replay pipeline used in 3U.

The provider-reranking LLM may not participate after provider selection. Typed binding uses the existing separate procurement planner contract.

## Frozen comparison baseline
3V records, for every case:
- the original 3U-style top-20 lexical provider names/IDs;
- the semantic reranker top-12 IDs;
- whether each reranked selection came from lexical ranks 1–20 or 21–80;
- acquired/relevant/live outcome per selected provider.

This comparison is observational only and does not alter GO gates.

## Frozen replay
For every persisted recipe, replay must have:
- catalog fetch calls = 0;
- provider reranker calls = 0;
- documentation crawl calls = 0;
- contract acquisition/spec fetch calls = 0;
- procurement planner calls = 0;
- supplier selection calls = 0;
- projection induction calls = 0.

Only the persisted recipe may execute the changed frozen input.

## Frozen active negative controls
All controls must execute production predicates, not synthetic constants.

1. unknown opaque provider candidate ID rejected;
2. duplicate provider candidate ID rejected;
3. more than 12 reranked provider IDs rejected;
4. provider ID not in broad top-80 rejected;
5. reranker-emitted URL field rejected by strict schema;
6. reranker-emitted host field rejected by strict schema;
7. reranker-emitted operation path rejected by strict schema;
8. cross-registrable-domain crawl rejected;
9. HTTP downgrade rejected;
10. private/IP host rejected;
11. crawl depth >2 rejected;
12. HTML page budget >8 rejected;
13. contract budget >12 rejected;
14. invalid/non-OpenAPI document rejected;
15. OpenAPI without operations rejected;
16. relevant-operation predicate rejects zero input evidence;
17. relevant-operation predicate rejects zero output evidence;
18. JavaScript execution remains unavailable.

## Frozen formal GO gates
Formal decision is `GO_SEMANTIC_PROVIDER_RETRIEVAL` only if all are true:

- Public-APIs catalog fetched live and >=200 entries parsed;
- zero case-to-provider/spec/operation mappings;
- broad deterministic retrieval produces exactly <=80 candidates/case and does not use provider-specific rules;
- semantic reranker returns a valid bounded selection for all 3 cases with <=1 repair/case;
- >=2 of 3 cases acquire at least one live OpenAPI/Swagger contract from reranked providers;
- acquired contracts span >=2 distinct catalog providers;
- >=2 of 3 cases are **relevantly acquired** with an exact GET having positive input and output evidence;
- at least one relevant provider selected by the semantic reranker had deterministic lexical rank **>20**, demonstrating semantic recovery beyond the prior 3U crawl frontier;
- >=2 cases reach live semantic execution and persist recipes from >=2 distinct providers;
- 100% of persisted recipes replay successfully on changed frozen inputs;
- all replay catalog/reranker/crawl/acquisition/spec/procurement/selection/projection counters are zero;
- every persisted recipe has non-empty contract, acquisition-trace, provider-selection, verification-trace, and recipe fingerprints;
- all 18 negative controls execute and reject;
- unknown/duplicate/out-of-set provider IDs accepted = 0;
- credentials supplied = 0;
- cross-domain/private/IP/HTTP-downgrade accepts = 0;
- arbitrary JavaScript/code executed = 0.

Otherwise the formal decision is `REASSESS_SEMANTIC_PROVIDER_RETRIEVAL`.

No threshold, case, catalog, crawl budget, or candidate count may be relaxed after benchmark execution.

## Interpretation boundary
A GO would demonstrate that semantic provider retrieval can recover useful suppliers from a broad generic catalog beyond the lexical top-20 frontier, then hand them to the already-bounded documentation-contract acquisition and execution pipeline.

It would not demonstrate unrestricted web discovery, universal API discovery, paid/authenticated procurement, arbitrary browser automation, economic routing, universal schema adaptation, or autonomous payment/revenue.