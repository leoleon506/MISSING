# Experiment 5B10 — Recovery-Aware Synthesis Graph Refresh + Single-Beam Admission

## Status

This file MUST be the first 5B10-specific commit.

5B10 is a development experiment informed by completed 5B9 evidence. It does not alter, rerun, reinterpret, or overwrite the formal decisions of 5A through 5B9. The 18-case workload remains consumed development evidence. A fresh unseen holdout remains mandatory after a stable development GO and MUST NOT be used for tuning 5B10.

## Frozen development baseline

- `main` SHA: `dcadf26c927de338afc6be479e9378080336076a`
- valid 5B9 workflow run: `33274709276`
- 5B9 artifact: `9721239656`
- 5B9 artifact digest: `sha256:a56277d05544ffb353833521fbbf1606d992f25ecdba8e2f123b69087e146f82`
- 5B9 report fingerprint: `2b95b83208d40650cecce7e056484b8aa56d64ad80dfdaef15e2c2685c7e82bd`
- 5B9 decision: `REASSESS_5B9_VERIFIED_SELECTED_PROVIDER_ACQUISITION_RECOVERY`

Formal 5B9 development result:

- 6 / 18 strict successes
- 5 semantic families with success
- 6 distinct successful provider hosts
- 6 persisted recipes
- 6 / 6 changed-input replays = 100%
- selected-provider acquisition-starved count: 98
- recovery activations: 8
- recovery fetch attempts: 8
- recovery fetch successes: 4
- verified HTTPS upgrade accepted: 4
- executable operations added by recovery: 116
- primitive request hypotheses added by recovery: 13
- recovery-derived beam entries: 0
- recovery-attributed strict recipes: 0
- recovery changed-input replays: 0
- recovery new-family recipes: 0
- recovery lineage complete: false
- stochastic provider reranker calls: 0
- max request beam: 2
- all inherited auth/mutation/origin-drift/external-ref/duplicate-fetch safety metrics remained clean

GitHub Actions workflow completion was `success`; the scientific experiment decision was `REASSESS_5B9_VERIFIED_SELECTED_PROVIDER_ACQUISITION_RECOVERY`.

## Post-hoc development diagnosis from 5B9

Because 5B9 is development evidence, failed traces may be inspected to design 5B10. They MUST NOT change the formal 5B9 verdict.

The primary bottleneck is no longer acquisition alone. 5B9 proved that bounded selected-provider recovery can discover substantial executable surface, but recovered surface did not reliably become candidates visible to the final synthesis planner.

Observed examples include:

1. a recovered provider moving from 0 to 61 executable operations and 0 to 3 primitive request hypotheses, while final synthesis still terminated with `5B8_BEAM_EXHAUSTED`;
2. a recovered provider moving from 0 to 18 executable operations and 0 to 10 primitive request hypotheses, while the final synthesis graph exposed zero request hypotheses;
3. another recovered provider moving from 0 to 37 executable operations without producing planner-visible request candidates.

The 5B9 recovery metric `recoveryRequestHypothesesAdded5b9` is measured at a lower-level recovery surface and is therefore not equivalent to a candidate entering the actual final synthesis graph.

The 5B9 metric named `recoveryDerivedHypothesesEnteredBeam5b9` is also insufficiently direct: it increments only when a recovery-executable case reaches final `COMPILE`, conflating actual beam admission with successful compilation.

A second prospective engineering issue was identified in report composition: historical treatment-specific query GO gates from older experiments can leak through inherited gate spreading under obsolete names. This did not change the 5B9 REASSESS decision because independent 5B9-critical gates failed, but 5B10 MUST compose inherited gates explicitly so historical treatment gates are not mistaken for current invariant/safety gates.

## Primary hypothesis

> If, after ordinary acquisition plus bounded 5B9 recovery, the selected provider's final synthesis candidate graph is rebuilt exactly once from the complete augmented evidence before deterministic max-two global beam ranking, then at least one recovery-derived candidate will become planner-visible, pass the unchanged semantic eligibility rules, enter the ordinary single global beam, execute, and produce a strict replayable recipe in a semantic family not successful in 5B9, without any recovery ranking bonus, extra request budget, provider-specific logic, or weakening of semantic/safety constraints.

## Treatment A — Freeze 5B9 acquisition and recovery

5B10 MUST preserve the 5B9 provider selection, ordinary acquisition, acquisition-starved trigger, HTTPS canonicalization, same-provider recovery-link extraction, recovery-link ordering, recovery fetch loop, provider scope, fetch guards, and documentation budgets.

5B10 does NOT add:

- web search;
- sitemap or robots expansion;
- guessed subdomains;
- provider-specific docs paths;
- extra provider attempts;
- extra documentation fetches;
- extra request probes.

## Treatment B — One final synthesis-graph refresh from augmented evidence

For a selected provider, after ordinary acquisition and any eligible 5B9 recovery have completed, 5B10 MUST rebuild the actual final synthesis candidate graph exactly once from the complete provider evidence set available at that point.

The refresh MUST occur before the final global request beam is fixed.

The refreshed graph MUST use the same production candidate-construction path that the final planner consumes. A separate diagnostic-only request-hypothesis builder is insufficient.

The refresh MUST NOT:

- create a second recovery beam;
- preserve stale pre-recovery candidate state as authoritative;
- append candidates after the final beam has already been fixed;
- re-run provider ranking;
- fetch more documentation;
- execute API probes;
- use benchmark answers, provider names, case IDs, or prior success tables.

Metrics include:

- `synthesisGraphRefreshes5b10`
- `synthesisGraphRefreshSkippedNoRecovery5b10`
- `plannerVisibleCandidatesBeforeRecovery5b10`
- `plannerVisibleCandidatesAfterRecovery5b10`
- `recoveryDerivedPlannerVisibleCandidates5b10`

## Treatment C — Recovery candidate provenance

Every candidate in the refreshed final synthesis graph MUST carry enough provenance to determine whether its executable surface depends on recovery-acquired evidence.

A candidate is `recovery_derived` only if at least one source evidence item required for the operation/request candidate was first acquired by 5B9 recovery, or if the provider became executable only after a verified HTTPS-upgrade recovery fetch.

Candidate provenance MUST include:

- case ID
- provider candidate ID
- operation fingerprint
- request-candidate fingerprint
- source evidence IDs/body fingerprints
- recovery lineage fingerprint(s), if any
- recovery-derived boolean
- semantic eligibility result
- deterministic ranking tuple
- final beam position, if admitted
- execution attempt/result, if executed

## Treatment D — Single global beam only

5B10 retains the existing global maximum-two executable request beam.

Recovery-derived and ordinary candidates compete in the SAME beam using the SAME provider-blind ranking and semantic eligibility rules.

No recovery bonus, reserved slot, quota, tie-break advantage, or separate ranking channel is permitted.

A recovery candidate may enter the beam only because its normal deterministic utility/ranking tuple places it there.

Metrics include:

- `recoveryDerivedEligibleCandidates5b10`
- `recoveryDerivedBeamEntries5b10`
- `recoveryDerivedBeamPosition1_5b10`
- `recoveryDerivedBeamPosition2_5b10`
- `recoveryRankingBonusUses5b10`
- `globalBeamSizeMax5b10`

`recoveryDerivedBeamEntries5b10` MUST be measured directly from final planner beam membership, not inferred from downstream compilation or recipe success.

## Treatment E — Planner-visible consistency audit

5B10 MUST explicitly compare the recovery surface against the candidate set visible to the final synthesis planner.

For each recovery-activated provider/case, persist:

- executable operation count before recovery;
- executable operation count after recovery;
- primitive request-hypothesis count before/after recovery, if still instrumented;
- final planner-visible candidate count before/after refresh;
- fingerprints of planner-visible recovery-derived candidates;
- semantic eligibility outcome for each recovery-derived candidate;
- final beam membership;
- execution membership.

The audit MUST classify any mismatch such as:

- recovered operation not converted to planner candidate;
- planner candidate dropped by semantic eligibility;
- eligible candidate ranked outside top two;
- beam candidate not executed;
- executed candidate not compiled;
- compiled candidate failing strict semantic/response validation.

Metrics include:

- `recoveryPlannerConsistencyAuditRows5b10`
- `recoveryOperationWithoutPlannerCandidate5b10`
- `recoveryCandidateSemanticRejects5b10`
- `recoveryEligibleRankedOutsideBeam5b10`
- `recoveryBeamNotExecuted5b10`
- `recoveryExecutedNotCompiled5b10`
- `recoveryCompiledStrictRejects5b10`
- `recoveryPlannerConsistencyAuditComplete5b10`

## Treatment F — Recovery attribution becomes end-to-end

A strict recipe is a **5B10 recovery recipe** only when:

1. 5B9-style recovery activated for the selected provider;
2. a recovery-derived candidate is visible in the actual refreshed final synthesis graph;
3. that candidate passes ordinary semantic eligibility;
4. that exact candidate enters the actual max-two global beam;
5. that candidate is executed;
6. the resulting compiled request passes all inherited strict semantic/response gates;
7. a recipe is persisted with complete recovery→candidate→rank→execution→recipe lineage;
8. changed-input replay succeeds using only the persisted recipe, with zero discovery/acquisition/recovery/synthesis work.

Metrics include:

- `recoveryExecutedCandidates5b10`
- `recoveryStrictRecipes5b10`
- `recoveryChangedInputReplaySuccesses5b10`
- `recoveryNewFamilyRecipes5b10`
- `recoveryEndToEndLineageComplete5b10`

## Treatment G — Preserve semantic/compiler behavior

5B10 MUST preserve, without relaxation:

- 5B2 semantic identity and response grounding;
- 5B3 deterministic provider ordering and max-two global request beam;
- 5B4 structured collection compiler;
- 5B5 exact operation alignment and section-local evidence;
- 5B6 query-oriented compiler and zero example-value matching;
- 5B8 role-segmented task semantics, parameter-type conflict checks, exact-operation transfer, and ACCEPT/REJECT auditing;
- 5B9 selected-provider recovery and same-provider lineage;
- provider scope;
- auth-like guards;
- mutation guards;
- origin-drift guards;
- external-reference restrictions;
- duplicate-fetch restrictions;
- changed-input replay validation.

5B10 may change only when the final synthesis graph is materialized from already-acquired evidence and the instrumentation needed to measure real planner visibility/admission.

## Treatment H — Explicit inherited gate composition

5B10 reporting MUST NOT blindly spread every historical experiment gate into the current final gate object.

The final 5B10 report MUST explicitly compose:

1. invariant safety gates;
2. invariant determinism gates;
3. invariant cost/latency/budget gates;
4. current 5B10 treatment gates;
5. only those historical semantic controls that remain genuine invariants.

Historical treatment-success gates whose names encode success requirements unique to 5B6, 5B8, 5B9, or earlier experiments MUST NOT be inherited as current GO requirements unless explicitly preregistered here.

This is prospective cleanup only. Prior frozen reports and verdicts MUST remain byte-for-byte uninterpreted and must not be regenerated to change historical decisions.

A report audit MUST list the included gate names and prove that obsolete historical treatment-only query success gates are absent from the 5B10 final gate set.

Metrics include:

- `inheritedGateCompositionAuditComplete5b10`
- `obsoleteHistoricalTreatmentGatesPresent5b10`

## Treatment I — Replay remains frozen

Changed-input replay uses only the persisted recipe/request produced by the build run.

During replay:

- zero provider ranking;
- zero provider discovery;
- zero documentation acquisition;
- zero 5B9 recovery;
- zero synthesis-graph refresh;
- zero candidate reranking;
- zero query recompilation;
- zero semantic-gate reruns attributable to 5B10;
- zero additional LLM calls attributable to 5B10.

Metrics include explicit replay deltas for acquisition, recovery, synthesis refresh, candidate construction, and planner ranking.

## Negative controls

Provider-neutral tests MUST demonstrate:

1. recovered primitive request hypotheses do not count as planner-visible unless present in the actual final synthesis graph;
2. a recovery-derived candidate outside the final top-two beam does not count as a beam entry;
3. a downstream `COMPILE` without direct recorded beam membership does not increment recovery beam-entry metrics;
4. graph refresh occurs before final beam fixation;
5. graph refresh occurs at most once/provider/case after acquisition/recovery completes;
6. no second recovery-only beam exists;
7. recovery-derived candidates receive no ranking bonus or reserved slot;
8. ordinary and recovery-derived candidates use identical semantic eligibility rules;
9. graph refresh performs zero documentation fetches;
10. graph refresh performs zero API probes itself;
11. max two unique executable requests/provider remains enforced;
12. documentation pages/provider remain <=8 ordinary + recovery combined;
13. documentation depth remains <=2;
14. provider attempts/case remain <=8;
15. no provider name, case ID, benchmark value, expected answer, or remembered success/failure appears in runtime treatment logic;
16. replay performs zero acquisition/recovery/synthesis-refresh work;
17. obsolete historical treatment-only success gates are absent from the 5B10 final gate set;
18. prior frozen reports are not rewritten or reinterpreted.

## Positive controls

Provider-neutral tests MUST demonstrate:

1. augmented evidence that adds executable operations can produce candidates in the actual refreshed final synthesis graph;
2. a recovery-derived planner-visible candidate has complete recovery provenance;
3. a recovery-derived candidate can pass the unchanged semantic eligibility rules;
4. a normally ranked recovery-derived candidate can enter the actual shared top-two beam;
5. direct beam-entry instrumentation records exact candidate fingerprint and beam position;
6. an admitted recovery-derived candidate can execute through the ordinary execution path;
7. a confirmed recovery recipe persists recovery→candidate→rank→execution→recipe lineage;
8. changed-input replay uses the persisted recipe without rerunning recovery or synthesis;
9. identical augmented evidence produces byte-identical candidate ordering and beam fingerprints;
10. explicit inherited gate composition includes invariant safety/determinism gates while excluding obsolete historical treatment-only success gates.

## Runtime prohibitions

No 5B10 runtime file may contain:

- development provider domains or endpoint seeds;
- 5A–5B9 case-ID conditionals;
- benchmark build/replay values or expected answers;
- remembered provider success/failure tables;
- provider-specific path guesses;
- provider-specific ranking weights;
- a recovery ranking bonus;
- a recovery-reserved beam slot;
- extra request-probe budget;
- extra documentation-page budget;
- external search-engine calls;
- sitemap/robots expansion;
- guessed subdomains;
- relaxed provider-scope/auth/mutation/origin-drift/external-ref guards.

## Frozen budget

- cases: 18
- provider attempts/case: 8
- documentation pages/provider: 8 total ordinary + recovery
- documentation depth: 2
- maximum document bytes: 4 MiB
- maximum unique executable requests/provider: 2
- global request beam size: 2
- stochastic provider reranker calls: 0
- total LLM cost <= USD 3.00
- mean LLM cost/strict success <= USD 0.15
- median strict-success latency <= 90 seconds
- p90 strict-success latency <= 180 seconds

## Primary 5B10 GO criteria

5B10 is GO only if ALL preregistered invariant semantic/safety/determinism/cost gates remain true and ALL of the following hold:

1. >= **6 / 18 strict successes**;
2. >= **6 semantic families** with strict success;
3. >= **6 distinct successful provider hosts**;
4. replay >= **95%**;
5. every strict success persists a recipe;
6. >=1 acquisition-starved selected provider activates recovery;
7. >=1 recovery fetch succeeds and adds executable surface;
8. >=1 recovery-derived candidate is visible in the **actual final refreshed synthesis graph**;
9. >=1 recovery-derived planner-visible candidate passes the ordinary semantic eligibility rules;
10. >=1 recovery-derived eligible candidate enters the **actual shared max-two global beam**;
11. >=1 such beam-admitted recovery-derived candidate is actually executed;
12. >=1 strict recipe is attributable end-to-end to a recovery-derived candidate;
13. >=1 such recovery recipe succeeds changed-input replay;
14. >=1 such recovery recipe belongs to a semantic family with no strict success in 5B9;
15. recovery→candidate→rank→execution→recipe lineage is complete for every 5B10 recovery recipe;
16. recovery/planner candidate-set consistency audit is complete;
17. recovery candidate ordering/beam nondeterminism rejects = 0;
18. provider ordering nondeterminism rejects = 0;
19. recovery ranking bonus uses = 0;
20. global beam size <=2;
21. max unique executable requests/provider <=2;
22. ordinary + recovery documentation fetches <=8/provider;
23. ordinary + recovery depth <=2;
24. provider attempts/case <=8;
25. replay acquisition/recovery/synthesis-refresh/candidate-ranking deltas = 0;
26. stochastic provider reranker calls = 0;
27. 5B8 output→entity contamination accepted = 0;
28. 5B8 parameter-type example-value uses = 0;
29. 5B6 query example-value matching = 0;
30. all auth, wrong-task, mutation, origin-drift, external-ref, validator and duplicate-fetch gates remain clean;
31. inherited gate composition audit is complete;
32. obsolete historical treatment-only gates present = 0;
33. cost and latency budgets remain satisfied;
34. all 18 development cases complete deterministic provider ordering, acquisition/recovery, synthesis refresh, ranking, execution/evaluation and reporting.

Thresholds are not lowered. A 5B10 GO remains development evidence only.

## Decision strings

- `GO_5B10_RECOVERY_AWARE_SYNTHESIS_GRAPH_SINGLE_BEAM_ADMISSION`
- `REASSESS_5B10_RECOVERY_AWARE_SYNTHESIS_GRAPH_SINGLE_BEAM_ADMISSION`

## Execution rule

CI may run unit/integration/generated-source controls only.

Do **not** run the live 5B10 benchmark from the PR branch.

After merge to `main`, manually dispatch:

`Run MISSING Experiment 5B10`

If 5B10 meets the preregistered development GO criteria, STOP tuning on the consumed 18-case workload and proceed to a fresh unseen holdout under a separately preregistered protocol.

If 5B10 is REASSESS, do not open the fresh holdout for tuning. Inspect only consumed-development evidence and design the next preregistered development experiment.
