# Experiment 5B16 — Verified Recipe Redundancy Acquisition

## Status
Preregistered before implementation.

## Frozen base
- Repository base SHA: `a6c1f471e2067108fa929cff52d6245051d687e0`
- Consumed 5B14 workflow run: `33283645154`
- Consumed 5B14 report fingerprint: `ba1ed1e8aa6152568734096a39396bc43d46de1d0290d1b40ec901d5dba27e43`
- Consumed 5B14 strict successes: 7
- Consumed 5B14 persisted primary recipes: 7
- Consumed 5B15 workflow run: `33286417146`
- Consumed 5B15 formal decision: `REASSESS_5B15_DETERMINISTIC_REPLAY_RESILIENCE`
- Consumed 5B15 report fingerprint: `05c8ad2520262eb232b99db545dd83a865eab077991a77d09078129500e2ad32`
- Consumed 5B15 final replay: 6/7
- Consumed 5B15 persistent retry recoveries: 0
- External Public APIs catalog snapshot: `public-apis/public-apis@988c57be4616cc9507fd3e8c34adedba5387f079`

No holdout evidence is consumed.

## Motivation
5B14 demonstrated seven strict persisted primary recipes across six semantic families, including a documentary-derived new `media` family. The valid 5B15 resilience experiment then showed that bounded deterministic retry does not restore continuity when a previously valid primary recipe persistently returns an empty structured body: the same frozen recipe, request, and changed input failed three times before semantic verification.

The unresolved production question is therefore upstream of runtime failover: MISSING currently stores only one strict recipe per capability. Runtime failover cannot be evaluated scientifically until a second, independently verified recipe exists.

5B16 tests whether MISSING can acquire **verified redundancy** without reopening provider selection. It is explicitly not the runtime failover experiment. A valid 5B16 GO is a prerequisite for a later failover experiment.

## Frozen candidate universe
For each of the seven 5B14 successful capabilities:

1. Take the exact provider-selection queue persisted by 5B14.
2. Restrict it to the original frozen provider-attempt budget: selected positions 1 through 8 only.
3. Find the position of the primary provider that produced the persisted 5B14 recipe.
4. Keep only candidates **after** that primary position. These are candidates the original engine selected but did not attempt because it stopped at the first strict success.
5. Preserve their original order.
6. Collapse only exact duplicate provider identities within a case when their persisted `url_fingerprint` values are identical, preserving the first occurrence.

This yields a post-primary frozen tail of 26 raw queue entries / 25 distinct URL identities across the seven successful capabilities. The exact tail will be materialized in a separate post-preregistration frozen workload file before implementation.

No provider ranked outside the original first eight selected positions is eligible. No candidate before the original winning primary is retried. No new reranking, broad retrieval, provider search, category expansion, or manual provider insertion is permitted.

## Catalog identity resolution
5B14 did not persist the cleartext start URLs for providers it never attempted. It did persist candidate IDs and URL fingerprints.

5B16 may perform exactly one identity-resolution fetch of the frozen Public APIs snapshot `988c57be4616cc9507fd3e8c34adedba5387f079`. This fetch is not provider discovery: the snapshot may only be used to resolve a frozen tail candidate when all of the following match:

- the frozen candidate's persisted URL fingerprint;
- the deterministic candidate hash suffix derived from the frozen case ID, frozen candidate name, and resolved URL;
- the frozen candidate ID's persisted broad-rank prefix.

An entry that cannot reproduce the frozen identity is unresolved and cannot be substituted. No other catalog entry may enter the workload.

## Data-driven unhealthy primary set
The set of primaries requiring continuity repair is defined mechanically from the consumed 5B15 result: every frozen primary recipe whose **final** 5B15 replay remained unsuccessful after the preregistered retry policy.

The implementation may not branch on provider name, host, case ID, family, endpoint, query key, or expected answer to define this set. It must consume the frozen workload metadata derived from the 5B15 result.

## Primary hypothesis
If MISSING continues only through the already-selected but previously unattempted provider tail, using the same acquisition, synthesis, compilation, semantic verification, and changed-input replay semantics as 5B14, then it can manufacture at least one **independent strict replayable alternate recipe** for every persistently unhealthy primary and can demonstrate redundancy across more than one capability/family without reopening provider discovery.

## Treatment
For each frozen 5B14 primary capability, in frozen post-primary candidate order:

1. Resolve the candidate start URL only through the frozen catalog identity-resolution rule above.
2. Use the same public-network safety guards, documentation acquisition limits, recovery logic, and request-synthesis stack used by 5B14.
3. Use the same 5B14 request-local semantic utility, provenance-neutral binding, deterministic request ranking, and global beam behavior for synthesis within that already-frozen provider.
4. Attempt the candidate's build input.
5. Require the same two successful live build verifications used for primary recipe persistence.
6. Require the same semantic projection verifier as the frozen development workload.
7. Require changed-input replay success for the candidate before it can count as an alternate recipe.
8. Require the alternate provider's registrable domain to differ from the primary provider's registrable domain.
9. Require the alternate recipe fingerprint to differ from the primary recipe fingerprint.
10. Persist at most the first qualifying alternate recipe per capability, then stop that capability's tail traversal.

Candidates may be rejected for documentation, synthesis, compilation, network, safety, build, semantic, confirmation, or replay failure. Rejection never broadens the frozen queue.

## Frozen budgets
- primary capabilities: exactly 7;
- raw post-primary frozen tail entries: exactly 26;
- distinct post-primary URL identities after per-case exact-fingerprint deduplication: exactly 25;
- maximum eligible provider positions: original selected positions <= 8 only;
- maximum alternate provider attempts: 25 total;
- maximum persisted alternates: 7, one per primary capability;
- documentation pages per provider: same frozen 5B14 limit (8);
- documentation depth: same frozen 5B14 limit (2);
- response/document byte budget: same frozen 5B14 limit (4 MiB);
- build verification: 2 successful live executions before persistence;
- changed-input replay: 1 successful replay required before alternate qualifies;
- stochastic provider reranker calls: 0;
- broad provider retrieval/ranking calls: 0;
- new provider selection calls: 0;
- holdout access: 0;
- total LLM cost budget: USD 3.00;
- mean LLM cost per qualifying alternate: <= USD 0.15 when at least one alternate qualifies.

## Required instrumentation
The report must expose at least:
- frozen primary count;
- raw frozen tail count;
- distinct frozen tail URL identity count;
- frozen tail fingerprint;
- frozen unhealthy-primary set fingerprint;
- frozen Public APIs snapshot commit;
- catalog identity-resolution fetches;
- resolved frozen candidate identities;
- unresolved frozen candidate identities;
- candidate attempts in exact frozen order;
- any candidate-order mutation violations;
- any candidate-outside-frozen-tail violations;
- any candidate-position-over-8 violations;
- exact-duplicate identities skipped;
- acquisition/documentation fetches;
- synthesis calls and repairs;
- provider reranker calls;
- broad retrieval calls;
- per-candidate rejection stage/reason;
- qualifying alternate recipes;
- capabilities with qualifying alternates;
- semantic families with qualifying alternates;
- unhealthy primaries covered by a qualifying alternate;
- independent-domain violations;
- primary/alternate recipe-fingerprint collision violations;
- double-live-verification failures;
- alternate changed-input replay successes/failures;
- replay discovery/cognitive deltas;
- auth-like rendered requests;
- wrong-task probe attempts;
- runtime provider/case/family hardcoding count in treatment source;
- total LLM cost and mean cost per qualifying alternate;
- holdout accesses.

## GO criteria
All must be true:
1. integrity/preregistration checks pass;
2. exactly seven frozen 5B14 primaries are represented;
3. frozen tail is exactly 26 raw entries / 25 distinct URL identities;
4. frozen tail fingerprint matches the post-prereg materialized workload;
5. frozen unhealthy-primary set matches the consumed 5B15 result;
6. frozen catalog snapshot commit is exactly `988c57be4616cc9507fd3e8c34adedba5387f079`;
7. catalog identity-resolution fetches = 1;
8. every attempted provider belongs to the frozen post-primary tail;
9. candidate order mutation violations = 0;
10. candidate outside-tail violations = 0;
11. candidate position-over-8 violations = 0;
12. provider reranker calls = 0;
13. broad provider retrieval/ranking calls = 0;
14. new provider-selection calls = 0;
15. at least 2 capabilities obtain a qualifying alternate recipe;
16. qualifying alternates span at least 2 semantic families;
17. **every persistently unhealthy primary from the frozen 5B15 result obtains a qualifying alternate recipe**;
18. every qualifying alternate has a different registrable domain from its primary;
19. primary/alternate recipe-fingerprint collision violations = 0;
20. every qualifying alternate completed two successful build verifications;
21. every qualifying alternate completed successful changed-input replay;
22. replay discovery/cognitive deltas = 0;
23. auth-like rendered requests = 0;
24. wrong-task probe attempts = 0;
25. runtime provider/case/family hardcoding count in treatment source = 0;
26. total LLM cost <= USD 3.00;
27. if qualifying alternates > 0, mean LLM cost per qualifying alternate <= USD 0.15;
28. holdout accesses = 0.

If any criterion fails, the formal decision is:

`REASSESS_5B16_VERIFIED_RECIPE_REDUNDANCY_ACQUISITION`

If every criterion passes, the formal decision is:

`GO_5B16_VERIFIED_RECIPE_REDUNDANCY_ACQUISITION`

A 5B16 GO does not retroactively change 5B14 or 5B15; both remain historical REASSESS results. A 5B16 GO authorizes the next development experiment to preregister deterministic runtime failover over frozen primary+alternate recipe pairs. It does **not** authorize holdout access yet.

## Prohibitions
- no provider-, host-, endpoint-, case-, family-, query-key-, or expected-answer-specific treatment rules;
- no providers outside the frozen post-primary first-eight tail;
- no reranking or re-selection of providers;
- no manual insertion of a known substitute provider;
- no widening to selected positions 9–12;
- no mutation of the seven frozen primary recipes;
- no relaxation of semantic verification;
- no alternate recipe that shares the primary registrable domain;
- no counting a build-only recipe without changed-input replay as redundancy;
- no runtime failover claim from this experiment;
- no post-hoc change to redundancy breadth or unhealthy-primary coverage gates;
- no holdout access.
