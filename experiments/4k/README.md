# Experiment 4K — Route-Family Variable Slot Induction

## Status
Preregistered engineering-recovery experiment over the already-burned 4A workload. No fresh blind holdout is consumed.

This README MUST be the first commit on the 4K branch.

## Frozen base
- 4J merge SHA: `93b3aef43f0c35657bc222629ce85fb9d22fad95`
- 4J workflow: `Run MISSING Experiment 4J`
- workflow run: `33143735549`
- job: `98760125966`
- event: `workflow_dispatch`
- artifact: `9675575746`
- artifact digest: `sha256:21243257284c90d5f2766a075d26ade3d9bc17881e7ba5c6b2a9377f6a01cd8e`
- decision: `REASSESS_4J_ENTITY_GATED_DOCUMENTED_IDENTIFIER_ROLES`
- report fingerprint: `aa3d67526fe00ceff2c7ac8ced077418e54c28e9e4a0fbad02f6d78114a267de`
- ledger fingerprint: `10c83e68ca5409804fa254d4c1fe95898e25c5ed18cc132bfc0c11aef42cb6ec`
- ledger events: `4424`
- fixed model: `gpt-4.1-mini-2025-04-14`

## Frozen 4J outcome
- 24 cases / 8 families
- 6 successful manufactures / 4 families / 6 providers / 6 recipes
- replay 6/6 = 100%
- R4 capability recovery: 4/6 (`npm_package_metadata`, `cocktail_name_metadata`, `gender_estimate_by_name`, `artwork_object_metadata`)
- 137 synthesis attempts
- 29 no-operation attempts
- 96 alignment-unusable attempts
- semantic pre-probe failure rate: `(29 + 96) / 137 = 91.2409%`
- 56 request hypotheses
- 25 unique rendered probe URLs
- 25 schema probes / 12 2xx JSON / 6 confirmed contracts
- `authLikeRenderedRequests = 0`
- `knownAuthProbeAttempts = 0`
- `wrongTaskProbeAttempts = 0`
- `entityIncompatibleStructuralProbeAttempts = 0`
- false character→books recipe absent
- placeholder preservation failures: 0
- non-auth request text mutations: 0
- controls 42/42
- total LLM cost `$0.23082199999999994`
- mean LLM cost/success `$0.03847033333333332`

## Frozen 4J successful recipes
1. npm Registry — `npm_package_metadata`
2. TheMealDB — `meal_name_metadata` — reference-expanded evidence
3. TheCocktailDB — `cocktail_name_metadata` — reference-expanded evidence
4. Agify.io — `age_estimate_by_name`
5. Genderize.io — `gender_estimate_by_name`
6. Metropolitan Museum of Art — `artwork_object_metadata` — relative operation/API-base relation retained

## Frozen forensic attribution
### What 4J proved
- Entity-gated identifier policy removed the known false `fictional_character_metadata → /api/books/{...}` success.
- npm and Met remained valid after representation-preserving auth handling.
- expanded reference evidence still produced confirmed recipes.
- no auth-like rendered request, known-auth probe, wrong-task probe, placeholder corruption or non-auth request mutation occurred.

### What 4J did not solve
1. **Open Food Facts still produced zero hypotheses.** The correct provider had 213 operations, 129 linked operation frames, strong product/entity support, but `operationFrameWithIdentifierSignal = 0` and all 129 usable frames were rejected as `no_identifier`.
2. **NHTSA still produced zero hypotheses.** The correct provider had 195 operations, 29 linked operation frames, strong vehicle/entity support, but `operationFrameWithIdentifierSignal = 0` and all 29 usable frames were rejected as `no_identifier`.
3. Exact documented-placeholder acceptance remained zero in aggregate. The useful request role is not necessarily represented as a normalized named parameter or placeholder in the extracted IR.
4. The remaining ceiling is therefore identifier-role evidence, not provider ranking, API-base discovery, response mapping, replay or auth safety.

## 4K hypothesis
Keep 4J acquisition, Documentation IR, reference expansion, API-base linking, entity gates, auth safety, probing, observed-response mapping, validation, double-live verification and zero-cognition replay.

Add a provider-blind **route-family variable-slot induction** layer that can prove a request input role from multiple documented requests in the same operation family even when the documentation does not name the role.

```text
Documented request targets
        ↓
ROUTE FAMILY
same method + API origin + structural route shape
        ↓
PAIRWISE / FAMILY DIFFERENCE
all route/query structure constant
except exactly one entire path segment or query value
        ↓
VARIABLE SLOT PROOF
>=2 distinct documented values at the same position
        ↓
ENTITY + ACTION/OUTPUT COMPATIBILITY
        ↓
Task input may bind to induced slot
        ↓
auth pruning → safe probe → mapping → validator → double live → replay
```

## Route-family definition
A route family may be formed only from already-acquired documented request evidence.

Members must agree on:
- HTTP method (`GET` only for executable hypotheses)
- API origin
- path segment count
- query-key set after excluding auth-like keys
- constant path/query structure outside the candidate variable position

A family variable slot is admissible only when:
- there are at least 2 distinct documented members;
- exactly one request position varies across the supporting members;
- the varying position is an entire path segment or entire query value;
- at least 2 distinct concrete values are observed at that same position;
- host, scheme and port never vary;
- auth-like keys/values are never used as variable-slot evidence;
- repeated/multiple varying positions reject as ambiguous;
- substring-only differences reject;
- navigation/assets reject;
- the evidence IDs and source URLs of every supporting member are persisted.

## Task binding policy
Route-family induction proves **that a variable request role exists**, not automatically what it means.

Binding an induced slot to the task input additionally requires:
- task/operation entity compatibility; and
- at least one independent action or output support category; and
- no documented entity contradiction.

One-input/one-slot alone remains forbidden.

No provider/domain/endpoint/vertical-specific seed tables or synonyms are permitted.

## Structural shape support
Observed family values may contribute only provider-blind shape facts such as:
- numeric
- alphabetic
- alphanumeric
- UUID-like
- fixed/variable length class

Shape is supporting evidence only; it cannot override an entity contradiction or create a slot from a single example.

## Request preservation and auth invariants
4J request preservation/auth behavior is frozen:
- optional auth removal must not serialize/rewrite non-auth request bytes;
- placeholders and induced slots remain literal until input substitution;
- any auth-like rendered request rejects before network;
- compile-invalid and URL-parse-invalid remain separate from actual auth-like rendering.

## Required 4K metrics
- `routeFamilyCandidates`
- `routeFamiliesAccepted`
- `routeFamiliesRejectedInsufficientMembers`
- `routeFamiliesRejectedMultipleVariablePositions`
- `routeFamiliesRejectedOriginMismatch`
- `routeFamiliesRejectedQueryShapeMismatch`
- `routeFamiliesRejectedAuthLike`
- `routeFamilyMembers`
- `routeFamilyInducedPathSlots`
- `routeFamilyInducedQuerySlots`
- `routeFamilyDistinctObservedValues`
- `routeFamilyShapeSupportedBindings`
- `routeFamilyEntityRejectedBindings`
- `routeFamilySecondarySupportRejectedBindings`
- `routeFamilyHypotheses`
- `routeFamilyProbeCalls`
- `routeFamilyProbe2xxJson`
- `routeFamilyConfirmedRecipes`
- `routeFamilyExpandedEvidenceRecipes`
- plus all 4J safety, preservation, replay and provenance metrics.

## Same-graph invariant
Planner and validator must reconstruct the identical 4K graph from the same evidence.

Successful contracts produced by the new policy use:
`4K_ROUTE_FAMILY_VARIABLE_SLOT:<hypothesis_id>`

4J and older provenance prefixes reject in the 4K validator.

## Causal tests required before benchmark
1. Two same-family GET paths differing in exactly one whole segment induce one path slot.
2. Three same-family query requests differing only in one query value induce one query slot.
3. Different hosts never form a family.
4. Different methods never form an executable family.
5. Two simultaneously varying path/query positions reject as ambiguous.
6. Substring-only differences do not induce a slot.
7. Repeated identical examples do not satisfy the >=2 distinct-value requirement.
8. Auth-like query values never become induced slots.
9. OFF-style product requests with two documented product-code values plus product entity/action/output support may bind task `barcode` without a named `IrParameter`.
10. NHTSA-style vehicle decode requests with two documented identifier values plus vehicle/decode support may bind task `vin` without a named `IrParameter`.
11. Book route family rejects for fictional-character task because of entity contradiction.
12. Generic unrelated route family rejects despite one task input.
13. Optional auth pruning preserves induced-slot/non-auth request bytes.
14. Actual auth-like rendered request never reaches probe.
15. npm and Met 4J-style documented bindings remain available without requiring route-family induction.
16. Expanded-evidence family members retain provenance.
17. Planner and validator rebuild the same graph; 4J/older prefixes reject.
18. Provider-blind source audit finds no provider/domain/endpoint seed literals.

## Engineering recovery gate
4K is GO only if ALL required gates pass:
- recover >=5 of 6 R4 capabilities
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
- zero entity-incompatible structural/route-family probes
- false character→books recipe absent
- `placeholderPreservationFailures = 0`
- `nonAuthRequestTextMutations = 0`
- controls 42/42 and event-derived safety clean
- retain >=1 confirmed relative-operation/API-base recipe
- retain >=1 successful recipe from actually reference-expanded evidence
- **>=1 confirmed recipe whose request role is proven by route-family induction**
- aggregate diagnostics equal per-attempt recomputation

Preferred economics:
- total LLM cost <= `$0.60`
- mean LLM cost/success <= `$0.15`

## Diagnostic targets
- retain npm + Met
- retain false character→books rejection
- recover at least one of OFF/NHTSA, targeting both
- R4 >=5/6
- semantic pre-probe failure rate <70%
- demonstrate that route-family evidence, not provider-specific knowledge, caused at least one new valid capability.

If 4K recovers <5/6 R4 capabilities, do NOT automatically create 4KR/4KR2. Attribute the remaining ceiling first.

## Formal decision
- `GO_4K_ROUTE_FAMILY_VARIABLE_SLOT_INDUCTION`
- otherwise `REASSESS_4K_ROUTE_FAMILY_VARIABLE_SLOT_INDUCTION`
