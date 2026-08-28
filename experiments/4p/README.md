# Experiment 4P — Projection Compatibility Envelope

## Status
Preregistered engineering-recovery experiment over the already-burned 4A workload. No fresh holdout is consumed.

This README MUST be the first commit on the 4P branch.

## Frozen base
- 4O merge/main SHA: `3a1fffc82d3854302b34e9bcfc1a4e1f44ac0744`
- 4O workflow run: `33188187832`
- 4O job: `98906546908`
- 4O artifact: `9693612592`
- artifact digest: `sha256:56aa6d725f37d4a3fe7d3effc600c42ca1612f9d639ca88c8e075fb1c79735bc`
- decision: `REASSESS_4O_RELATIONAL_RESPONSE_IR_KEYED_ROW_PROJECTION`
- report fingerprint: `ea3c1fa935ea48cee470a2b4604ffe1fd98c3bf21b82e5802797439cf18a3ae6`
- ledger fingerprint: `dda96f215520189877aae48dae18e382a12659006e53dd2181f4f3a8bbdbfbaf`
- model: `gpt-4.1-mini-2025-04-14`

## Frozen 4O outcome
- 24 cases / 8 families
- 4 successful manufactures / 3 families / 4 providers / 4 recipes
- replay 4/4 = 100%
- R4 recovery 3/6
- successes: Agify.io, Genderize.io, Metropolitan Museum of Art, NHTSA
- first confirmed first-class trace recipe: NHTSA
- first confirmed documented-role trace recipe: NHTSA
- first confirmed `ROW_LOOKUP` recipe: NHTSA
- NHTSA projection successfully replayed without numeric index:
  - `vin <- TASK_INPUT:vin`
  - `make <- ROW_LOOKUP(Results, Variable="Make", Value)`
- `rowLookupConfirmedRecipes = 1`
- `numericIndexedRowLookupRecipes = 0`
- `forbiddenInputSourceSelections = 0`
- controls 42/42 and inherited safety counters clean

## Frozen 4O regression attribution
4O proved the relational-response hypothesis but introduced two projection regressions unrelated to discovery or request induction.

### Regression A — over-broad numeric FIELD exclusion
4O excluded every observed `FIELD` whose response path contained a numeric segment. This removed previously replay-proven mappings such as singleton-result arrays (`meals.0.strCategory`, `drinks.0.strCategory`). The preregistered safety requirement concerned persisted numeric indices in `ROW_LOOKUP`, not the removal of all observed FIELD paths.

### Regression B — unsupported fallback JSON Schema composition
4O changed LLM mapping output to an `items.oneOf` schema in order to exclude incompatible task-input sources per output. In the 4O run, fallback attempts that required this path returned HTTP 400 with no usable content. This removed npm and other previously working semantic FIELD mappings even though their probes remained valid.

4P therefore treats 4O as a new capability that must be added monotonically to the working 4N projection envelope rather than replacing it.

## 4P hypothesis
A projection compiler can be monotonic if it supports three simultaneously valid projection families:
1. observed `FIELD` projection, including previously replay-proven numeric response paths;
2. semantically compatible `INPUT` identity projection;
3. observed, index-free `ROW_LOOKUP` relational projection.

`ROW_LOOKUP` keeps its strict no-numeric-index requirement. `FIELD` remains acceptable only when the exact field path was observed in the successful probe and is revalidated against the same probe proof.

## Per-output fallback schema
The fallback structured-output schema MUST NOT use `oneOf` for output bindings.

Instead, `output_bindings` is a fixed object whose properties are the exact required outputs. Each output property has its own `source_id` enum:
- all supplied observed FIELD IDs;
- only task inputs that are identity-compatible with that specific output;
- no incompatible task input is present in that output's enum.

Example:
```text
output_bindings: {
  vin:  { source_id: [<observed fields>, "TASK_INPUT:vin"] },
  make: { source_id: [<observed fields>] }
}
```

The validator independently rejects any forged incompatible INPUT source.

## FIELD compatibility rule
Numeric response segments are not globally forbidden.

A FIELD projection is admissible only if:
- its exact field ID/path was present in the successful probe proof;
- the projection path is unchanged from that observed proof;
- output keys equal the required output set;
- normal semantic live validation and replay still pass.

This restores the 4N behavior for singleton arrays without weakening `ROW_LOOKUP` safety.

## ROW_LOOKUP preservation
4O relational behavior remains unchanged:
- label/value row-set inferred only from successful observed JSON;
- finite observed label set;
- unique label match;
- no numeric index in `array_path`, `label_field`, or `value_field`;
- fail closed on missing or duplicate label;
- changed-input live verification and replay required.

## Monotonicity target
4P should recover the six capabilities that succeeded in 4N while retaining the new NHTSA capability from 4O. Evaluation may compare against this already-burned development baseline; no provider/domain literal may enter runtime recovery source.

Diagnostic baseline set:
- npm package metadata
- meal name metadata
- cocktail name metadata
- age estimate by name
- gender estimate by name
- artwork object metadata
- plus NHTSA VIN vehicle metadata from 4O.

## Runtime finding from 4O
4O wall-clock benchmark duration: `1,894,151 ms` (~31m34.2s).

The dominant cost was not CPU or response projection:
- 24 initial reranker LLM calls consumed `1,277,559 ms` aggregate;
- median initial reranker latency `51,527.5 ms`;
- maximum initial reranker latency `102,755 ms`;
- one rerank repair consumed `51,805 ms`;
- all LLM latency combined was `1,332,771 ms` (~22m12.8s);
- only 10 synthesis LLM calls consumed `3,407 ms` aggregate.

Thus approximately 70% of wall time is independent per-case reranking executed serially.

## Runtime intervention — bounded ordered rerank prephase
4P MAY change scheduling but MUST NOT reduce reranking work.

Before provider crawling/synthesis:
1. compute the exact same broad candidate frontier for all 24 cases;
2. execute the exact same reranker function/prompt/model for each case with bounded concurrency `3`;
3. each case retains its own repair behavior if needed;
4. store results in original FOUR_A_CASES order;
5. after the concurrent rerank phase, execute provider crawl/synthesis/live verification sequentially in the original case order;
6. keep the same candidate selection and provider-attempt limits;
7. preserve per-case work latency as rerank elapsed + provider-phase elapsed rather than measuring queue overlap as scientific latency.

The runtime intervention MUST NOT:
- drop a rerank call;
- reduce top-K candidates;
- reduce provider attempts;
- reduce documentation/spec/probe coverage;
- persist rerank results across benchmark runs;
- parallelize provider crawling/live verification;
- change model, prompt, temperature, gates, or price accounting.

Required runtime metrics:
- `rerankPreparedCases`
- `rerankCompletedCases`
- `rerankConcurrencyLimit = 3`
- `rerankMaxObservedConcurrency`
- `rerankWallPhaseMs`
- `rerankAggregateCaseLatencyMs`
- `rerankOverlapSavingsMs`
- existing `rerankerCalls`
- existing LLM usage/cost
- benchmark wall-clock duration.

Required runtime integrity gates:
- all 24 cases prepared and completed;
- max observed rerank concurrency <=3;
- no case missing rerank result;
- reranker calls cover every case plus any explicit repairs;
- no change to workload/provider/doc/spec/schema/live/replay budgets.

Runtime target is diagnostic, not a scientific GO gate because external latency varies:
- preferred benchmark duration <=20 minutes;
- stretch target <=18 minutes.

## Required causal tests before benchmark
1. observed numeric FIELD path remains selectable and materializable.
2. numeric FIELD path must match an exact observed probe field; invented numeric path rejects.
3. `ROW_LOOKUP` with numeric index still rejects.
4. NHTSA-style repeated labeled rows still compile to `ROW_LOOKUP`.
5. compatible identity input remains allowed (`vin <- vin`, `name <- name`).
6. incompatible identity input remains impossible (`make <- vin`).
7. fallback schema contains no `oneOf`.
8. fallback schema uses a fixed object keyed by required outputs.
9. `make` output schema does not contain `TASK_INPUT:vin`.
10. npm-style semantic field mapping (`version <- dist-tags.latest`) can pass through fallback materialization.
11. MealDB/CocktailDB-style singleton array FIELD projections can pass validation.
12. 4O relational proof/ROW_LOOKUP validation remains unchanged.
13. bounded concurrency helper never exceeds limit 3.
14. bounded concurrency returns results in original input order despite out-of-order completion.
15. all 24 synthetic rerank jobs execute exactly once.
16. one task failure is returned/propagated deterministically without silently dropping other scheduled work.
17. provider-blind source audit finds no provider/domain/endpoint recovery literals.
18. false character→books recipe remains absent through inherited request graph controls.

## Engineering recovery GO gates
4P is GO only if ALL inherited scientific gates pass, including:
- recover >=5 of 6 R4 capabilities;
- >=8 successful manufactures total;
- >=4 families with success;
- changed-input replay >=95%, every successful replay semantically valid;
- zero replay cognition/documentation/synthesis/schema-probe deltas;
- controls 42/42 and event-derived safety clean;
- no auth-like/wrong-task/entity-incompatible probes;
- false character→books absent;
- request placeholder/non-auth mutation safety clean;
- zero duplicate acquisition/spec/probe network fetches;
- >=1 relative-operation/API-base recipe;
- >=1 expanded-reference recipe;
- >=1 first-class executed-trace recipe;
- >=1 documented-role trace recipe;
- >=1 confirmed `ROW_LOOKUP` recipe;
- zero numeric-index `ROW_LOOKUP` recipes;
- zero forbidden input-source selections;
- aggregate diagnostics equal per-attempt recomputation;
- preferred total LLM cost <= `$0.60` and mean <= `$0.15` per success;
- runtime integrity gates above.

Additional monotonicity diagnostic (reported explicitly): all six 4N-success cases plus 4O NHTSA recovered. It is not a substitute for the >=8 manufacture GO gate.

If 4P recovers <5/6 R4 capabilities, do NOT automatically create 4PR/4PR2. Attribute the remaining ceiling first.

## Formal decision
- `GO_4P_PROJECTION_COMPATIBILITY_ENVELOPE`
- otherwise `REASSESS_4P_PROJECTION_COMPATIBILITY_ENVELOPE`
