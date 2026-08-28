# Experiment 4Q — Evidence Preference & Identity-Preserving Projection

## Status
Preregistered recovery experiment over the already-burned 4A workload. This file MUST be the first commit on the 4Q branch.

## Frozen base
- Repository: `leoleon506/MISSING`
- Base branch: `main`
- Base SHA (4P merge): `89360e887796f967d987d9c08a4841d457cb66c1`
- 4P workflow run: `33192735443`
- 4P job: `98922067448`
- 4P artifact: `9695073693`
- 4P artifact digest: `sha256:f6504a3255a4ce38eb672e16237f01d95bf10be51ca6a767f307c040697e6c70`
- 4P report fingerprint: `9f1a23a81e282998d204749a5fb0cada172932c252f40aaf3bc4da4166497735`
- 4P ledger fingerprint: `5fdcb8e973c32169fc39d9732ab826888138d9452c488bae6037c0d8820823c5`
- 4P ledger events: `6245`

## 4P observed state
- 24 cases / 8 families.
- 5 successful manufactures across 4 families and 5 providers.
- R4 recovery: 4/6.
- Replay: 5/5 = 100%.
- 188 schema probes, 18 2xx JSON probes, 5 confirmed contracts.
- 10 executed-trace hypotheses, 5 trace probes, 0 trace 2xx JSON, 0 trace-confirmed recipes.
- 24 reranks prepared and completed, concurrency limit 3, max observed concurrency 3.
- Rerank wall phase: 415,418 ms; aggregate rerank latency: 1,230,753 ms; overlap savings: 815,335 ms.
- Total benchmark duration: 1,186,567 ms (~19m46.6s).
- LLM cost: $0.2356516 total; $0.04713032 / success.
- Safety: 42/42 controls; auth-like rendered requests 0; wrong-task probes 0; forbidden input-source selections 0; numeric-index ROW_LOOKUP recipes 0; duplicate network fetches 0.

## Causal findings from 4P
4P preserved the runtime optimization but did not preserve every capability. Two concrete failure modes are targeted here:

1. **Equivalent executed traces were not representation-preferred.** For NHTSA, JSON/CSV/XML examples for the same documented operation were acquired, but the trace compiler promoted CSV hypotheses first. The downstream schema/relational pipeline is JSON-native, so the previously demonstrated JSON path from 4O was not reached.
2. **Identity-equivalent outputs were not deterministically preserved from task input.** For TheMealDB, the build task input `meal_name=Arrabiata` and required output `name` represent the same semantic role, but the fallback selected the API field `meals.0.strMeal` (`Spicy Arrabiata Penne`) instead of the input identity mapping that replay had already validated in 4N.

## Treatment A — representation preference for equivalent executed traces
When multiple first-class executed traces are otherwise equivalent for the same case/provider/operation/slot binding and provenance strength:

- prefer an already-executed trace whose response is valid JSON / JSON content-type;
- then other machine-readable structured representations;
- do not create a new request solely to change representation;
- do not discard the non-preferred evidence; retain it in provenance/metrics;
- do not change origin, path semantics, query-slot proof, documented-role proof, or safety gates.

This is a deterministic ordering policy over evidence already acquired in the same run, not provider-specific logic.

## Treatment B — identity-preserving input projection
For each required output, allow deterministic `TASK_INPUT:<input>` projection before FIELD/fallback selection only when the input and output are semantically identity-equivalent under the existing provider-blind token/morphology machinery.

Examples intended to be allowed:
- `vin <- TASK_INPUT:vin`
- `name <- TASK_INPUT:meal_name`
- `name <- TASK_INPUT:drink_name`

Examples that MUST remain forbidden:
- `make <- TASK_INPUT:vin`
- `category <- TASK_INPUT:meal_name`
- `version <- TASK_INPUT:package_name`

The exact same compatibility rule MUST be enforced by the validator. The treatment does not authorize normalization/canonicalization claims unless the task explicitly asks for them.

## Preserved 4P runtime treatment
Keep reranking concurrency unchanged:
- same 24 reranker calls;
- same prompts/model/candidates;
- concurrency limit exactly 3;
- all 24 cases prepared/completed;
- subsequent crawl/spec/probe/synthesis/live/replay remains in original case order.

No new runtime optimization is introduced in 4Q.

## Workload
Use the exact same burned 24-case workload and family distribution as 4P/4O/4N. No new holdout is consumed.

## Formal GO gates
All must pass:
1. Exact 24-case workload; no case-specific provider seeds.
2. R4 recovery >= 5/6.
3. Successful manufactures >= 8/24.
4. Successful families >= 4.
5. Double-live verify every persisted recipe.
6. Changed-input replay >= 95%, with zero replay cognitive/documentation/schema-probe calls.
7. 42/42 controls active and event-derived safety counters clean.
8. >=1 confirmed recipe whose request proof comes from first-class executed trace.
9. >=1 confirmed recipe whose request proof comes from executed-trace documented-role join.
10. >=1 confirmed `ROW_LOOKUP` recipe; zero numeric-index ROW_LOOKUP recipes.
11. Zero forbidden INPUT-source selections.
12. Zero documentation-route probe attempts, confirmed origin drift, request mutation, duplicate probe/acquisition/spec network fetches, documentation-origin fallback, standalone URL promotion, validator graph mismatch.
13. Preserve at least one relative-operation/API-base recipe and at least one expanded-reference recipe.
14. Runtime integrity: rerankPreparedCases=24, rerankCompletedCases=24, rerankConcurrencyLimit=3, rerankMaxObservedConcurrency<=3.
15. Representation preference integrity: no lower-preference equivalent trace may be probed before an available already-executed valid-JSON equivalent trace.
16. Identity-projection integrity: every INPUT projection must pass the same semantic identity check in planner and validator.
17. Preferred economics: total LLM cost <= $0.40 and mean LLM cost per success <= $0.08.

## Runtime diagnostic (not a scientific GO gate)
Target total benchmark wall time <= 20 minutes while preserving the exact 4P workload and model-call breadth. Stretch <=18 minutes. Runtime alone cannot convert REASSESS into GO.

## Decision rule
- `GO_4Q_EVIDENCE_PREFERENCE_IDENTITY_PRESERVING_PROJECTION` only if every formal GO gate passes.
- Otherwise `REASSESS_4Q_EVIDENCE_PREFERENCE_IDENTITY_PRESERVING_PROJECTION`.

Do not run the benchmark on this branch. Benchmark execution remains manual via `workflow_dispatch` after merge to `main`.
