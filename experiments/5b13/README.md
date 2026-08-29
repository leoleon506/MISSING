# Experiment 5B13 — Request-Local Documentary Semantic Utility

## Status
Preregistered before implementation.

## Frozen base
- Repository base SHA: `82c4b35294dffc0b7a9a6142f1ea488116122dd1`
- Consumed development experiment: 5B12
- Frozen 5B12 decision: `REASSESS_5B12_PRE_BINDING_DOCUMENTED_REQUEST_TEMPLATE_EXTRACTION`
- Frozen 5B12 report fingerprint: `b65139005c1b5a5dea20627472be7e4c8af6cc6417ea39109550d2ed1d64f636`
- Frozen 5B12 success families: 5
- Frozen 5B12 strict successes: 6
- Frozen 5B12 distinct providers: 6
- Frozen 5B12 persisted recipes: 6
- Frozen 5B12 replay: 5/6

## Consumed evidence motivating 5B13
5B12 demonstrated that explicit documentary request templates can be extracted before heuristic request mutation and can enter the ordinary planner pool. It accepted 3,023 documentary templates, admitted 40 documentary candidates to the shared two-request beam, executed 38, and obtained 4 structured 2xx responses, but produced zero documentary strict recipes and zero new-family recipes.

The consumed development evidence also showed a specific ranking failure for the media case: a documentary candidate preserving the documented TVMaze geometry `/singlesearch/shows?q=<task-input>` existed in the planner pool but ranked far below two malformed heuristic candidates. Two generic ranking defects are implicated:

1. `bindingScore()` interprets `input_bindings` in the wrong direction. `P1RequestHypothesis.input_bindings` maps task input name -> slot id, but the frozen utility checks task input names against `Object.values(input_bindings)` and checks slot resolution via `input_bindings[slot.id]`.
2. documentary semantic utility is scored from broad evidence text truncated to the first 12,000 characters rather than the local source span that generated each documentary request candidate. This can erase the endpoint-local semantics and make unrelated requests from the same document look equivalent.

No holdout evidence is consumed.

## Primary hypothesis
If request utility uses the actual input-name -> slot-id binding structure and documentary candidates are scored against their own source-local documentary span rather than a broad document prefix, then evidence-faithful documentary requests will outrank semantically weaker heuristic geometries within the same frozen global beam of two and yield at least one new strict replayable semantic-family recipe.

## Treatment
5B13 introduces only deterministic utility changes before the existing shared ranking:

### A. Correct binding feasibility utility
For each `P1RequestHypothesis`:
- an input is covered iff its input name is a key in `input_bindings` and the referenced slot id exists;
- a required slot is resolved iff its slot id appears in `Object.values(input_bindings)` or in `literal_bindings`;
- auth-like, unresolved, or invalid slot references remain ineligible/penalized under existing safety semantics;
- no provider, case, endpoint, example value, or family-specific rule is allowed.

### B. Request-local documentary semantic utility
For hypotheses with `proof_type === "5b12_documentary_request_template"`:
- use only the documentary witness/source span associated with that exact request candidate for task/output semantic scoring;
- include the request geometry itself (path and query keys) in that local scoring context;
- do not use the first-N-characters broad-document prefix as a substitute for the local span;
- do not add a fixed treatment bonus or reserve a beam slot.

Non-documentary candidates retain the frozen utility inputs except for the generic corrected binding-feasibility calculation.

## Frozen planner/execution constraints
- development workload: 18 cases, unchanged;
- provider attempts per case: 8, unchanged;
- ordinary + recovery documentation pages per provider: 8, unchanged;
- acquisition depth: 2, unchanged;
- maximum document bytes: 4 MiB, unchanged;
- global request beam: maximum 2, shared by all candidate classes;
- no documentary beam reservation;
- no provider/case/family/endpoint-specific ranking bonus;
- stochastic reranker calls: 0;
- replay performs no catalog, reranker, documentation, synthesis, schema-probe, or recovery discovery;
- no holdout run or holdout inspection before a stable development GO.

## Required direct 5B13 instrumentation
The report must expose at least:
- corrected binding-score evaluations;
- invalid input->slot references;
- unresolved required-slot evaluations;
- documentary candidates scored with exact local source span;
- documentary local-span bytes/tokens transferred to utility;
- documentary local-span missing/fallback count (target 0 for admitted documentary candidates);
- documentary candidate rank distribution and best rank per provider/case;
- documentary candidates entering beam positions 1 and 2;
- documentary executed candidates;
- documentary transport/structured 2xx;
- documentary strict recipes;
- documentary changed-input replay successes;
- documentary new-family recipes;
- complete documentary end-to-end lineage;
- actual global beam maximum aggregated by MAX, not SUM;
- ranking nondeterminism rejects;
- documentary ranking bonus uses (must remain 0).

## GO criteria
All must be true:
1. integrity/preregistration checks pass;
2. all 18 development cases complete;
3. at least 6 strict successes;
4. at least 6 semantic families with success;
5. at least 6 distinct providers;
6. every success has a persisted recipe;
7. overall changed-input replay rate >= 95%;
8. corrected binding utility is active and no invalid input->slot references are accepted;
9. at least one documentary candidate is scored from its exact local source span with no broad-prefix fallback;
10. at least one documentary candidate enters the shared top-2 beam under ordinary ranking;
11. at least one documentary candidate executes and yields a strict recipe;
12. at least one documentary strict recipe succeeds on changed-input replay;
13. at least one documentary recipe belongs to a family absent from frozen 5B12 success families;
14. documentary recipe lineage is complete from source evidence/span -> request template -> binding -> utility -> beam position -> rendered build request -> strict recipe -> changed-input replay;
15. accepted documentary geometry violations = 0;
16. documentary bound example values retained = 0;
17. ungrounded runtime constants = 0;
18. documentary ranking bonus uses = 0;
19. actual global beam max <= 2;
20. provider/request ordering nondeterminism rejects = 0;
21. replay discovery/cognitive deltas = 0;
22. auth-like rendered requests = 0;
23. wrong-task probe attempts = 0;
24. frozen cost and latency budgets remain satisfied.

If any criterion fails, decision is `REASSESS_5B13_REQUEST_LOCAL_DOCUMENTARY_SEMANTIC_UTILITY`.

If all criteria pass, decision is `GO_5B13_REQUEST_LOCAL_DOCUMENTARY_SEMANTIC_UTILITY` and development tuning stops; the next step must be preregistration of a fresh unseen holdout rather than additional tuning on these 18 cases.

## Prohibitions
- no hardcoded provider names, hosts, paths, query keys, case ids, family names, build/replay values, or expected answers in runtime treatment code;
- no ranking bonus keyed to documentary provenance;
- no reserved beam slot;
- no wider beam or acquisition budget;
- no extra provider attempts;
- no post-hoc GO reinterpretation;
- no holdout access during development tuning.
