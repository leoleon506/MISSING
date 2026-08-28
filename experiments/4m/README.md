# Experiment 4M — Executed Acquisition Trace → Operation Proof

## Status
Preregistered engineering-recovery experiment over the already-burned 4A workload. No fresh blind holdout is consumed.

This README MUST be the first commit on the 4M branch.

## Frozen base
- 4L merge SHA: `a936218a82f8c38156dbef516c1271159b1b18c4`
- 4L workflow: `Run MISSING Experiment 4L`
- workflow run: `33152056691`
- job: `98786089276`
- artifact: `9678841802`
- artifact digest: `sha256:d96b5bab091af0cf0bc2e8f77d0af0354ae207fa47d7faf0ca9ca3922c63c81e`
- decision: `REASSESS_4L_EXECUTABLE_API_OPERATION_FAMILY_GATING`
- report fingerprint: `39f477370a15b96e902dc7075563136f2de6f5f8d0c0ab7573dd55c1d7a87a19`
- fixed model: `gpt-4.1-mini-2025-04-14`

## Frozen 4L outcome
- 24 cases / 8 families
- 6 successful manufactures / 4 families / 6 providers / 6 recipes
- replay 6/6 = 100%
- R4 recovery: 4/6
- 138 synthesis attempts
- 30 no-operation attempts
- 32 alignment-unusable attempts
- 387 request hypotheses
- 178 schema probes / 14 2xx JSON / 6 confirmed contracts
- route families: 54,770 candidates / 327 accepted / 155 probes / 4 2xx JSON / 0 confirmed recipes
- executable gate: 55,550 candidates / 27,631 accepted / 13,500 assets rejected / 1,384 navigation rejected / 284 documentation rejected / 12,751 no-positive-signal rejected
- run-local probe cache: 9 hits / 169 network fetches / 0 duplicate network fetches
- doc fetches: 2,032
- spec probe fetches: 1,237
- benchmark duration: `1,789,495 ms` (~29m 49.5s)
- `authLikeRenderedRequests = 0`
- `knownAuthProbeAttempts = 0`
- `wrongTaskProbeAttempts = 0`
- `entityIncompatibleStructuralProbeAttempts = 0`
- false character→books recipe absent
- placeholder preservation failures: 0
- non-auth request text mutations: 0
- controls 42/42
- total LLM cost `$0.2323944`
- mean LLM cost/success `$0.0387324`

## Frozen 4L attribution
4L materially reduced runtime and removed tens of thousands of obvious non-API operations, but did not increase R4 recovery or confirmed route-family recipes.

The decisive forensic observation is that acquisition had already fetched correct API-shaped requests for the two missing R4 cases, but operation synthesis later drifted away from those executed requests:
- vehicle decode acquisition reached an executed `vpic` DecodeVin-style URL, while later synthesis produced a `www` website-root route;
- product acquisition reached an executed `/api/v2/product/<concrete-id>` style URL, while later synthesis promoted `/data/...` or static/data families.

Therefore the remaining ceiling is **loss of request identity/provenance between acquisition and operation synthesis**.

## 4M hypothesis
An actually executed acquisition GET is stronger evidence than a later reconstructed URL.

Keep 4L Documentation IR, reference expansion, executable gating, entity/auth/request-preservation controls, observed-response mapping, validation, double-live verification and zero-cognition replay.

Add an **Executed Acquisition Trace Operation Proof** layer:

```text
Acquisition follows documented candidate
        ↓
actual normalized GET URL executed
        ↓
immutable response metadata/body fingerprint
        ↓
TRACE OPERATION PROOF
  preserve origin + path + query exactly
        ↓
infer only a documented/concrete variable slot
        ↓
entity + action/output compatibility
        ↓
safe changed-input probe
        ↓
observed mapping → validator → double live → replay
```

The compiler MUST NOT swap the trace origin for another origin, reconstruct a website-root URL from the same evidence, or promote a request target that was never executed.

## Trace eligibility
A trace-derived operation may be created only when all are true:
1. request was actually executed during this same benchmark run by documentation/reference/spec acquisition;
2. method is GET and normalized URL is HTTPS/public/safety-clean;
3. trace is linked to the same provider candidate/evidence lineage used by the current synthesis attempt;
4. response is not a hard network failure;
5. request is not an asset/navigation/documentation target under 4L hard-negative policy;
6. trace origin/path/query are preserved byte-for-byte except for surgical auth removal and the single induced task-input slot;
7. slot inference is grounded by at least one of:
   - exact task build value occurs once as a whole path segment or whole query value in the executed request; or
   - >=2 executed traces in the same trace family differ in exactly one whole path/query value; or
   - named/documented placeholder/parameter evidence already accepted by the prior graph;
8. entity compatibility plus independent action/output support still pass;
9. one-input/one-slot alone remains forbidden.

## Trace-family policy
Executed traces may be grouped only when:
- same method;
- same origin;
- same path segment count;
- same non-auth query-key set;
- exactly one whole path segment or query value varies;
- >=2 distinct concrete values;
- no asset/navigation/documentation contradiction.

No provider/domain/endpoint-specific seed tables or synonyms are permitted.

## Request-response echo support
For a successful structured acquisition response, a concrete value from the executed request may gain additional identifier evidence when the same normalized scalar value appears in the response body or observed response metadata.

Echo is supporting evidence only; it cannot override entity contradiction, auth, asset/navigation rejection or origin preservation.

## Run-local acquisition/spec cache
4M may cache identical acquisition/spec GET URLs **within this benchmark run only**.

Rules:
- key is normalized exact GET URL after existing safe URL normalization;
- first request performs network fetch and stores immutable response/error metadata;
- subsequent same-run requests reuse the immutable result;
- provenance consumers each retain their own evidence IDs/lineage even when bytes are reused;
- cache never persists across runs/artifacts;
- live verification of manufactured contracts is NOT served from this acquisition cache;
- replay remains zero external calls;
- no unique eligible URL may be skipped.

## Required 4M metrics
- `acquisitionTraceEvents`
- `acquisitionTraceDistinctUrls`
- `acquisitionTraceEligible`
- `acquisitionTraceRejectedAsset`
- `acquisitionTraceRejectedNavigation`
- `acquisitionTraceRejectedDocumentation`
- `acquisitionTraceRejectedLineage`
- `acquisitionTraceRejectedAuthLike`
- `acquisitionTraceExactBuildValueSlots`
- `acquisitionTraceFamilySlots`
- `acquisitionTraceEchoSupportedSlots`
- `acquisitionTraceHypotheses`
- `acquisitionTraceProbeCalls`
- `acquisitionTraceProbe2xxJson`
- `acquisitionTraceConfirmedRecipes`
- `acquisitionTraceOriginDriftRejects`
- `acquisitionTraceRequestMutationRejects`
- `acquisitionCacheHits`
- `acquisitionNetworkFetches`
- `specProbeCacheHits`
- `specProbeNetworkFetches`
- `duplicateAcquisitionNetworkFetches`
- `duplicateSpecProbeNetworkFetches`
- wall-clock benchmark duration
- all 4L route-family, executable-gate, safety, preservation, provenance and replay metrics.

## Causal tests required before benchmark
1. Executed product API trace containing build barcode once may induce `{barcode}` while preserving origin/path.
2. Executed vehicle DecodeVin-style trace containing build VIN once may induce `{vin}` while preserving origin/path.
3. Same evidence may NOT substitute a different website/API origin.
4. Whole-value occurrence is required; substring-only occurrence rejects.
5. Ambiguous repeated build value rejects.
6. Two same-origin executed traces differing in exactly one whole segment may induce one trace-family slot.
7. Different origins never form a trace family.
8. Asset/image/script traces reject before hypothesis.
9. Documentation/navigation traces reject before hypothesis.
10. Auth-like rendered trace request never reaches network.
11. Response echo may strengthen an otherwise structurally grounded slot but cannot create one from unrelated text.
12. Trace from another provider candidate/evidence lineage rejects.
13. Planner and validator reconstruct the same trace graph.
14. Validator rejects origin drift and non-slot request mutation.
15. Identical acquisition URL requested twice performs one acquisition network fetch and one cache hit.
16. Identical spec URL requested twice performs one spec network fetch and one cache hit.
17. Cache reset causes the URL to fetch again in a new run/test lifecycle.
18. Cache reuse preserves per-consumer provenance while response/body fingerprint remains identical.
19. Existing npm/Met documented recipes remain possible.
20. Existing expanded-reference recipe path remains possible.
21. False character→books recipe remains absent.
22. Provider-blind source audit finds no provider/domain/endpoint seed literals.

## Engineering recovery gate
4M is GO only if ALL required gates pass:
- recover >=5 of 6 R4 capabilities
- >=8 successful manufactures total
- >=4 families with success
- changed-input replay >=95%
- zero replay cognition/documentation/synthesis/schema-probe deltas
- zero numeric-index decisions
- zero documentation-origin fallbacks
- zero standalone navigation URL promotions
- zero validator graph mismatch rejects
- `authLikeRenderedRequests = 0`
- `knownAuthProbeAttempts = 0`
- zero entity-incompatible structural/trace probes
- false character→books recipe absent
- `placeholderPreservationFailures = 0`
- `nonAuthRequestTextMutations = 0`
- `acquisitionTraceOriginDriftRejects = 0` for all confirmed recipes
- `acquisitionTraceRequestMutationRejects = 0` for all confirmed recipes
- `duplicateAcquisitionNetworkFetches = 0`
- `duplicateSpecProbeNetworkFetches = 0`
- controls 42/42 and event-derived safety clean
- retain >=1 confirmed relative-operation/API-base recipe
- retain >=1 successful recipe from actually reference-expanded evidence
- **>=1 confirmed recipe whose request operation is proven directly by an executed acquisition trace**
- aggregate diagnostics equal per-attempt recomputation

Preferred economics:
- total LLM cost <= `$0.60`
- mean LLM cost/success <= `$0.15`

## Runtime target
Diagnostic target, not a scientific GO gate:
- benchmark duration <=25 minutes;
- target <=20 minutes if acquisition/spec cache exposes enough duplication;
- report acquisition/spec cache savings separately from probe-cache savings.

If 4M recovers <5/6 R4 capabilities, do NOT automatically create 4MR/4MR2. Attribute the remaining ceiling first.

## Formal decision
- `GO_4M_EXECUTED_ACQUISITION_TRACE_OPERATION_PROOF`
- otherwise `REASSESS_4M_EXECUTED_ACQUISITION_TRACE_OPERATION_PROOF`
