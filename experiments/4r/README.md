# Experiment 4R — Representation-Agnostic Response IR + Compositional Deterministic Projection

## Status
Preregistered recovery experiment over the already-burned 4A workload. This file MUST be the first commit on the 4R branch.

## Frozen base
- Repository: `leoleon506/MISSING`
- Base branch: `main`
- Base SHA (4Q merge): `fd5a32ace7cfbf6b11e86040da892b1d0a1238b1`
- 4Q workflow run: `33197714351`
- 4Q job: `98939000473`
- 4Q artifact: `9696996334`
- 4Q artifact digest: `sha256:e2718a5750a648ce1461f771ddf1c98298749cf9926f57b5aa2fbb418a094f9c`
- 4Q report fingerprint: `a13398b390c75130ea7646419df719a98548ae85f8e6b3ac6e0eab068eb62e55`
- 4Q ledger fingerprint: `7569d8b1e84372ef96e2da4268f5e10d0d29ccf1a99b6117f28bd7ae2210650a`
- 4Q ledger events: `5850`

## 4Q observed state
- 24 cases / 8 families.
- 6 successful manufactures across 4 families and 6 providers.
- R4 recovery: 4/6.
- Replay: 6/6 = 100%.
- 1 executed-trace 2xx JSON probe, but 0 trace-confirmed recipes.
- 0 confirmed ROW_LOOKUP recipes.
- Total benchmark duration: 1,076,790 ms (~17m56.8s).
- LLM cost: $0.2314648 total; $0.03857747 / success.
- Rerank concurrency from 4P/4Q remains fixed at 3.

## Causal findings from 4Q
1. NHTSA reached a valid JSON response for the task VIN and the relational IR observed a repeated `Results` row set with `Variable`/`Value`, including both `Make` and `NCSA Make`. The deterministic planner failed because lexical overlap tied those labels, causing fallback projection and semantic failure.
2. Open Food Facts had a correct executed/documented `.xml` product endpoint with a proved barcode slot, but the downstream probe/response pipeline remained JSON-native.
3. Identity-preserving projection recovered MealDB and must remain unchanged.
4. Runtime is no longer the primary bottleneck; 4Q met the <18 minute stretch diagnostic without reducing workload.

## Treatment A — representation-agnostic structured response decoding
Decode the exact already-executed response body into a canonical structured response IR without changing the request URL or issuing a format-conversion request.

Supported decoder classes for this experiment:
- JSON: existing behavior.
- XML: bounded, non-validating structural parse of elements/text/attributes into canonical objects/arrays.
- CSV: bounded RFC4180-style row decoding into arrays of objects when a header row is present.

Requirements:
- Preserve requested URL, final URL, content type, body fingerprint, provenance and request proof.
- Never infer `.json`, `format=json`, or any alternate endpoint from XML/CSV.
- Decoder must be bounded by existing response byte limits and explicit depth/row/field caps.
- Malformed/ambiguous structured responses fail closed.
- No HTML promotion.

## Treatment B — compositional deterministic projection
Projection becomes per-output rather than all-or-nothing.

For each required output:
1. lock an identity-compatible INPUT mapping when mechanically proven;
2. otherwise lock a unique exact observed FIELD mapping when mechanically proven;
3. otherwise lock an exact normalized relational label match before partial lexical matches;
4. otherwise permit a unique ROW_LOOKUP supported by the observed relational IR;
5. only unresolved outputs may be sent to the LLM fallback.

Locked deterministic bindings are immutable during fallback and validation.

Exact-label precedence example:
- required output `make`
- observed labels `Make`, `NCSA Make`
- exact normalized label `Make` MUST win over partial overlap with `NCSA Make`.

ROW_LOOKUP remains index-free and must use observed array path, label field, label value and value field.

## Preserved mechanisms
- Preserve 4Q identity compatibility rules.
- Preserve 4P/4Q reranking concurrency exactly at 3.
- Same 24 reranker calls/prompts/model/candidates.
- Discovery, crawling, spec acquisition, request induction, safety gates, double-live validation and replay remain unchanged except that schema/projection can consume the canonical decoded response IR.
- No new holdout is consumed.

## Required causal activation gates
These are non-vacuous gates in addition to the standard scientific gates:
1. `structured_decoder_non_json_successes >= 1`.
2. At least one successful probe/recipe must consume XML or CSV canonical IR.
3. `compositional_locked_bindings >= 2` across the benchmark.
4. `exact_relational_label_selections >= 1`.
5. At least one confirmed recipe must contain ROW_LOOKUP.
6. Zero cases where an LLM fallback changes a locked deterministic binding.
7. Zero alternate-format request mutations or inferred format requests.

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
10. >=1 confirmed ROW_LOOKUP recipe; zero numeric-index ROW_LOOKUP recipes.
11. Zero forbidden INPUT-source selections.
12. Zero documentation-route probes, origin drift, request mutation, duplicate probe/acquisition/spec network fetches, documentation-origin fallback, standalone URL promotion, validator graph mismatch.
13. Preserve at least one relative-operation/API-base recipe and at least one expanded-reference recipe.
14. Runtime integrity: rerankPreparedCases=24, rerankCompletedCases=24, rerankConcurrencyLimit=3, rerankMaxObservedConcurrency<=3.
15. All required causal activation gates above pass.
16. Preferred economics: total LLM cost <= $0.40 and mean LLM cost per success <= $0.08.

## Runtime diagnostic (not scientific GO gate)
- Preferred <= 20 minutes.
- Stretch <= 18 minutes.
- No additional runtime optimization is introduced in 4R.

## Decision rule
- `GO_4R_REPRESENTATION_AGNOSTIC_RESPONSE_IR_COMPOSITIONAL_PROJECTION` only if every formal GO gate passes.
- Otherwise `REASSESS_4R_REPRESENTATION_AGNOSTIC_RESPONSE_IR_COMPOSITIONAL_PROJECTION`.

Do not run the benchmark on this branch. Benchmark execution remains manual via `workflow_dispatch` after merge to `main`.