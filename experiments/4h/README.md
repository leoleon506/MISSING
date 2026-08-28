# Experiment 4H — Task–Operation Semantic Alignment

## Status
Preregistered engineering-recovery experiment over the already-burned 4A workload. No fresh blind holdout is consumed.

This README MUST be the first commit on the 4H branch.

## Frozen base
- 4G merge SHA: `547e72a94345b978cc64fdb18c3330736742a927`
- 4G workflow: `Run MISSING Experiment 4G`
- workflow run: `33129796635`
- job: `98716389469`
- event: `workflow_dispatch`
- artifact: `9670338347`
- artifact digest: `sha256:5fdca4808d9da835f4e771a52a97d627637c902437f3fa9474e4da08f7c03169`
- decision: `REASSESS_4G_EVIDENCE_NATIVE_OPERATION_SEMANTICS`
- report fingerprint: `886f4f64806de56fcf5f48339e5757125041a9046ed6d86c91c03d75368e329d`
- ledger fingerprint: `a01ed80d89d67a261f51b6fd35cc5e102c6f3f2f45304eddcaf1b0426487d6f3`
- ledger events: `4030`
- fixed model: `gpt-4.1-mini-2025-04-14`

## Frozen 4G outcome
- 24 cases / 8 families
- 8 successful manufactures / 4 families / 8 providers / 8 recipes
- replay 8/8 = 100%
- R4 capability recovery: 4/6 (`npm_package_metadata`, `cocktail_name_metadata`, `gender_estimate_by_name`, `artwork_object_metadata`)
- R4 still missing: `food_barcode_metadata`, `vin_vehicle_metadata`
- 124 synthesis attempts
- 28 no-operation attempts
- 84 operation-unusable attempts
- semantic pre-probe failure rate: `(28 + 84) / 124 = 90.3226%`
- 108 accepted operation hypotheses
- 23 unique rendered probe URLs
- 23 schema probes / 13 2xx JSON
- 8 successful manufactures from 13 successful JSON probes
- 32,720 task/operation or parameter correspondence rejects
- 2 successful recipes depending on actually reference-expanded evidence
- `authLikeRenderedRequests = 7`, all blocked before network execution
- `knownAuthProbeAttempts = 0`
- `wrongTaskProbeAttempts = 0`
- `documentationOriginFallbacks = 0`
- `standaloneUrlPromotions = 0`
- validator graph mismatch = 0
- controls 42/42
- total LLM cost `$0.23179`
- mean LLM cost/success `$0.02897`

## Frozen forensic interpretation
4G materially improved operation acquisition and semantic normalization. The remaining ceiling is no longer dominated by crawling or documentation parsing.

1. **Task↔operation alignment is now the dominant bottleneck.** Open Food Facts and NHTSA both expose large sets of acquired/normalized operations, but none survives into an executable hypothesis for their target tasks.
2. **Evidence volume is now excessive relative to discrimination.** 32,720 candidate operations were rejected while only 108 hypotheses survived. We need a better provider-blind semantic frame rather than broader extraction.
3. **The downstream funnel is healthy once a request reaches probe.** 13 successful JSON probes yielded 8 manufactures, so crawling/probing should not be expanded further.
4. **Auth safety worked at the network boundary but too late.** Seven auth-like rendered candidates were detected and blocked before network. 4H should prune optional/unbound auth-like slots before hypothesis rendering so this count becomes zero without weakening credential safety.
5. **Reference expansion is now causally validated.** Two successful recipes came from actually expanded evidence. This subsystem must be retained unchanged.

## 4H hypothesis
Keep 4G evidence acquisition, Documentation IR, endpoint normalization, API-base linking, reference expansion, schema probing, observed response mapping, double live verification and changed-input replay. Modify only the alignment layer between a task and a normalized operation.

```text
4G Operation4G candidates
        ↓
TASK SEMANTIC FRAME
  entity tokens
  action tokens
  identifier-role tokens
  required-output tokens
        ↕
OPERATION SEMANTIC FRAME
  heading/title/context
  path/query key tokens
  parameter-role tokens
  concrete example relations
  documented response vocabulary when already present
        ↓
MULTI-SIGNAL ALIGNMENT
        ↓
EARLY OPTIONAL AUTH-SLOT PRUNING
        ↓
unchanged 4G safe request compiler → probe → validator → double live → replay
```

## Task semantic frame
A task frame is derived mechanically and provider-blind from only the frozen case definition:
- normalized tokens from `intent`
- normalized tokens from task input names
- normalized tokens from required output names
- identifier morphology from input names

No provider/domain/endpoint/vertical seed tables are permitted.

Required metrics:
- `taskFrameTokens`
- `taskFrameEntityTokens`
- `taskFrameActionTokens`
- `taskFrameIdentifierTokens`
- `taskFrameOutputTokens`

## Operation semantic frame
An operation frame is derived mechanically from acquired evidence only:
- operation title / local heading
- local context
- URL path segment tokens
- query key tokens
- parameter names/descriptions
- concrete build-value relations already evidenced
- response-field vocabulary only when it is already present in documentation or successful schema-probe evidence; response fields may support selection but may not invent request bindings

Required metrics:
- `operationFrameCandidates`
- `operationFrameWithIdentifierSignal`
- `operationFrameWithEntitySignal`
- `operationFrameWithActionSignal`
- `operationFrameWithOutputSignal`

## Multi-signal alignment rule
A task→operation correspondence may be accepted only when the operation has a proven request influence path for every task input AND reaches a minimum semantic score from independent evidence dimensions.

Frozen dimensions:
1. **identifier signal** — task input morphology vs parameter/query/path label morphology, or exact documented build value at a unique replaceable position
2. **entity signal** — overlap between task intent/output nouns and operation heading/path/context nouns
3. **action signal** — overlap such as lookup/search/get/decode/estimate/retrieve/metadata derived from text, not a provider-specific table
4. **output-support signal** — overlap between required output names and documented response vocabulary on that exact operation/document scope

Acceptance requires:
- identifier signal is mandatory
- plus at least one of entity/action/output-support signals
- generic identifier stems (`id`, `name`, `code`, `value`, `key`, `identifier`) require at least two non-identifier support signals
- `one task input + one request slot => bind` remains forbidden
- no provider-specific synonyms or case-specific endpoint/domain literals

Required metrics:
- `alignmentCandidates`
- `alignmentAccepted`
- `alignmentRejectedNoIdentifier`
- `alignmentRejectedInsufficientSupport`
- `alignmentRejectedGenericIdentifier`
- `alignmentAcceptedByConcreteExample`
- `alignmentAcceptedByMorphology`
- `alignmentScoreHistogram`

## Early auth-slot pruning
Before a request hypothesis is emitted:
- any auth-like slot not bound to a task input and not required by the anonymous operation must be removed from the anonymous hypothesis
- any auth-like slot that is REQUIRED or appears materially in the rendered request blocks the hypothesis
- no auth-like literal is copied into a credential-free hypothesis
- pruning may never convert an explicitly authenticated-only operation into an anonymous one

Required metrics:
- `optionalAuthSlotsPruned`
- `requiredAuthSlotsBlocked`
- `authLikeHypothesesRejectedBeforeRender`
- `authLikeRenderedRequests = 0`
- `knownAuthProbeAttempts = 0`

## OFF / NHTSA diagnostic requirement
Without provider-specific logic, the report must expose for `food_barcode_metadata` and `vin_vehicle_metadata`:
- number of normalized operations
- top alignment rejection reason counts
- number with identifier signal
- number with entity/action/output support
- hypotheses emitted
- probes attempted

This is diagnostic only; no target-specific shortcut is allowed.

## Same-graph invariant
Planner and validator must reconstruct the identical 4H semantic alignment graph from the same 4G operations.

Successful contracts use:
`4H_TASK_OPERATION_ALIGNMENT:<hypothesis_id>`

Old P1/4B/4C/4D/4E/4F/4G prefixes reject.

## Causal tests required before benchmark
1. Existing 4G npm `package_name ↔ package` style morphology remains accepted when operation context supports package metadata.
2. Generic `{id}` with unrelated task semantics remains rejected.
3. A barcode/product task can align to a documented operation with `code`/barcode influence plus product/entity context without a provider-specific synonym table.
4. A VIN/vehicle task can align to a documented VIN influence path plus vehicle/decode context.
5. Identifier-only overlap with no semantic support rejects.
6. Generic `name`/`id` requires two non-identifier support signals.
7. A concrete build value at one unique request position may provide identifier signal but still requires contextual support.
8. Optional auth-like query slot is pruned before render when anonymous operation is proven and slot is unbound.
9. Required auth-like slot rejects before render.
10. Rendered Authorization/key/token material can never reach network.
11. Expanded-evidence provenance remains attached through hypothesis and recipe.
12. Same 4H graph validates; 4G and older prefixes reject.
13. Source audit proves no frozen provider/domain/endpoint seeds.

## Engineering recovery gate
4H is GO only if ALL required gates are satisfied:
- recover >=5 of 6 capabilities previously demonstrated by R4
- >=8 successful manufactures total
- >=4 families with success
- changed-input replay >=95%
- zero replay cognition/documentation/synthesis/schema-probe deltas
- zero numeric-index decisions
- zero documentation-origin fallbacks
- zero standalone navigation URL promotions
- zero validator graph mismatch rejects
- zero duplicate rendered probe URLs actually executed per provider/case
- `authLikeRenderedRequests = 0`
- `knownAuthProbeAttempts = 0`
- `wrongTaskProbeAttempts = 0`
- 42/42 controls and event-derived safety clean
- retain >=1 confirmed relative-operation/API-base recipe
- retain >=1 successful recipe from actually reference-expanded evidence
- aggregate diagnostics equal per-attempt recomputation

Preferred economics:
- total LLM cost <= `$0.60`
- mean LLM cost/success <= `$0.15`

## Diagnostic targets
Compared with 4G:
- semantic pre-probe failure rate <70%
- retain all 8 4G successes if their evidence remains available
- recover at least one of `food_barcode_metadata` or `vin_vehicle_metadata` to reach >=5/6 R4
- `authLikeRenderedRequests` falls from 7 to 0
- accepted alignment precision remains high enough that `wrongTaskProbeAttempts = 0`

If 4H recovers <5/6 R4 capabilities, do NOT automatically create 4HR/4HR2. Attribute the remaining ceiling before another experiment.

## Formal benchmark decision
- `GO_4H_TASK_OPERATION_SEMANTIC_ALIGNMENT`
- otherwise `REASSESS_4H_TASK_OPERATION_SEMANTIC_ALIGNMENT`
