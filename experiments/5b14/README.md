# Experiment 5B14 — Symmetric Request-Local Operation Compatibility

## Status
Preregistered before implementation.

## Frozen base
- Repository base SHA: `024f9f15660254521519c8984d9c60283ac59d00`
- Consumed development experiment: 5B13
- Frozen 5B13 decision: `REASSESS_5B13_REQUEST_LOCAL_DOCUMENTARY_SEMANTIC_UTILITY`
- Frozen 5B13 rerun report fingerprint: `b18242ff960b1b87554c5c752619a16e79a2b361fd9a739c0d2195a60dcf93ce`
- Frozen 5B13 strict successes: 6
- Frozen 5B13 success families: 5
- Frozen 5B13 distinct providers: 6
- Frozen 5B13 persisted recipes: 6
- Frozen 5B13 replay: 6/6

## Consumed evidence motivating 5B14
The corrected 5B13 rerun activated the preregistered treatment and evaluated 3,400 request candidates with the corrected binding model. It scored 2,761 documentary candidates from request-local documentary spans, admitted 42 documentary candidates to the shared top-2 beam, executed 40, and obtained 4 structured 2xx responses, but produced zero documentary strict recipes and no sixth semantic family.

Two generic ranking defects remain visible in the consumed development evidence:

1. semantic evidence is asymmetric across candidate classes. Documentary candidates are scored from request-local evidence, while non-documentary candidates may still receive task/output/structured evidence credit from broad evidence text. This can allow an operation to inherit unrelated semantics from the surrounding document and displace a better local operation.
2. the corrected binding feasibility score includes a `concrete_relation` bonus. Binding feasibility should represent only whether task inputs resolve required request slots safely and completely; provenance/confidence should not increase feasibility itself.

The consumed evidence also includes examples where documentary operations unrelated to the task entered the beam and returned structured 2xx, demonstrating that extraction and transport success alone are insufficient. The unresolved problem is task-to-operation compatibility before the frozen two-request beam.

No holdout evidence is consumed.

## Primary hypothesis
If every request candidate is scored against evidence local to that candidate's own operation, and binding feasibility is made provenance-neutral, then semantically incompatible operations will lose broad-document leakage advantages and evidence-faithful operations will more often occupy the frozen shared top-2 beam, yielding at least one new strict replayable semantic-family recipe without provider/case/family-specific rules.

## Treatment
5B14 introduces only deterministic ranking-evidence changes before the existing shared ranking.

### A. Symmetric request-local semantic context
For every request hypothesis class, construct semantic utility text from the hypothesis's own request geometry plus the narrowest available evidence associated with that exact hypothesis:
- source operation/request path and query keys;
- hypothesis-linked evidence ids and source urls;
- a bounded local span around the hypothesis-specific request/path/url occurrence when available;
- no broad first-N-character document prefix may contribute task, output, or structured-evidence score when a hypothesis-local occurrence exists;
- if no local occurrence can be found, only request geometry and linked source-url/path metadata may be used for semantic utility; do not fall back to broad document prefixes.

This rule applies symmetrically to documentary, native, collection, query, request-graph, template-derived, recovery-derived, and other planner request candidates.

### B. Provenance-neutral binding feasibility
Binding feasibility must use only:
- task input coverage;
- valid input-name -> slot-id references;
- required slot resolution;
- auth-like/safety validity already represented by the existing request model.

`concrete_relation`, documentary provenance, native provenance, provider identity, candidate class, or any other confidence/provenance property must contribute zero points to binding feasibility.

### C. Frozen ranking structure
Keep the 5B13 lexicographic ranking dimensions and order unchanged:
1. output coverage;
2. binding feasibility;
3. task score;
4. structured evidence;
5. lower complexity;
6. base score;
7. deterministic request fingerprint.

Only the semantic evidence context and provenance-neutral binding-feasibility calculation change.

## Frozen planner/execution constraints
- development workload: 18 cases, unchanged;
- provider attempts per case: 8, unchanged;
- ordinary + recovery documentation pages per provider: 8, unchanged;
- acquisition depth: 2, unchanged;
- maximum document bytes: 4 MiB, unchanged;
- global request beam: maximum 2, shared by all candidate classes;
- no reserved beam slot;
- no candidate-class ranking bonus;
- stochastic reranker calls: 0;
- replay performs no catalog, reranker, documentation, synthesis, schema-probe, or recovery discovery;
- no holdout run or holdout inspection before a stable development GO.

## Required direct 5B14 instrumentation
The report must expose at least:
- total request-local semantic evaluations;
- request-local span found count;
- request-local span missing count;
- broad-document semantic fallback uses, target 0;
- provenance-neutral binding evaluations;
- binding provenance bonus uses, target 0;
- invalid input->slot references;
- unresolved required-slot evaluations;
- per-class request-local evaluation counts;
- documentary candidates entering beam positions 1 and 2;
- documentary executed candidates;
- documentary transport/structured 2xx;
- documentary strict recipes;
- documentary changed-input replay successes;
- documentary new-family recipes;
- complete documentary lineage;
- actual global beam maximum aggregated by MAX, not SUM;
- ranking nondeterminism rejects;
- replay discovery deltas;
- auth-like rendered requests;
- wrong-task probe attempts.

## GO criteria
All must be true:
1. integrity/preregistration checks pass;
2. all 18 development cases complete;
3. at least 6 strict successes;
4. at least 6 semantic families with success;
5. at least 6 distinct providers;
6. every success has a persisted recipe;
7. overall changed-input replay rate >= 95%;
8. request-local semantic utility is active for the candidate pool;
9. broad-document semantic fallback uses = 0;
10. provenance-neutral binding feasibility is active;
11. binding provenance bonus uses = 0;
12. invalid input->slot references accepted = 0;
13. at least one documentary candidate enters the shared top-2 beam under ordinary ranking;
14. at least one documentary candidate executes and yields a strict recipe;
15. at least one documentary strict recipe succeeds on changed-input replay;
16. at least one documentary recipe belongs to a family absent from frozen 5B13 success families;
17. documentary recipe lineage is complete from evidence -> local semantic context -> request template/hypothesis -> binding -> utility -> beam position -> rendered build request -> strict recipe -> changed-input replay;
18. accepted documentary geometry violations = 0;
19. documentary bound example values retained = 0;
20. ungrounded runtime constants = 0;
21. candidate-class ranking bonus uses = 0;
22. actual global beam max <= 2;
23. provider/request ordering nondeterminism rejects = 0;
24. replay discovery/cognitive deltas = 0;
25. auth-like rendered requests = 0;
26. wrong-task probe attempts = 0;
27. frozen cost and latency budgets remain satisfied.

If any criterion fails, decision is `REASSESS_5B14_SYMMETRIC_REQUEST_LOCAL_OPERATION_COMPATIBILITY`.

If all criteria pass, decision is `GO_5B14_SYMMETRIC_REQUEST_LOCAL_OPERATION_COMPATIBILITY` and development tuning stops; the next step must be preregistration of a fresh unseen holdout rather than additional tuning on these 18 cases.

## Prohibitions
- no hardcoded provider names, hosts, paths, query keys, case ids, family names, build/replay values, or expected answers in runtime treatment code;
- no ranking bonus keyed to candidate provenance/class;
- no reserved beam slot;
- no wider beam or acquisition budget;
- no extra provider attempts;
- no stochastic reranker;
- no post-hoc GO reinterpretation;
- no holdout access during development tuning.
