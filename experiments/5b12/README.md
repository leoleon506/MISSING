# Experiment 5B12 — Pre-Binding Documented Request Template Extraction

## Status

This file MUST be the first 5B12-specific commit.

5B12 is a development experiment informed only by consumed 5B11 development evidence. It does not alter, rerun, reinterpret, or overwrite any prior formal decision. The same 18-case development workload remains the only workload permitted for this experiment. A fresh unseen holdout remains prohibited until a stable development GO.

## Frozen 5B11 baseline

- 5B11 base `main` SHA at execution: `32b4a0520b4d8e7bb734ce8057cf04d29a6eb62f`
- valid workflow run: `33277245806`
- artifact: `9722001733`
- artifact digest: `sha256:76fa99beba3f607e807cb7f2dabc98c56479771ca415382953c59d86f49678f9`
- 5B11 report fingerprint: `18ac215644c9fc12ac46085b00d512546521db8e03386722383bebbfc430a4de`
- formal decision: `REASSESS_5B11_EVIDENCE_FAITHFUL_DOCUMENTED_REQUEST_TEMPLATE_COMPILATION`

Frozen result:

- 6 / 18 strict successes
- 5 successful semantic families
- 6 distinct successful providers
- 6 / 6 changed-input replays
- max actual per-synthesis request beam remained 2
- no stochastic reranker
- replay performed zero recovery/discovery/synthesis work

## Permitted diagnosis from consumed 5B11 evidence

5B11 demonstrated that filtering already-built hypotheses is too late to guarantee documentary request fidelity. In representative failed development traces, documentation contained an explicit request geometry, but earlier heuristic compilers first transformed that evidence into malformed candidates. The 5B11 filter then treated those already-transformed candidates as the template source instead of reconstructing a template directly from the documentation evidence.

A documented request must therefore be extracted into an immutable request-template IR **before** heuristic path/query induction or build-input substitution.

5B11 also exposed reporting/provenance defects that may be repaired prospectively as instrumentation only:

1. aggregate maximum-valued metrics using MAX rather than SUM;
2. persist treatment witness lineage into the final recipe object;
3. recovery provenance may additionally use a hypothesis's direct evidence IDs rather than proof-map membership alone.

These repairs may not reinterpret the frozen 5B11 verdict or fabricate treatment attribution.

## Primary hypothesis

> If explicit documented request examples/templates are parsed directly from documentation evidence into immutable pre-binding request-template IR, and task inputs are bound only to variable positions evidenced by those templates before any heuristic request-shape induction, at least one previously failed semantic family will produce a strict changed-input-replayable recipe without provider-specific logic, increased acquisition/probe budgets, widened request beam, ranking bonuses, or weakened semantic/safety gates.

## Treatment A — Direct documentary request extraction

Before heuristic request construction, scan the already-acquired provider documentation evidence for explicit HTTP(S) request examples or request-target literals that satisfy existing provider-scope rules.

For each accepted documentary request, construct a provider-neutral IR containing:

- evidence ID and evidence body fingerprint;
- request/example fingerprint;
- method when explicitly documented, otherwise existing safe GET default only where current system policy permits;
- normalized same-provider origin;
- immutable path segments;
- immutable query-key set;
- fixed query values;
- variable path/query positions evidenced by placeholder syntax or by a documented example value that can be semantically and uniquely associated with one task input;
- source span fingerprint sufficient for lineage auditing.

No provider names, provider domains, benchmark case IDs, benchmark values, endpoint seeds, expected answers, or remembered success/failure tables may appear in runtime treatment code.

## Treatment B — Pre-binding before heuristic induction

Direct documentary templates MUST be extracted before route-family/query/path heuristic hypotheses are allowed to mutate request geometry.

A documentary template candidate MUST retain its own request geometry from source evidence. Heuristic compilers may continue to generate independent candidates, but MUST NOT rewrite a documentary candidate.

## Treatment C — Semantic unique binding

A documentary variable position may bind to task input only when the binding is unique under provider-neutral evidence available at runtime, including:

- exact/normalized placeholder-name compatibility;
- local request-context token compatibility;
- type compatibility;
- existing task/entity/action semantic gates.

If more than one task input or more than one documentary variable position remains compatible, reject the documentary binding rather than guess.

Documented concrete example values may serve as witnesses for a variable position but MUST never become benchmark constants. When the example position is bound, build and replay must substitute their respective task-input values into the same slot.

## Treatment D — Existing semantic gate remains authoritative

5B12 MUST NOT weaken or bypass the existing role-segmented typed operation-transfer/semantic eligibility gates inherited from 5B8+.

Direct documentary candidates compete using the ordinary deterministic ranking logic. There is:

- no documentary-template ranking bonus;
- no recovery ranking bonus;
- no reserved beam slot;
- no provider reranker;
- no separate treatment execution budget.

## Treatment E — Single shared request beam remains frozen

The final executable request beam remains one shared deterministic beam of at most 2 requests per synthesis attempt/provider.

Direct documentary candidates and inherited heuristic candidates compete in that same beam.

## Treatment F — End-to-end source fidelity lineage

Every treatment candidate must persist lineage:

`document evidence -> source span/request fingerprint -> pre-binding template -> semantic binding -> candidate -> ordinary ranking -> beam position -> rendered build request -> execution -> strict recipe -> changed-input replay`

For strict treatment recipes, build and replay must preserve:

- method;
- origin;
- fixed path segments;
- query-key set;
- fixed query values;
- template fingerprint;

while changing only evidenced variable-slot values when the task input changes.

## Treatment G — Prospective instrumentation repair

5B12 may repair the following as instrumentation only:

1. `globalBeamSizeMax*` aggregation uses maximum across synthesis attempts, not sum;
2. final recipes persist treatment witnesses from the actual selected materialized candidate;
3. recovery provenance can match direct hypothesis evidence IDs/body fingerprints as well as proof-source IDs.

No instrumentation repair may modify ranking, eligibility, request count, response validation, or the frozen 5B11 decision.

## Required treatment metrics

At minimum:

- `documentaryRequestsObserved5b12`
- `documentaryTemplatesAccepted5b12`
- `documentaryTemplatesRejectedScope5b12`
- `documentaryTemplatesRejectedAmbiguous5b12`
- `documentaryVariableSlots5b12`
- `documentaryBindingsAttempted5b12`
- `documentaryBindingsAccepted5b12`
- `documentaryExampleValueBindings5b12`
- `documentaryPlannerVisibleCandidates5b12`
- `documentaryEligibleCandidates5b12`
- `documentaryBeamEntries5b12`
- `documentaryExecutedCandidates5b12`
- `documentaryTransport2xx5b12`
- `documentaryStructured2xx5b12`
- `documentaryStrictRecipes5b12`
- `documentaryChangedInputReplaySuccesses5b12`
- `documentaryNewFamilyRecipes5b12`
- `documentaryLineageComplete5b12`
- `documentaryGeometryViolationsAccepted5b12`
- `documentaryBoundExampleValuesRetained5b12`
- `documentaryUngroundedRuntimeConstants5b12`
- `documentaryRankingBonusUses5b12`

## Negative controls

Provider-neutral tests MUST prove:

1. a query-bound documentary variable cannot migrate into a path segment;
2. a path-bound documentary variable cannot migrate into query;
3. fixed documented path segments remain unchanged;
4. query keys remain unchanged;
5. fixed query values remain unchanged;
6. origin drift rejects;
7. an off-provider absolute request rejects;
8. ambiguous task-input binding rejects;
9. ambiguous variable-position induction rejects;
10. auth-like placeholders/parameters remain subject to inherited safety rejection;
11. a concrete example value is not retained when its position is bound;
12. no undocumented extra path segment is introduced;
13. no undocumented extra query parameter is introduced;
14. treatment candidates receive no ranking bonus;
15. recovery candidates receive no ranking bonus;
16. global executable beam never exceeds 2;
17. documentation fetch budget remains unchanged;
18. provider-attempt budget remains unchanged;
19. replay performs zero discovery/template extraction/ranking/recovery work;
20. runtime treatment code contains no provider-specific domain/path/name, case-ID conditional, benchmark build/replay literal, expected answer, or success table.

## Positive controls

Provider-neutral tests MUST prove:

1. an absolute documented GET request with one query example value can become a pre-binding query template when exactly one input is semantically compatible;
2. a relative documented request under the provider origin can become a template;
3. colon, brace, angle-bracket, and common query placeholder forms can be represented without moving slot location;
4. fixed query values coexist with one variable query slot;
5. build/replay render different input values in the same documentary slot while preserving template fingerprint;
6. documentary extraction happens before heuristic candidate filtering/ranking;
7. a documentary candidate can enter the normal shared top-two beam;
8. selected treatment candidate persists source-evidence and beam lineage into the final recipe;
9. replay uses the persisted recipe with zero documentary extraction;
10. identical evidence/input produces byte-identical documentary template ordering.

## Frozen budgets

- development cases: 18
- provider attempts/case: 8
- documentation pages/provider: 8 ordinary + recovery combined
- documentation depth: 2
- max document bytes: 4 MiB
- global executable request beam: 2
- stochastic provider reranker calls: 0
- total LLM cost <= USD 3.00
- mean LLM cost/strict success <= USD 0.15
- median strict-success latency <= 90 s
- p90 strict-success latency <= 180 s

## Primary GO criteria

5B12 is GO only if all invariant safety/determinism/cost/replay gates remain true and all of the following hold:

1. >=6 / 18 strict successes;
2. >=6 semantic families with strict success;
3. >=6 distinct successful providers;
4. replay >=95%;
5. every strict success persists a recipe;
6. >=1 explicit documentary request is observed;
7. >=1 documentary request becomes an accepted pre-binding template;
8. >=1 documentary variable slot is semantically bound;
9. >=1 documentary candidate is planner-visible and eligible;
10. >=1 documentary candidate enters the actual shared top-two beam;
11. >=1 beam-admitted documentary candidate is executed;
12. >=1 strict recipe is directly attributable end-to-end to a documentary candidate;
13. >=1 such recipe succeeds changed-input replay;
14. >=1 such recipe belongs to a semantic family absent from the frozen 5B11 successful-family set;
15. complete source-evidence -> template -> candidate -> beam -> execution -> recipe -> replay lineage for every 5B12 treatment recipe;
16. accepted documentary geometry violations = 0;
17. bound example values retained = 0;
18. ungrounded runtime constants = 0;
19. documentary ranking bonus uses = 0;
20. actual max global beam <=2;
21. provider/document/depth/request budgets remain frozen;
22. replay acquisition/recovery/template/ranking deltas = 0;
23. provider/request/template ordering nondeterminism rejects = 0;
24. instrumentation aggregation/provenance audit is complete and does not alter behavior;
25. no obsolete historical treatment-success gate contaminates the current GO decision.

## Decision strings

- GO: `GO_5B12_PRE_BINDING_DOCUMENTED_REQUEST_TEMPLATE_EXTRACTION`
- REASSESS: `REASSESS_5B12_PRE_BINDING_DOCUMENTED_REQUEST_TEMPLATE_EXTRACTION`

## Execution rule

5B12 may run only on the consumed 18-case development workload after this preregistration exists as the first 5B12-specific commit and all implementation/controls pass CI. A development GO ends tuning on this workload and requires preregistration of a fresh unseen holdout before any further generalization claim. A REASSESS permits inspection only of consumed development evidence to design the next preregistered development experiment.
