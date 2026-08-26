# Experiment 3Z — Blind Confirmatory End-to-End Manufacture

## Status
Preregistered before execution.

## Frozen stack
- recovery freeze SHA: `6b79298feb6288f843e0c11c04cfbe7cd4a1a794`
- integration-repair reference merge SHA: `9223327b6fbe1f5c80d4db18ff2e8c7137cf5183`
- 3Z may compose the already-implemented recovery/integration mechanisms, but may not tune retrieval scoring, TOP_K, morphology, provider/domain bonuses, DNS/safety guards, crawl budgets, or semantic gates after seeing 3Z outcomes.

## Holdout selection rule
A public pool of nine generic lookup capabilities is frozen:

1. dictionary_word_metadata
2. public_ip_metadata
3. cryptocurrency_asset_metadata
4. postal_code_location
5. isbn_book_metadata
6. open_food_product_metadata
7. vehicle_vin_metadata
8. number_fact_metadata
9. language_code_metadata

For each id compute SHA-256 of `<recovery-freeze-sha>|<capability-id>`, sort ascending, and select the first three. This rule was fixed before provider discovery or benchmark execution.

Selected holdouts:
- `dictionary_word_metadata`
- `public_ip_metadata`
- `cryptocurrency_asset_metadata`

No provider identity, domain, documentation URL, endpoint, parameter name, response-field mapping, or recipe is supplied for any selected holdout.

## Frozen case specifications

### Z1 — Dictionary word metadata
Input: `word` string.
Build: `hello`.
Replay: `world`.
Required canonical outputs: `word`, `definition`.
Semantic requirement: returned word equals input case-insensitively; definition is a non-empty string.

### Z2 — Public IP metadata
Input: `ip` string.
Build: `8.8.8.8`.
Replay: `1.1.1.1`.
Required canonical outputs: `ip`, `country_name`.
Semantic requirement: returned IP equals input; country_name is a non-empty string.

### Z3 — Cryptocurrency asset metadata
Input: `asset_symbol` string.
Build: `BTC`.
Replay: `ETH`.
Required canonical outputs: `symbol`, `name`.
Semantic requirement: returned symbol equals input case-insensitively; name is a non-empty string.

## Information boundary
At start of each case, the system receives only capability intent, canonical input names/types, required canonical outputs/types, build input, replay input, and generic budgets/safety rules.

The runner must contain no case-specific provider names, domains, documentation URLs, endpoint paths, provider parameter names, response field names, or mappings.

## Required pipeline
1. fetch the existing Public APIs catalog through the frozen safe-fetch path;
2. mechanically retrieve the unchanged R2 top-120 frontier;
3. use the existing bounded reranker, selecting only opaque candidate IDs from that frontier;
4. acquire documentation through frozen DNS/HTTPS/same-scope guards and bounded crawl;
5. synthesize an evidence-grounded anonymous GET contract;
6. compile the build request;
7. perform live GET #1;
8. execute bounded 3X projection;
9. semantic validation;
10. perform fresh live GET #2 and revalidate;
11. persist recipe only after both succeed;
12. replay changed input from persisted recipe with no catalog/rerank/docs/synthesis calls.

## Safety
- HTTPS only
- public DNS only
- anonymous GET only
- no credentials or Authorization headers
- no IP-literal execution hosts
- no arbitrary code/eval/scripts
- no invented provider, URL, endpoint, parameter, or output field
- cross-domain documentation rejected unless already allowed by the frozen scope verifier
- replay may make only the fresh execution GET needed by the persisted recipe

## Frozen GO gates
All must be true:
1. selected holdouts exactly match deterministic selection rule;
2. exactly three selected holdouts execute;
3. no case-specific provider/domain/doc/endpoint/mapping seeds exist in runner source;
4. every provider selection originates in the mechanically generated frozen R2 frontier;
5. at least 2/3 capabilities manufacture successfully;
6. successful manufactures use at least two distinct providers;
7. every persisted recipe has two successful fresh build verifications;
8. at least two recipes persist;
9. every persisted recipe succeeds on changed replay input;
10. replay rate is 100%;
11. replay catalog/reranker/documentation/synthesis deltas are all zero;
12. recipes contain non-empty provider-selection, documentation, contract, projection, verification, and recipe fingerprints;
13. all observations are timestamped;
14. all existing 42 active controls execute and verify rejection;
15. all event-derived safety counters are zero;
16. the safety ledger is non-empty and contains real network/guard events;
17. the real 3X interpreter is used for projection;
18. no gate is weakened after this preregistration commit.

Formal GO:
`GO_3Z_BLIND_CONFIRMATORY_END_TO_END_MANUFACTURE`

Else:
`REASSESS_3Z_BLIND_CONFIRMATORY_END_TO_END_MANUFACTURE`

A GO is confirmatory evidence that the frozen MISSING stack can manufacture previously unexposed public capabilities end-to-end and replay persisted recipes on changed inputs. A GO does not prove open-world completeness or universal API compatibility.
