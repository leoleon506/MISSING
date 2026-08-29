# Experiment 5B11 — Evidence-Faithful Documented Request Template Compilation

## Status

This file MUST be the first 5B11-specific commit.

5B11 is a development experiment informed only by consumed 5B10 development evidence. It does not alter, rerun, reinterpret, or overwrite any prior formal decision. The 18-case workload remains development evidence. A fresh unseen holdout remains prohibited until a stable development GO.

## Frozen development baseline

- 5B10 base `main` SHA: `87c5f9569b82b725cdd8a46f21b9bb67d4bbc778`
- valid 5B10 workflow run: `33276122259`
- 5B10 artifact: `9721640711`
- artifact digest: `sha256:14038642ed8693b87c0d4f64c3c403d483bd1e8d31bd0bc46875b95d6216a1ef`
- 5B10 report fingerprint: `b2d31307b7ab7b2bf3ee71b06c87ea9579b1c191a5aa53f0766c88263551809d`
- formal decision: `REASSESS_5B10_RECOVERY_AWARE_SYNTHESIS_GRAPH_SINGLE_BEAM_ADMISSION`

Frozen result:

- 6 / 18 strict successes
- 5 successful semantic families
- 6 distinct successful providers
- 6 / 6 changed-input replays
- recovery activated for 8 selected providers
- 4 recovery fetches succeeded
- recovery added 116 executable operations
- no recovery-attributed strict recipe
- max request beam remained 2
- deterministic/safety/replay/cost gates remained clean

## Post-hoc diagnosis permitted from consumed 5B10 evidence

5B10 established that acquisition and recovery can surface executable documentation but did not produce a sixth successful family. A representative failed trace exposed a narrower downstream failure mode: a documented request template with a fixed path and query placeholder was discovered, but candidate construction altered the documented request geometry by moving build input into unsupported path positions instead of substituting only the documented variable slot.

This motivates a generic treatment on documented request-template fidelity. Provider names, case IDs, benchmark values, expected answers, remembered success/failure tables, and provider-specific endpoint paths are forbidden from runtime treatment code.

A separate 5B10 instrumentation defect was also identified prospectively: 5B10 planner metrics were emitted inside synthesis evidence but were not fully forwarded/aggregated into top-level report metrics. 5B11 may repair forwarding and aggregation as instrumentation only. Such repair is not itself evidence for the treatment hypothesis and may not convert prior 5B10 results into GO.

## Primary hypothesis

> If a machine-readable or documentation-grounded request candidate contains an explicit variable slot, freezing all evidenced request structure and allowing substitution only at evidenced variable positions will prevent geometry-destroying request mutations and yield at least one new strict replayable semantic-family success, without provider-specific logic, added probe/document budgets, widened beam, recovery bonus, or weakened semantic/safety gates.

## Treatment A — Evidence-faithful request template IR

For every request candidate derived from documented evidence, construct a template IR that records:

- HTTP method;
- normalized origin;
- fixed path segments;
- path-variable slots explicitly evidenced as variable;
- fixed query keys;
- query-variable slots explicitly evidenced as variable;
- fixed query values that are not variable slots;
- source evidence ID/body fingerprint;
- operation/request fingerprint;
- evidence kind and derivation witness.

The IR MUST distinguish fixed request structure from variable positions before build-input substitution occurs.

## Treatment B — Freeze geometry

Once a documented request template is accepted:

- method is immutable;
- origin is immutable subject to existing same-provider/canonicalization rules;
- number and order of fixed path segments are immutable;
- fixed path text is immutable;
- query-key set is immutable;
- fixed query values are immutable;
- variable slots may be substituted only where evidence marked a variable position.

The treatment MUST NOT invent a path-variable position from a query variable, move an input from query to path, move an input from path to query, prepend/append arbitrary path segments, rename query keys, or preserve an example value when that value occupies a documented variable slot.

## Treatment C — Slot binding remains semantic and provider-neutral

Input-to-slot binding uses existing task/input semantics and type compatibility. A binding is allowed only when exactly one compatible evidenced variable slot is selected under the existing deterministic rules.

No provider-specific aliases, endpoint knowledge, remembered benchmark answers, or case-ID conditionals are allowed.

Ambiguous slot binding MUST reject rather than mutate geometry.

## Treatment D — Example values are witnesses, never runtime constants

A documented example value may prove that a variable slot is executable, but for build/replay it MUST be replaced by the selected task input when that slot is bound.

Metrics MUST distinguish:

- documented example witnesses observed;
- example values replaced at evidenced variable slots;
- example values incorrectly retained in bound variable slots;
- example values used as unguided constants.

The latter two MUST remain zero for GO.

## Treatment E — Single shared beam remains frozen

Candidate ranking and the shared global beam remain unchanged:

- same deterministic candidate ranking;
- no provider reranker;
- no template-specific ranking bonus;
- no recovery-specific ranking bonus;
- no reserved beam slot;
- max two executable requests/provider.

Evidence-faithful candidates compete normally with all other eligible candidates.

## Treatment F — Direct template-fidelity instrumentation

Persist per candidate:

- template fingerprint;
- source request fingerprint;
- rendered build request fingerprint;
- variable slot identifiers;
- chosen input bindings;
- method-preserved boolean;
- origin-preserved boolean;
- fixed-path-preserved boolean;
- query-key-set-preserved boolean;
- fixed-query-values-preserved boolean;
- only-evidenced-slots-mutated boolean;
- final beam position, if any;
- execution status;
- strict recipe status;
- changed-input replay status.

Required metrics include:

- `documentedTemplatesBuilt5b11`
- `documentedVariableSlots5b11`
- `templateBindingAttempts5b11`
- `templateBindingsAccepted5b11`
- `templateBindingsAmbiguousRejected5b11`
- `templateGeometryMutationRejects5b11`
- `templateMethodMutationRejects5b11`
- `templateOriginMutationRejects5b11`
- `templatePathMutationRejects5b11`
- `templateQueryKeyMutationRejects5b11`
- `templateFixedQueryMutationRejects5b11`
- `templateExampleValuesReplaced5b11`
- `templateBoundExampleValuesRetained5b11`
- `templateUngroundedExampleConstants5b11`
- `templatePlannerVisibleCandidates5b11`
- `templateEligibleCandidates5b11`
- `templateBeamEntries5b11`
- `templateExecutedCandidates5b11`
- `templateStrictRecipes5b11`
- `templateChangedInputReplaySuccesses5b11`
- `templateNewFamilyRecipes5b11`
- `templateEndToEndLineageComplete5b11`

## Treatment G — Repair 5B10 lineage forwarding/metric aggregation prospectively

5B11 MUST forward recovery lineage through the synthesis wrapper to the 5B10-derived planner path and MUST aggregate 5B10/5B11 planner metrics from synthesis evidence into top-level 5B11 report metrics.

This is instrumentation repair only. It MUST NOT:

- alter 5B10 frozen artifacts;
- reinterpret the 5B10 formal verdict;
- add requests;
- alter ranking;
- change semantic eligibility;
- fabricate recovery attribution from downstream COMPILE success.

## Negative controls

Provider-neutral tests MUST prove:

1. fixed documented path segments cannot be replaced by task input;
2. a documented query-variable slot cannot migrate into the path;
3. a documented path-variable slot cannot migrate into a query parameter;
4. query keys cannot be renamed;
5. fixed query values cannot be overwritten;
6. an example occupying a bound variable slot is replaced by build input;
7. ambiguous input-to-slot binding rejects;
8. an undocumented extra path segment rejects;
9. an undocumented extra query key rejects;
10. origin drift rejects;
11. method mutation rejects;
12. template treatment receives no beam/ranking bonus;
13. max beam remains 2;
14. documentation pages/provider remain <=8;
15. documentation depth remains <=2;
16. provider attempts/case remain <=8;
17. runtime treatment contains no provider name/domain/path seed, case-ID conditional, benchmark build/replay value, expected answer, or remembered success table;
18. replay performs zero acquisition/recovery/template-construction/ranking work;
19. metric aggregation cannot count a template recipe without direct candidate/beam/execution lineage;
20. prior reports remain untouched.

## Positive controls

Provider-neutral tests MUST prove:

1. a documented fixed path plus query placeholder renders by replacing only that query slot;
2. a documented path placeholder renders by replacing only that path slot;
3. fixed query parameters coexist unchanged with a variable query slot;
4. method/origin/path/query-key fingerprints remain stable across build and replay except at evidenced variable values;
5. build and replay inputs produce different rendered values in the same slot while template fingerprint remains identical;
6. a template-derived candidate can enter the ordinary shared top-two beam;
7. an executed template candidate can persist full template→candidate→beam→execution→recipe lineage;
8. replay uses the persisted template recipe with zero discovery/synthesis work;
9. recovery lineage is forwarded and 5B10 metrics aggregate from synthesis evidence without changing treatment behavior;
10. identical evidence/input produces byte-identical template and candidate ordering fingerprints.

## Frozen budgets

- cases: 18
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

5B11 is GO only if all invariant safety/determinism/cost/replay gates remain true and all of the following hold:

1. >=6 / 18 strict successes;
2. >=6 semantic families with strict success;
3. >=6 distinct successful providers;
4. replay >=95%;
5. every strict success persists a recipe;
6. >=1 documented evidence-faithful template is built;
7. >=1 template variable slot is semantically bound;
8. >=1 template-derived eligible candidate enters the actual shared top-two beam;
9. >=1 beam-admitted template candidate is executed;
10. >=1 strict recipe is attributable end-to-end to the template treatment;
11. >=1 such recipe succeeds changed-input replay;
12. >=1 such recipe belongs to a semantic family absent from the frozen 5B10 successful-family set;
13. complete template→candidate→beam→execution→recipe lineage for every 5B11 template recipe;
14. method/origin/fixed-path/query-key/fixed-query preservation audits are complete and clean;
15. bound example values retained = 0;
16. ungrounded example constants = 0;
17. template ranking bonus uses = 0;
18. global beam <=2;
19. provider/document/depth/request budgets remain frozen;
20. replay acquisition/recovery/template-construction/ranking deltas = 0;
21. provider/request/template ordering nondeterminism rejects = 0;
22. 5B10 lineage forwarding and top-level metric aggregation audit is complete;
23. no obsolete historical treatment-success gate contaminates the current GO decision.

## Decision strings

- GO: `GO_5B11_EVIDENCE_FAITHFUL_DOCUMENTED_REQUEST_TEMPLATE_COMPILATION`
- REASSESS: `REASSESS_5B11_EVIDENCE_FAITHFUL_DOCUMENTED_REQUEST_TEMPLATE_COMPILATION`

## Execution rule

5B11 may run on the consumed 18-case development workload only after this preregistration commit exists and implementation/controls pass CI. A development GO ends tuning on this workload and requires preregistration of a fresh unseen holdout before any further generalization claim. A REASSESS permits inspection only of consumed development evidence to design the next preregistered development experiment.