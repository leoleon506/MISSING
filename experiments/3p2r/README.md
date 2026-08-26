# MISSING Experiment 3P2R — Verified Fingerprint-Control Replication

## Status
Preregistered before implementation and before benchmark execution.

## Relationship to 3P2
Experiment 3P2 remains historically unchanged. Its core result reached all live procurement and replay thresholds, but its frozen negative control #5 (`empty/missing spec fingerprint does not count as fingerprint evidence`) was not actually exercised: the runner appended a synthetic `rejected:true` record instead of passing a malformed recipe through the same fingerprint-evidence predicate used by the formal gate.

3P2R is a methodological replication only. It does **not** change the procurement hypothesis, candidate specification index, cases, build inputs, replay inputs, retrieval algorithm, planner contract, typed binding compiler, source execution, semantic validators, network policy, replay mechanism, or GO thresholds from 3P2.

The only methodological change is that fingerprint evidence is independently and actively tested after the unchanged 3P2 core run, and formal certification requires evidence that all nine frozen controls were actually exercised and rejected.

## Frozen hypothesis
Can MISSING, given only a live machine-readable candidate specification index and a capability request, autonomously select a viable provider and exact live OpenAPI operation, compile bounded typed input transformations required by that contract, execute and semantically validate the result, persist the recipe, and replay it on a different input with zero planner calls and zero source re-procurement?

## Frozen candidate specification index
Unchanged from 3P2:

1. `nws` — `https://api.weather.gov/openapi.json`
2. `github` — `https://raw.githubusercontent.com/github/rest-api-description/main/descriptions/api.github.com/api.github.com.2022-11-28.json`
3. `usgs_water` — `https://api.waterdata.usgs.gov/ogcapi/v0/openapi`

## Frozen cases and inputs
Unchanged from 3P2.

### Case A — NWS point metadata
Build: `point = 39.7456,-97.0892`

Replay: `point = 40.7128,-74.0060`

Required outputs: `gridId`, `gridX`, `gridY`.

### Case B — GitHub public repository metadata
Build: `owner = openai`, `repo = openai-python`

Replay: `owner = nodejs`, `repo = node`.

Required outputs: `full_name`, `stargazers_count`, `language`.

### Case C — USGS monitoring-location metadata
Build: `site_id = USGS-01435000`

Replay: `site_id = USGS-01100000`.

Required outputs: `id`, `monitoring_location_name`, `state_name`.

## Frozen core execution
The workflow runs the unchanged 3P2 benchmark implementation first. The 3P2R verifier then reads that run's `report.json` and `recipes.json`. It may not alter, repair, regenerate, or reinterpret planner output, live responses, recipes, replay outcomes, or safety counters.

The verifier may only:

- verify that the 3P2 core report contains evidence for the eight controls that 3P2 actually executes through its validation/compilation logic;
- actively exercise the fingerprint-evidence predicate using persisted recipes from the same run;
- recompute the formal decision from the frozen 3P2 thresholds plus verified-control evidence;
- emit a separate 3P2R report.

## Fingerprint-control repair
Define one deterministic predicate used both by the active negative control and the final fingerprint gate:

`hasFingerprintEvidence(recipes) = recipes.length >= 2 && every recipe has a non-empty spec_fingerprint and non-empty recipe_fingerprint`.

The verifier must execute all of the following:

1. Evaluate `hasFingerprintEvidence` on the original persisted recipes.
2. Clone the persisted recipes without mutating the originals.
3. Set one cloned recipe's `spec_fingerprint` to the empty string.
4. Evaluate the **same** predicate on the malformed clone.
5. The negative control is rejected only if the original set returns `true` and the malformed set returns `false`.
6. Record `executed:true`, before/after predicate values, the mutated recipe case id, and the mutation performed.

For additional non-gating evidence, the verifier may also mutate one `recipe_fingerprint` to empty and confirm rejection, but this does not replace the preregistered spec-fingerprint control.

No record may be counted as a rejected control merely because a constant `rejected:true` was assigned.

## Frozen nine negative controls
Same controls as 3P2:

1. operation path absent from selected live contract is rejected;
2. undeclared parameter is rejected;
3. non-GET method is rejected;
4. wrong execution host is rejected;
5. empty/missing spec fingerprint does not count as fingerprint evidence;
6. `DIRECT` binding to a missing input field is rejected;
7. `SPLIT` binding with an out-of-range index is rejected;
8. transformed value incompatible with the declared OpenAPI parameter schema is rejected before execution;
9. unsupported transform kind is rejected.

For controls 1–4 and 6–9, the verifier requires corresponding evidence from the fresh unchanged 3P2 run. For control 5, it requires the active predicate mutation test defined above. `negative_controls_verified = 9` only when every control has `executed:true` and `rejected:true`.

## Frozen GO gates
Formal decision is `GO_CONTRACT_AWARE_TYPED_SOURCE_PROCUREMENT_VERIFIED` only if all of the following hold in this fresh run:

- all three candidate specs are fetched live, parsed, and fingerprinted;
- zero case-to-provider/source/operation mappings exist in the frozen cases;
- at least 2 distinct cases autonomously procure a provider and exact live contract operation;
- at least 2 distinct providers reach deterministic static validation and live JSON execution;
- at least 2 persisted recipes replay successfully on the different frozen inputs;
- replay success rate among persisted recipes is 100%;
- planner calls during replay = 0;
- source procurement/spec-fetch calls during replay = 0;
- all nine frozen negative controls are **verified as executed and rejected**;
- wrong/unknown operations accepted = 0;
- undeclared parameters accepted = 0;
- invalid typed bindings accepted = 0;
- unsupported transforms accepted = 0;
- non-GET operations accepted = 0;
- host-policy violations accepted = 0;
- redirects followed = 0;
- credentials supplied = 0;
- arbitrary code executed = 0;
- fingerprint evidence is non-vacuous: at least 2 persisted recipes, each with non-empty spec and recipe fingerprints;
- the active empty-spec-fingerprint mutation causes the same fingerprint predicate used by the final gate to return `false`.

Otherwise the formal decision is `REASSESS_CONTRACT_AWARE_TYPED_SOURCE_PROCUREMENT_VERIFIED`.

No threshold may be relaxed after execution.

## Interpretation boundary
A GO certifies the 3P2 bounded procurement result with the previously missing fingerprint-control evidence. It demonstrates bounded autonomous provider/operation procurement and typed adapter compilation from a small, frozen, live OpenAPI candidate index, plus deterministic recipe reuse on different inputs.

It does **not** demonstrate unrestricted open-web source discovery, arbitrary API integration, universal transformation synthesis, paid/commercial procurement, autonomous economic selection, or general open-world capability acquisition.
