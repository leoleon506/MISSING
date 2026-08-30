# Experiment 5B19 — Evidence-Qualified Executable Request Induction

## Status
Preregistered before workload materialization and before treatment implementation.

## Product north star
MISSING remains a fallback capability resolver for AI agents. It is not an API directory, generic API gateway, catalog search engine, or manual integration framework.

Target product chain:

`capability intent -> equivalent provider -> trustworthy executable request -> verified recipe -> replayable alternate -> runtime continuity -> paid rescue/failover`

The commercial hypothesis remains deliberately non-gating: if MISSING can autonomously manufacture and maintain verified alternate execution paths, it can later charge per successful capability execution, per successful rescue/failover, and potentially retain routing spread where provider terms allow it. 5B19 tests a technical prerequisite for that product, not revenue itself.

## Frozen base and consumed evidence
- Repository base SHA: `c34be729b6f67dc460ed669ebb8fdf534589fddb`
- Consumed 5B18 workflow run: `33289802363`
- Consumed 5B18 formal decision: `REASSESS_5B18_EXECUTABLE_SURFACE_BUDGET_RESERVATION`
- Consumed 5B18 report fingerprint: `abba5714033f7bb77b221ee75b5c1f14c99da18ea7405ff2b2551d8ec63c0e48`
- Consumed 5B18 engine fingerprint: `3e460cd7c7eb7fbdba73553ba987b35ed3871d674c493db93464c47d5734cea1`
- Consumed 5B18 artifact ID: `9725615296`
- Consumed 5B18 artifact digest: `sha256:6442acb2b5120294c8c7bdadf835ab3374317bc906767af1f1db2f7a3b08dd35`
- Frozen 5B18 workload fingerprint: `c1c58704416e27de80348868d7bde518bfc4696ef05faa187616c05f89f2b3bb`
- Frozen Public APIs snapshot: `public-apis/public-apis@988c57be4616cc9507fd3e8c34adedba5387f079`

5B18 established all of the following without holdout access:
- exact 21 frozen providers were attempted in frozen order;
- provider retrieval, equivalence reranking, secondary reranking, new selection, and manual substitution were all zero;
- acquisition respected 4 ordinary + 4 reserved recovery fetches, maximum 8/provider;
- 19 providers activated reserved recovery;
- 1 provider became executable specifically because of reserved recovery;
- 0 qualifying alternate recipes were produced;
- the persistently unhealthy dictionary primary remained uncovered;
- observed failures included navigation/login/mailing-list/JavaScript-like request geometries and weakly related query-parameter bindings, indicating that provider retrieval and acquisition budget are no longer the primary bottleneck.

No holdout evidence is consumed.

## Experimental unit
Exactly the same 21 provider identities used by 5B18, preserving:
- capability/case ID and semantic family;
- frozen primary recipe fingerprint and unhealthy-after-5B15 flag;
- frozen 5B17 candidate ID and selected position;
- candidate catalog name;
- frozen capability-equivalence claim and role sets;
- frozen historical 5B17 status.

The exact workload will be materialized in a separate second commit after this preregistration and before treatment implementation.

## Primary hypothesis
For the same provider identities and the same 4+4 acquisition evidence produced under the 5B18 policy, requiring every request hypothesis admitted to the global request beam to possess strong operation provenance and strong input-to-parameter grounding will prevent URL-presence/navigation/code-fragment false requests while preserving enough legitimate operations to produce verified replayable alternates.

## Treatment boundary
5B19 changes only request-hypothesis admission after the inherited hypothesis builders and evidence localization and before global 5B14 request ranking.

It does **not** change:
- provider identities or ordering;
- catalog identity resolution;
- provider retrieval or equivalence ranking;
- 4+4 acquisition policy or network budgets;
- public-network safety controls;
- OpenAPI/Postman parsing behavior;
- live probe transport behavior;
- compiler, projection, response grounding, or development semantic verifier;
- double-build verification;
- changed-input replay;
- holdout policy.

## Evidence-qualified request gate
Every candidate request hypothesis must satisfy **both** an operation-provenance gate and an input-binding gate before it may participate in the global request ranking/beam.

### A. Strong operation provenance
A request is admissible only through one of these generic provenance classes:

1. **Machine contract**
   - request came from an independently fetched and qualified OpenAPI/Swagger operation;
   - method is GET;
   - exact operation pointer/contract lineage is present.

2. **Structured request collection**
   - request came from a parsed structured Postman-like request object;
   - method and URL are explicit fields of the same operation object;
   - unresolved host variables, auth-required requests, and unsafe requests remain rejected by inherited logic.

3. **Executed structured trace**
   - request came from an inherited executed GET trace that passed the inherited navigation/documentation/asset/auth rejection policy;
   - its request/response lineage is preserved.

4. **Documented local HTTP example**
   - the exact normalized route is supported within the same local evidence window by an explicit HTTP request marker such as `GET`, `curl`, `fetch(...)`, or an explicit structured `method: GET` representation;
   - or the same local evidence window contains an explicit API/base origin plus the exact endpoint route under an endpoint/request/reference marker;
   - method and route must refer to the same local operation region.

A plain `href`, navigation target, login redirect, mailing-list URL, static asset, JavaScript token/string, arbitrary absolute URL, or arbitrary relative path is **not sufficient** merely because it occurs in documentation or code.

### B. Strong input-to-parameter grounding
For every task input binding admitted to the beam:

1. direct lexical overlap between the input role and parameter/slot name is sufficient after generic-token normalization; or
2. an exact non-generic semantic-role match is sufficient only when the same parameter-local evidence contains a distinctive input-role anchor; or
3. generic search parameters (`q`, `query`, `search`, `term`, `s`, `value`, `input`) are admissible only when their parameter-local evidence contains both:
   - at least one distinctive anchor derived from the task input role; and
   - at least one distinctive entity/task anchor derived from the task intent.

Broad identity-like compatibility by itself is forbidden. In particular, a code/name/identifier input cannot bind to an unrelated identity-like or generic parameter solely because both are classified as identity-like.

No build value, replay value, expected answer, provider name, provider URL, case ID, semantic-family literal, or known-good endpoint may be used by this gate.

## Determinism
The qualification result for a given set of hypotheses/evidence/proofs must be deterministic.

The gate emits for every admitted request:
- candidate ID;
- qualification class;
- source evidence IDs/fingerprints;
- operation-provenance witness fingerprint;
- per-input binding witness with binding class;
- qualification fingerprint;
- `ranking_bonus:false`.

The gate is filtering-only. It contributes no ranking bonus and does not reorder surviving requests. 5B14 ranking remains unchanged over the surviving set.

## Frozen acquisition and execution budgets
Identical to 5B18:
- capabilities: exactly 7;
- provider identities: exactly 21;
- catalog identity-resolution fetches: exactly 1;
- broad provider retrieval calls: 0;
- capability-equivalence reranker calls: 0;
- secondary provider reranker calls: 0;
- new/manual provider selection: 0;
- ordinary acquisition fetches: max 4/provider;
- reserved recovery fetches: max 4/provider;
- total acquisition fetches: max 8/provider;
- documentation depth: max 2;
- body/document size: unchanged 4 MiB;
- global request beam: unchanged maximum 2/provider attempt;
- persisted alternates: maximum 1/capability;
- build verification: exactly 2 successful live executions required;
- changed-input replay: exactly 1 successful replay required;
- holdout accesses: 0;
- total LLM cost: <= USD 3.00;
- mean LLM cost per qualifying alternate: <= USD 0.20 when at least one alternate qualifies.

## Required instrumentation
The report must expose at least:
- exact frozen workload fingerprint;
- exact 21 identities and frozen attempt order;
- all 5B18-equivalent acquisition counters and budget violations;
- raw request hypotheses entering the qualification gate;
- admitted and rejected hypothesis counts;
- rejection counts by provenance and binding reason;
- admitted counts by provenance class;
- qualification determinism fingerprint/count and nondeterminism violations;
- every global-beam entry and its qualification witness/fingerprint;
- beam entries without qualification witness;
- URL-presence-only admissions;
- broad-identity-only binding admissions;
- live probe count and every probed hypothesis qualification fingerprint;
- terminal attempt stage/reason;
- qualifying alternate recipes;
- semantic families with alternates;
- unhealthy primary coverage;
- replay cognitive/discovery deltas;
- auth-like rendered requests;
- wrong-task probes;
- runtime provider/case/family hardcoding counts;
- total/mean LLM costs;
- holdout accesses.

## GO criteria
Every criterion is required:
1. integrity/preregistration checks pass;
2. exact frozen workload fingerprint matches the post-preregistration workload file;
3. exactly 7 frozen development capabilities are represented;
4. exactly 21 frozen provider identities are represented;
5. Public APIs snapshot is exactly `988c57be4616cc9507fd3e8c34adedba5387f079`;
6. catalog identity-resolution fetches = 1;
7. all attempted providers are from the frozen 21 identities and in frozen selected-position order;
8. broad provider retrieval calls = 0;
9. capability-equivalence reranker calls = 0;
10. secondary provider reranker calls = 0;
11. new/manual provider selection/substitution = 0;
12. ordinary acquisition fetches <=4/provider;
13. reserved recovery fetches <=4/provider;
14. total acquisition fetches <=8/provider;
15. ordinary-reserve borrowing violations = 0;
16. total fetch-budget violations = 0;
17. recovery ordering nondeterminism violations = 0;
18. qualification ordering/fingerprint nondeterminism violations = 0;
19. every request entering the global beam has a non-null evidence-qualification witness;
20. every live-probed request has a non-null evidence-qualification witness;
21. URL-presence-only admissions = 0;
22. broad-identity-only binding admissions = 0;
23. qualification ranking-bonus uses = 0;
24. at least 2 capabilities obtain qualifying alternate recipes;
25. qualifying alternates span at least 2 semantic families;
26. every persistently unhealthy frozen primary obtains a qualifying alternate recipe;
27. every qualifying alternate uses a registrable domain independent from its primary;
28. every qualifying alternate completes two successful live build verifications;
29. every qualifying alternate completes successful changed-input replay;
30. replay catalog/retrieval/reranker/documentation/synthesis/recovery/qualification deltas = 0;
31. auth-like rendered requests = 0;
32. wrong-task probe attempts = 0;
33. runtime provider URL/name hardcoding count = 0;
34. runtime case/family hardcoding count = 0;
35. total LLM cost <= USD 3.00;
36. if qualifying alternates >0, mean LLM cost per qualifying alternate <= USD 0.20;
37. holdout accesses = 0.

If every criterion passes:

`GO_5B19_EVIDENCE_QUALIFIED_EXECUTABLE_REQUEST_INDUCTION`

Otherwise:

`REASSESS_5B19_EVIDENCE_QUALIFIED_EXECUTABLE_REQUEST_INDUCTION`

A GO does not retroactively alter 5B14–5B18. It would establish that MISSING can convert already-retrieved equivalent providers and fixed-budget acquired evidence into trustworthy executable requests and replayable alternates. Only then should a later preregistered development experiment test deterministic runtime failover over frozen primary+alternate recipe pairs.

## Prohibitions
- no rerun or widening of provider retrieval;
- no new provider or endpoint seeds;
- no manual substitutions;
- no provider-, host-, endpoint-, case-, family-, build-value-, replay-value-, or expected-answer-specific rules;
- no increase to 4+4/8 acquisition budgets;
- no larger request beam;
- no ranking bonus from 5B19 qualification;
- no semantic-verifier relaxation;
- no counting HTTP 2xx/build-only success as an alternate;
- no post-hoc GO reinterpretation;
- no holdout access.
