# Experiment 5B18 — Executable-Surface Budget Reservation

## Status
Preregistered before workload materialization and before treatment implementation.

## Product north star
MISSING remains a fallback capability resolver for AI agents, not an API directory, generic gateway, catalog search engine, or manual integration framework.

The product target is:

`capability intent -> substitute provider -> executable surface -> verified recipe -> replayable alternate -> runtime continuity`

The commercial hypothesis remains downstream of scientific validation: if MISSING can autonomously maintain verified alternate execution paths, it can later charge per successful capability execution, per successful rescue/failover, and potentially retain routing spread. Revenue is not a 5B18 GO criterion; 5B18 tests one technical moat required for that product: whether a fixed acquisition budget can be allocated more effectively to discover an executable provider surface.

## Frozen base and consumed evidence
- Repository base SHA: `a094a2ac809486c28474b9754a31d076fb8e938b`
- Consumed 5B17 workflow run: `33288945549`
- Consumed 5B17 formal decision: `REASSESS_5B17_CAPABILITY_EQUIVALENT_PROVIDER_RETRIEVAL`
- Consumed 5B17 report fingerprint: `d692a18404cf2af747282efe41b666441a7631452ae222cca7b5867bca615e05`
- Consumed 5B17 engine fingerprint: `69f290d59e616808215eb8f075389e394043da1220b4fa9574a9e395b684ca88`
- Consumed 5B17 artifact ID: `9725364737`
- Consumed 5B17 artifact digest: `sha256:6d4b40916e18c5d153cb9608e22cbd11bf4e087b2722ea62888e278f31dc894b`
- Frozen Public APIs snapshot: `public-apis/public-apis@988c57be4616cc9507fd3e8c34adedba5387f079`
- 5B17 selected exactly 21 candidate providers across seven development capabilities.
- 5B17 outcome: zero qualifying alternates; 20 candidates ended in `contract_reject`; one candidate reached build verification but failed changed-input replay with HTTP 404.
- 5B17 acquisition metrics: 18 selected providers were acquisition-starved, 17 recovery activations were skipped because the eight-fetch provider budget had already been exhausted, and only one recovery activation occurred.

No holdout evidence is consumed.

## Motivation
5B17 improved substitute-provider retrieval: selected candidates were functionally plausible substitutes rather than weakly related catalog entries. However, the acquisition pipeline frequently spent the entire eight-fetch provider budget on ordinary crawling and standard probing before recovery could run.

5B18 freezes the provider selection from 5B17 and changes only the allocation of the existing acquisition budget. It does not rerun provider retrieval, reranking, or capability-equivalence selection.

## Experimental unit
Exactly the 21 providers selected by the valid 5B17 run, preserving:
- case ID and semantic family;
- frozen primary recipe fingerprint and unhealthy-after-5B15 flag;
- 5B17 selected position;
- opaque 5B17 candidate ID;
- exact catalog-visible candidate name;
- exact 5B17 equivalence claim;
- exact claimed input-role set;
- exact claimed output-role set;
- historical 5B17 terminal status.

The exact workload will be materialized in a separate second commit after this preregistration and before treatment implementation.

## Primary hypothesis
For already-selected functionally equivalent providers, reserving half of the unchanged eight-fetch acquisition budget for deterministic executable-surface recovery will convert previously acquisition-starved providers into verified replayable alternate recipes without increasing total per-provider acquisition fetches, reopening provider retrieval, adding provider-specific rules, or relaxing semantic correctness.

## Treatment — fixed 4 + 4 acquisition allocation
The total acquisition budget remains exactly eight fetches per provider.

### Phase A — ordinary documentation crawl
- Maximum ordinary acquisition fetches per provider: **4**.
- Uses the same provider start URL, public-network safety controls, accepted-document link extraction, breadth order, and maximum depth 2 used by the inherited acquisition stack.
- The ordinary phase may stop before four fetches if its queue is exhausted.
- Ordinary crawling is prohibited from borrowing any of the four reserved recovery slots.
- A scheme-only HTTP-to-HTTPS normalization, when allowed by the existing generic safety rule, does not create an extra network request and does not increase the eight-fetch total.

After every ordinary fetch, executable-surface state may be recomputed using the unchanged 5B9 surface detector. Discovery of an executable surface does not authorize a recipe by itself.

### Phase B — reserved executable-surface recovery
If Phase A has not produced an executable surface, up to **4 reserved recovery fetches** become available. These slots cannot be consumed by ordinary crawling.

The recovery candidate pool is constructed deterministically from only:
1. explicit same-provider recovery links already present in Phase-A evidence, using the unchanged 5B9 evidence-derived recovery-link queue and scoring; and
2. the inherited fixed standard machine-contract paths on the provider origin:
   - `/openapi.json`
   - `/swagger.json`
   - `/api/openapi.json`
   - `/v3/api-docs`
   - `/.well-known/openapi.json`

No other guessed endpoint is allowed.

The combined recovery queue is deterministic:
- evidence-derived links retain their frozen 5B9 score;
- fixed standard machine-contract candidates receive a fixed recovery priority equivalent to explicit OpenAPI/Swagger evidence;
- candidates are deduplicated by exact normalized URL;
- tie-breaks are exact normalized URL, then evidence source identity;
- already-fetched URLs are excluded;
- cross-registrable-domain, credential-bearing, mutation-like, private-network, unsafe-scheme, and noisy candidates remain rejected by inherited safety policy.

Recovery fetches stop immediately when an executable surface is detected or when four reserved fetches have been consumed.

### Phase C — unchanged compilation and verification
After acquisition, 5B18 reuses the same inherited 5B14 request-local semantics, provenance-neutral binding, deterministic request ranking, compiler, projection, and development semantic verifier.

A qualifying alternate still requires:
1. different registrable domain from the frozen primary;
2. a valid compiled recipe;
3. first successful live build execution and semantic verification;
4. second successful live build execution and semantic verification;
5. equality of required outputs between build confirmation executions;
6. successful changed-input replay using the unchanged semantic verifier;
7. zero discovery/reranking/documentation/synthesis/recovery work during replay.

## Identity resolution
5B18 performs no provider retrieval.

The frozen Public APIs snapshot may be fetched exactly once solely to resolve each frozen opaque 5B17 candidate identity. Resolution scans catalog entries and accepts an entry only when:
- catalog candidate name exactly equals the frozen candidate name; and
- the frozen candidate-ID hash suffix exactly equals the deterministic hash suffix of `case_id | catalog_name | catalog_link` under the same hashing rule that produced the 5B17 frontier identity.

No lexical scoring, semantic scoring, broad retrieval, reranking, fallback substitution, or replacement provider is permitted during identity resolution. Resolution must be unique. An unresolved or multiply-resolved identity is rejected rather than substituted.

## Frozen budgets
- capabilities: exactly 7;
- frozen candidate providers: exactly 21;
- catalog identity-resolution fetches: exactly 1;
- broad provider retrieval calls: 0;
- capability-equivalence reranker calls: 0;
- secondary provider reranker calls: 0;
- new provider selection calls: 0;
- manual provider substitutions: 0;
- ordinary acquisition fetches: maximum 4/provider;
- reserved recovery fetches: maximum 4/provider;
- total acquisition fetches: maximum 8/provider;
- documentation depth: maximum 2;
- body/document size: unchanged 4 MiB limit;
- provider attempts: exactly the frozen 21 identities, unless an identity cannot be uniquely resolved or is generically safety-ineligible;
- persisted alternates: maximum 1 per capability;
- build verification: exactly 2 successful live executions required;
- changed-input replay: exactly 1 successful replay required;
- holdout accesses: 0;
- total LLM cost: <= USD 3.00;
- mean LLM cost per qualifying alternate: <= USD 0.20 when at least one alternate qualifies.

## Required instrumentation
The report must expose at least:
- exact frozen workload fingerprint;
- exact 21-candidate identity set and resolution results;
- catalog identity-resolution fetch count;
- broad retrieval, equivalence-reranker, secondary-reranker, and new-selection call counts;
- candidate attempt order by capability;
- ordinary fetch count per provider;
- reserved recovery eligibility/activation per provider;
- reserved recovery candidate queue fingerprint per provider;
- reserved recovery fetch count per provider;
- reserved recovery URLs represented only by fingerprints in formal summary artifacts where practical;
- ordinary-reserve borrowing violations;
- total acquisition fetches per provider;
- max total acquisition fetches;
- executable-surface state before reserved recovery;
- executable-surface state after each reserved recovery fetch;
- providers becoming executable specifically because of reserved recovery;
- recovery stop reason;
- synthesis calls and terminal rejection stage;
- build verification outcomes;
- changed-input replay outcomes;
- qualifying alternate recipes;
- semantic families represented by qualifying alternates;
- unhealthy primary coverage;
- whether unhealthy-primary coverage came through a provider that became executable because of reserved recovery;
- replay cognitive/discovery deltas;
- auth-like rendered requests;
- wrong-task probes;
- provider/case/family hardcoding counts;
- total and mean LLM costs;
- holdout accesses.

## GO criteria
Every criterion is required:
1. integrity and preregistration checks pass;
2. exact frozen 21-candidate workload fingerprint matches the post-preregistration workload file;
3. exactly seven frozen development capabilities are represented;
4. exactly 21 frozen selected provider identities are represented;
5. Public APIs snapshot is exactly `988c57be4616cc9507fd3e8c34adedba5387f079`;
6. catalog identity-resolution fetches = 1;
7. all uniquely resolvable attempted providers come only from the frozen 21 identities;
8. candidate attempt ordering matches frozen selected-position ordering within each capability;
9. broad provider retrieval calls = 0;
10. capability-equivalence reranker calls = 0;
11. secondary provider reranker calls = 0;
12. new/manual provider selection or substitution calls = 0;
13. ordinary acquisition fetches <=4 for every provider;
14. ordinary-reserve borrowing violations = 0;
15. reserved recovery fetches <=4 for every provider;
16. total acquisition fetches <=8 for every provider;
17. recovery ordering nondeterminism violations = 0;
18. at least one provider becomes executable specifically because of reserved recovery;
19. at least 2 capabilities obtain qualifying alternate recipes;
20. qualifying alternates span at least 2 semantic families;
21. every persistently unhealthy frozen primary obtains a qualifying alternate recipe;
22. unhealthy-primary coverage includes reserved-recovery lineage showing that its selected alternate became executable because of reserved recovery;
23. every qualifying alternate uses an independent registrable domain from its primary;
24. every qualifying alternate completed two successful live build verifications;
25. every qualifying alternate completed successful changed-input replay;
26. replay catalog/retrieval/reranker/documentation/synthesis/recovery deltas = 0;
27. auth-like rendered requests = 0;
28. wrong-task probe attempts = 0;
29. runtime provider URL/name hardcoding count = 0;
30. runtime case/family hardcoding count = 0;
31. total LLM cost <= USD 3.00;
32. if qualifying alternates >0, mean LLM cost per qualifying alternate <= USD 0.20;
33. holdout accesses = 0.

If every criterion passes:

`GO_5B18_EXECUTABLE_SURFACE_BUDGET_RESERVATION`

Otherwise:

`REASSESS_5B18_EXECUTABLE_SURFACE_BUDGET_RESERVATION`

A 5B18 GO does not retroactively alter 5B14–5B17. A GO would establish that MISSING can use a fixed acquisition budget more effectively to manufacture replayable alternate recipes. It would authorize a later preregistered runtime-failover development experiment over frozen primary+alternate pairs. Holdout remains prohibited until a separate preregistered transition explicitly authorizes it.

## Prohibitions
- no rerun of 5B17 provider retrieval;
- no new provider discovery or substitution;
- no provider-, host-, endpoint-, case-, family-, query-key-, build-value-, replay-value-, or expected-answer-specific rule;
- no recovery URL other than an explicit same-provider evidence link or inherited fixed standard machine-contract path;
- no more than four ordinary acquisition fetches;
- no more than four reserved recovery fetches;
- no more than eight total acquisition fetches/provider;
- no widening budgets after observing results;
- no semantic-verifier relaxation;
- no counting executable-surface discovery, HTTP 2xx, or build-only success as an alternate;
- no post-hoc GO reinterpretation;
- no holdout access.
