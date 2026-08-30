# Experiment 5B17 — Capability-Equivalent Provider Retrieval

## Status
Preregistered before implementation.

## Product north star
MISSING is not intended to become an API directory, generic gateway, catalog search engine, or code-generation wrapper. Its target product is a **fallback capability resolver for AI agents**:

`capability intent -> independently discoverable provider -> verified executable recipe -> replayable capability -> alternate/failover path`

The commercial hypothesis is intentionally separated from the scientific GO decision: if MISSING can resolve and maintain executable alternatives without provider-specific integration work, it can later charge a small recurring fee or per-success resolution/failover fee, and potentially retain a spread on routed capability execution. 5B17 does not use revenue as an experimental success criterion; it tests a technical moat required for that business model: autonomous retrieval of functionally equivalent substitute providers.

## Frozen base and consumed evidence
- Repository base SHA: `e0be1ee904141604b977ac2402585d3da88fc497`
- Consumed 5B14 workflow run: `33283645154`
- Consumed 5B14 report fingerprint: `ba1ed1e8aa6152568734096a39396bc43d46de1d0290d1b40ec901d5dba27e43`
- Consumed 5B15 workflow run: `33286417146`
- Consumed 5B15 report fingerprint: `05c8ad2520262eb232b99db545dd83a865eab077991a77d09078129500e2ad32`
- Consumed 5B16 workflow run: `33287855843`
- Consumed 5B16 formal decision: `REASSESS_5B16_VERIFIED_RECIPE_REDUNDANCY_ACQUISITION`
- Consumed 5B16 report fingerprint: `bcc0ccfbd5ec6faf039f6beace09469e6c3c4adab74b8286d1762bbf69dccfc5`
- Consumed 5B16 result: 0 qualifying alternates from 25 distinct frozen post-primary tail identities
- Frozen Public APIs snapshot: `public-apis/public-apis@988c57be4616cc9507fd3e8c34adedba5387f079`
- Development semantic verifier remains unchanged from the 5A/5B14 development workload.

No holdout evidence is consumed.

## Motivation
5B16 falsified the hypothesis that useful redundancy was already hidden in the tail of the original 5B14 provider selection. The frozen tail contained functionally unrelated services (for example, candidates related only by weak lexical/category overlap) and produced zero qualifying alternate recipes. Therefore the unresolved bottleneck is **substitute-provider retrieval**, not retry policy and not runtime failover.

5B17 asks whether MISSING can deliberately retrieve providers that are plausible substitutes for the same capability, while still preventing provider-specific seeds, manual substitutions, host rules, or holdout peeking.

## Experimental unit
Exactly the seven persisted 5B14 development capabilities represented in the frozen 5B16 workload. Each unit consists of:
- case ID and semantic family;
- frozen capability intent from the unchanged development case definition;
- frozen input role names;
- frozen required output role names;
- frozen build input;
- frozen changed-input replay input;
- frozen primary provider identity and primary recipe fingerprint;
- frozen unhealthy-after-5B15 flag.

The exact seven-unit workload will be materialized in a separate post-preregistration frozen file before treatment implementation.

## Primary hypothesis
If candidate retrieval is optimized for **functional substitutability** rather than generic lexical/provider relevance, then MISSING can retrieve and compile independently hosted providers that satisfy the same input/output capability contract, including a replacement for every persistently unhealthy frozen primary, without manually naming substitute providers.

## Treatment: two-stage substitute retrieval

### Stage A — deterministic broad frontier
For each frozen capability:
1. Parse the exact frozen Public APIs snapshot.
2. Run the existing deterministic semantic broad retrieval (`recoveredBroadRetrieveR2`) over the full catalog.
3. Freeze the top 120 candidate frontier produced by that algorithm.
4. Exclude any candidate whose registrable domain equals the frozen primary provider's registrable domain.
5. Preserve the original broad-frontier candidate IDs and lexical ranks; exclusion does not re-number candidates.

No provider may enter Stage B unless it is in this deterministic top-120 frontier.

### Stage B — capability-equivalence reranker
A new generic capability-equivalence reranker receives only:
- frozen case ID;
- capability intent;
- exact allowed input role names;
- exact required output role names;
- opaque candidate IDs from the Stage-A frontier;
- catalog-visible candidate name, description, category, authentication marker, HTTPS marker, and CORS marker.

It does **not** receive primary provider names, primary URLs, known substitutes, endpoints, operation paths, historical winners, expected answers, build values, replay values, or holdout information.

The reranker must select at most 12 candidates and, for every selected candidate, emit:
- candidate ID;
- concise functional-equivalence reason;
- the exact subset of supplied input roles it believes the provider can consume;
- the exact subset of supplied output roles it believes the provider can provide.

A selected candidate is eligible for acquisition only when its claimed input-role set exactly covers all frozen input roles and its claimed output-role set exactly covers all frozen required output roles. Invented role names, missing roles, duplicate candidate IDs, candidates outside the frontier, or more than 12 selections invalidate the reranker response and permit at most one deterministic repair call.

This equivalence claim is a retrieval filter only; it is never accepted as proof of capability.

## Verification after retrieval
Eligible candidates are attempted in the exact reranker order. For each candidate:
1. Require independent registrable domain from the primary.
2. Use the same public-network safety guards and documentation acquisition limits used by 5B14.
3. Use the same 5B14 request-local semantic utility, provenance-neutral binding, deterministic request ranking, global beam, compiler, projection machinery, and semantic verifier.
4. Require successful build execution and semantic verification.
5. Require a second successful live build execution with equal required outputs.
6. Require successful changed-input replay with the unchanged semantic verifier.
7. Persist at most the first qualifying alternate recipe per capability.

A catalog description, LLM equivalence claim, successful HTTP response, or successful build without changed-input replay never counts as an alternate.

## Frozen budgets
- capabilities: exactly 7;
- catalog snapshot fetches: exactly 1;
- deterministic broad retrieval calls: exactly 7;
- broad frontier size: maximum 120 per capability;
- equivalence reranker: maximum 1 initial + 1 repair call per capability;
- selected equivalent candidates: maximum 12 per capability;
- provider attempts: maximum 12 per capability / 84 total;
- persisted alternates: maximum 1 per capability / 7 total;
- documentation pages per provider: same frozen 5B14 limit of 8;
- documentation depth: same frozen 5B14 limit of 2;
- response/document byte budget: same frozen 5B14 limit of 4 MiB;
- live build verification: exactly 2 successful executions required before persistence;
- changed-input replay: exactly 1 successful replay required before persistence;
- stochastic provider reranking outside the capability-equivalence reranker: 0;
- manual provider seeds: 0;
- provider URLs or provider names in treatment source: 0;
- case/family-specific treatment branches: 0;
- holdout accesses: 0;
- total LLM cost budget: USD 3.00;
- mean LLM cost per qualifying alternate: <= USD 0.20 when at least one alternate qualifies.

## Required instrumentation
The formal report must expose at least:
- exact frozen capability count and workload fingerprint;
- frozen catalog snapshot commit;
- catalog fetch count;
- broad retrieval calls;
- broad frontier count per capability and frontier fingerprints;
- primary-domain exclusions;
- reranker initial/repair calls;
- reranker selected candidate counts;
- equivalence-role claim validation failures;
- selected-candidate-outside-frontier violations;
- selected-candidate-primary-domain violations;
- selected-candidate ordering fingerprint and nondeterminism violations;
- attempted provider count and exact attempt order;
- documentation/spec fetches;
- synthesis calls/repairs;
- rejection stage and reason per attempted candidate;
- qualifying alternate recipes;
- capabilities and semantic families with qualifying alternates;
- unhealthy primary count and unhealthy primaries covered;
- independent-domain violations;
- primary/alternate recipe fingerprint collisions;
- double-live-verification failures;
- changed-input replay successes/failures;
- replay catalog/reranker/documentation/synthesis/recovery deltas;
- auth-like rendered requests;
- wrong-task probe attempts;
- runtime provider URL/name hardcoding count;
- runtime case/family hardcoding count;
- total and mean LLM cost;
- holdout accesses.

## GO criteria
All criteria are required:
1. integrity/preregistration checks pass;
2. exactly seven frozen development capabilities are represented;
3. frozen workload fingerprint matches the post-preregistration materialization;
4. Public APIs snapshot is exactly `988c57be4616cc9507fd3e8c34adedba5387f079`;
5. catalog snapshot fetches = 1;
6. deterministic broad retrieval calls = 7;
7. every broad frontier is deterministic and contains <=120 candidates;
8. every selected candidate belongs to its frozen Stage-A frontier;
9. primary-domain selected-candidate violations = 0;
10. selected-candidate-outside-frontier violations = 0;
11. selected-candidate-ordering nondeterminism violations = 0;
12. equivalence reranker calls stay within the frozen budget;
13. every attempted candidate passed exact input-role and output-role equivalence-claim coverage;
14. maximum 12 attempted providers per capability and 84 total;
15. no secondary provider reranker or manual provider selection path is used;
16. at least 2 capabilities obtain a qualifying alternate recipe;
17. qualifying alternates span at least 2 semantic families;
18. **every persistently unhealthy primary from frozen 5B15 obtains a qualifying alternate recipe**;
19. every qualifying alternate uses an independent registrable domain from its primary;
20. primary/alternate recipe-fingerprint collision violations = 0;
21. every qualifying alternate completed two successful build verifications;
22. every qualifying alternate completed successful changed-input replay;
23. replay discovery/cognitive deltas = 0;
24. auth-like rendered requests = 0;
25. wrong-task probe attempts = 0;
26. runtime provider URL/name hardcoding count = 0;
27. runtime case/family hardcoding count = 0;
28. total LLM cost <= USD 3.00;
29. if qualifying alternates > 0, mean LLM cost per qualifying alternate <= USD 0.20;
30. holdout accesses = 0.

If any criterion fails:

`REASSESS_5B17_CAPABILITY_EQUIVALENT_PROVIDER_RETRIEVAL`

If every criterion passes:

`GO_5B17_CAPABILITY_EQUIVALENT_PROVIDER_RETRIEVAL`

A 5B17 GO does not retroactively alter 5B14, 5B15, or 5B16. It establishes that MISSING can autonomously retrieve and manufacture substitute capability providers. Only after that result may a later development experiment preregister deterministic runtime failover over frozen primary+alternate recipe pairs. Holdout access remains prohibited until the development sequence explicitly reaches a preregistered holdout transition.

## Prohibitions
- no manually named substitute provider;
- no provider-, host-, endpoint-, case-, family-, query-key-, build-value-, replay-value-, or expected-answer-specific treatment rule;
- no provider outside deterministic Stage-A top 120;
- no passing primary provider identity to the equivalence reranker;
- no primary-domain candidate allowed into the attempted set;
- no widening beyond 12 selected candidates after seeing results;
- no relaxing the exact input/output role-coverage claim requirement after results;
- no relaxing semantic verification;
- no counting build-only success as redundancy;
- no counting catalog/LLM equivalence claims as verified capability;
- no runtime failover claim from this experiment;
- no post-hoc GO reinterpretation;
- no holdout access.
