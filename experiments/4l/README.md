# Experiment 4L — Executable API Operation Family Gating

## Status
Preregistered engineering-recovery experiment over the already-burned 4A workload. No fresh blind holdout is consumed.

This README MUST be the first commit on the 4L branch.

## Frozen base
- 4K merge SHA: `6681c0f681959597ab75d2130fa15c37d8b979fa`
- 4K workflow: `Run MISSING Experiment 4K`
- workflow run: `33148052962`
- job: `98773401490`
- event: `workflow_dispatch`
- artifact: `9677417376`
- artifact digest: `sha256:c936ac0476f9c4ca816cd83222db4551b0bc9560d9fa4912963856fc2eb05c9d`
- decision: `REASSESS_4K_ROUTE_FAMILY_VARIABLE_SLOT_INDUCTION`
- report fingerprint: `7e6333c583b458e4dcba0b427df52fc81583423c327d846b3757ee3d992676f4`
- fixed model: `gpt-4.1-mini-2025-04-14`

## Frozen 4K outcome
- 24 cases / 8 families
- 6 successful manufactures / 4 families / 6 providers / 6 recipes
- replay 6/6 = 100%
- R4 recovery: 4/6
- 138 synthesis attempts
- 30 no-operation attempts
- 26 alignment-unusable attempts
- semantic pre-probe failure rate: `(30 + 26) / 138 = 40.5797%`
- 581 request hypotheses
- 223 unique rendered probe URLs
- 223 schema probes / 16 2xx JSON / 6 confirmed contracts
- route-family: 51,163,126 candidate comparisons / 521 accepted families / 196 route-family probes / 4 route-family 2xx JSON / 0 route-family confirmed recipes
- `authLikeRenderedRequests = 0`
- `knownAuthProbeAttempts = 0`
- `wrongTaskProbeAttempts = 0`
- `entityIncompatibleStructuralProbeAttempts = 0`
- false character→books recipe absent
- placeholder preservation failures: 0
- non-auth request text mutations: 0
- controls 42/42
- total LLM cost `$0.23253599999999996`
- mean LLM cost/success `$0.03875599999999999`

## Frozen 4K attribution
4K proved that route-family induction can recover variable request positions mechanically, including cases where no normalized named parameter exists. It also reduced the semantic pre-probe failure rate from 4J's ~91.24% to 40.58%.

However, 4K's new recall was dominated by non-API route families:
- Open Food Facts produced route-family probes into static JS, images and logo assets rather than the product API family.
- NHTSA produced route-family probes into website/image/navigation families rather than the vPIC data API family.
- One route-family probe reached a 2xx JSON Wayback endpoint for a taxonomy task, but downstream semantic validation correctly rejected it.

The remaining ceiling is therefore **executable API-operation discrimination before probing**, not identifier-role discovery.

## 4L hypothesis
Keep 4K route-family induction, 4J/4K entity/auth/request-preservation gates, Documentation IR, reference expansion, API-base linking, observed-response mapping, validation, double-live verification and zero-cognition replay.

Add a provider-blind **Executable API Operation Gate** before route-family hypotheses are eligible for probe.

```text
Documented operations / route families
              ↓
EXECUTABLE API OPERATION GATE
  positive evidence:
  - API/data section semantics
  - request/response pairing or JSON/data response semantics
  - API-base / endpoint relationship
  - operation verb / endpoint label / OpenAPI request form
  negative evidence:
  - static assets
  - images/icons/fonts/styles/scripts
  - navigation/pages/marketing/download links
  - documentation URLs themselves
  - unrelated web/archive utility families
              ↓
VARIABLE SLOT INDUCTION
              ↓
entity + secondary support
              ↓
safe probe → observed mapping → validator → double live → replay
```

## Executable-operation gate policy
A route family is probe-eligible only if ALL are true:
1. it has an API-origin relationship already grounded by the Documentation IR;
2. it has at least one **positive executable signal** from the local operation/section/evidence context;
3. it has no **hard asset/navigation signal** in the request target or local operation context;
4. its family members remain same-method/same-origin/same-shape under 4K rules;
5. entity compatibility and independent action/output support still pass;
6. auth safety and request preservation still pass.

Positive executable signals are provider-blind structural/documentary categories only, such as:
- OpenAPI/Swagger operation form;
- explicit `GET`/request example associated with endpoint/API/data wording;
- endpoint/request label;
- local response/JSON/data wording paired with the request block;
- local API-base relation plus operation form that is not an asset/navigation family.

Hard negative categories are provider-blind:
- path/file suffixes for JS/CSS/images/fonts/maps/media/assets;
- static/assets/images/icons/fonts/styles/scripts path segments;
- documentation/help/blog/about/login/signup/download page context;
- same-origin navigation/page links without API/data/request/response evidence;
- documentation-origin URL itself.

No provider/domain/endpoint-specific allowlist or denylist is permitted.

## 4L runtime optimization policy
The benchmark must retain the same 24-case workload and same scientific gates. Runtime may be reduced only by eliminating duplicate or preregistered-ineligible work.

Allowed optimizations:
1. **pre-probe gating:** executable-operation rejection happens before network probes;
2. **same-run deterministic probe cache:** within one benchmark run only, an identical rendered GET URL may be fetched at most once and its immutable probe result reused for duplicate hypotheses/cases;
3. **same-run documentation/spec fetch cache:** identical normalized GET URLs requested multiple times inside the same run may reuse the first immutable response where the existing acquisition architecture exposes a safe cache hook;
4. no persisted cache across benchmark runs;
5. cache hits must preserve original provenance and be separately counted;
6. replay remains zero-cognition and zero external calls.

The optimization is invalid if it changes task/provider ranking, removes a unique eligible URL, reuses results across runs, or bypasses any safety/semantic gate.

## Required 4L metrics
- `executableGateCandidates`
- `executableGateAccepted`
- `executableGateRejectedAsset`
- `executableGateRejectedNavigation`
- `executableGateRejectedDocumentation`
- `executableGateRejectedNoPositiveSignal`
- `executableGateAcceptedByOpenApi`
- `executableGateAcceptedByExplicitRequest`
- `executableGateAcceptedByEndpointLabel`
- `executableGateAcceptedByResponseDataContext`
- `executableGateAcceptedByApiBaseRelation`
- `executableGateRouteFamilyHypotheses`
- `executableGateProbeCalls`
- `executableGateProbe2xxJson`
- `executableGateConfirmedRecipes`
- `probeCacheHits`
- `probeNetworkFetches`
- `duplicateProbeNetworkFetches`
- `documentationCacheHits` if acquisition cache is implemented
- `specProbeCacheHits` if acquisition cache is implemented
- wall-clock benchmark duration
- all 4K route-family, safety, preservation, provenance and replay metrics.

## Causal tests required before benchmark
1. API/data request family with response/JSON context is accepted.
2. `static/.../*.js` family is rejected before probe.
3. image/logo/icon/font/media family is rejected before probe.
4. documentation/help/blog/navigation family is rejected before probe.
5. a relative API operation linked to an API base remains accepted.
6. OpenAPI/Swagger operation form is accepted absent asset/navigation contradiction.
7. explicit endpoint/request label is accepted absent contradiction.
8. API-base relation alone cannot override a hard asset signal.
9. same URL rendered from two hypotheses produces one network probe and one cache reuse within the same run.
10. cache is run-local and cannot be loaded from a prior benchmark artifact.
11. cache reuse preserves schema/body fingerprints and evidence provenance.
12. OFF-style static JS/image route families reject, while a product API/data family remains eligible in a synthetic provider-blind fixture.
13. NHTSA-style website/image navigation rejects, while a vehicle decode API/data family remains eligible in a synthetic provider-blind fixture.
14. Wayback/archive utility family for an unrelated entity is rejected by executable+entity/semantic gating before becoming a confirmed recipe.
15. auth-like rendered request never reaches network.
16. false character→books recipe remains absent.
17. npm and Met documented bindings remain available.
18. expanded-evidence recipe path remains possible.
19. planner and validator rebuild the same graph.
20. provider-blind source audit finds no provider/domain/endpoint seed literals.

## Engineering recovery gate
4L is GO only if ALL required gates pass:
- recover >=5 of 6 R4 capabilities
- >=8 successful manufactures total
- >=4 families with success
- changed-input replay >=95%
- zero replay cognition/documentation/synthesis/schema-probe deltas
- zero numeric-index decisions
- zero documentation-origin fallbacks
- zero standalone navigation URL promotions
- zero validator graph mismatch rejects
- zero duplicate rendered probe URLs actually fetched from network per run
- `authLikeRenderedRequests = 0`
- `knownAuthProbeAttempts = 0`
- zero entity-incompatible structural/route-family probes
- false character→books recipe absent
- `placeholderPreservationFailures = 0`
- `nonAuthRequestTextMutations = 0`
- controls 42/42 and event-derived safety clean
- retain >=1 confirmed relative-operation/API-base recipe
- retain >=1 successful recipe from actually reference-expanded evidence
- **>=1 confirmed recipe whose request role is route-family-induced and passes the executable-operation gate**
- aggregate diagnostics equal per-attempt recomputation

Preferred economics:
- total LLM cost <= `$0.60`
- mean LLM cost/success <= `$0.15`

## Runtime target
Diagnostic target, not a scientific GO gate:
- reduce `schemaProbeCalls` materially from 223;
- reduce route-family network probes materially from 196;
- target wall-clock benchmark duration <=25 minutes if achievable without changing scientific coverage;
- report cache/gating savings explicitly.

If 4L recovers <5/6 R4 capabilities, do NOT automatically create 4LR/4LR2. Attribute the remaining ceiling first.

## Formal decision
- `GO_4L_EXECUTABLE_API_OPERATION_FAMILY_GATING`
- otherwise `REASSESS_4L_EXECUTABLE_API_OPERATION_FAMILY_GATING`
