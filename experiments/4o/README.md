# Experiment 4O — Relational Response IR & Keyed-Row Projection

## Status
Preregistered engineering-recovery experiment over the already-burned 4A workload. No fresh holdout is consumed.

This README MUST be the first commit on the 4O branch.

## Frozen base
- 4N merge SHA: `07997e9e791f159b118349ef55e5a45a1c92fa5e`
- 4N workflow run: `33183148942`
- 4N job: `98889242301`
- 4N artifact: `9691606038`
- artifact digest: `sha256:9dddb773a52b6b0f8c7660250796f2cc1c582e78ec2e31d702f101bcffe651c8`
- decision: `REASSESS_4N_FIRST_CLASS_EXECUTED_REQUEST_EVIDENCE_GRAPH`
- report fingerprint: `f449fa4fc8e26b10c53fe56404548b191b06f2a1ad5a30aa0e509d4612ccc64b`
- ledger fingerprint: `c91263b6293a6ae7a932783a0669011a6e9f7dfe6f6808bf0ff7410e8f648ca3`
- ledger events: 5984
- model: `gpt-4.1-mini-2025-04-14`

## Frozen 4N outcome
- 24 cases / 8 families
- 6 successful manufactures / 4 families / 6 providers / 6 persisted recipes
- replay 6/6 = 100%
- R4 recovery remained 4/6
- 182 schema probes / 18 2xx JSON / 6 confirmed contracts
- 2,051 first-class executed trace events / 1,652 distinct URLs
- 10 documented-role joins
- 5 executed-trace probes / 1 trace 2xx JSON
- 0 trace-confirmed recipes
- 0 documented-role-confirmed recipes
- benchmark duration: `1,888,905 ms` (~31m 28.9s)
- controls 42/42 and inherited safety counters clean

## Frozen causal attribution
4N crossed the request-induction boundary for the previously missing VIN capability.

A first-class executed trace grounded a mechanically preserved request equivalent to:

```text
/api/vehicles/decodevin/{vin}?format=json&modelyear=2011
```

The changed-input probe reached the correct service and returned 2xx JSON. The remaining failure occurred after request execution, during response interpretation/projection.

The response contains a repeated row structure conceptually like:

```json
{
  "Results": [
    {"Variable": "Suggested VIN", "Value": "..."},
    {"Variable": "Make", "Value": "..."},
    ...
  ]
}
```

The inherited scalar observer traverses only the first element of an array (`Results.0.*`). Therefore it cannot represent a required value located in a later row without introducing a forbidden fixed numeric index.

4N also exposed a projection safety gap: planner schemas offered every `TASK_INPUT:*` as a candidate source for every output, allowing a semantically invalid proposal such as `make <- TASK_INPUT:vin`. Live semantic validation rejected the final contract, but the proposal should be impossible earlier.

## 4O hypothesis
Some public APIs encode records as **repeated labeled rows** rather than object fields. MISSING needs a provider-blind relational response IR that can recognize such row sets from observed runtime JSON and compile a deterministic keyed lookup without binding to any fixed row index.

4O adds a single new projection family:

```text
ROW_LOOKUP(
  array_path,
  label_field,
  label_value,
  value_field
)
```

Example semantics:

```text
ROW_LOOKUP(
  array_path = "Results",
  label_field = "Variable",
  label_value = "Make",
  value_field = "Value"
)
```

This means: iterate all rows in `Results`; find the unique row whose `Variable` value is semantically/equivalently grounded to the requested output role `make`; return its `Value`. No numeric array index is persisted.

## Relational row-set induction requirements
A candidate repeated-row set is admissible only when runtime JSON proves all of the following:
1. an array has >=2 object rows;
2. at least two sampled rows share >=2 scalar field names;
3. one scalar field is a plausible row label/key because it has distinct values across rows;
4. another scalar field is a plausible row value because it contains task-relevant/output-bearing values or non-label scalar payload;
5. label and value fields are distinct;
6. the row-set path and field names are observed in the same successful probe response;
7. no provider/domain/endpoint-specific mapping is used.

The observer may inspect multiple array elements for **schema/row-role induction**, but persisted projection MUST NOT contain an element index.

## Label-value grounding
A `ROW_LOOKUP` label value must be grounded by observed response data, not invented.

Allowed evidence:
- exact normalized match between required output tokens and an observed row-label scalar;
- morphology/token correspondence where one unique observed label dominates alternatives;
- optional LLM choice restricted to the finite set of observed row-label values from the successful probe.

If two labels are equally defensible, reject rather than guess.

## Input-source semantic identity gate
`TASK_INPUT:<input>` may be used for an output only when output and input roles are semantically equivalent under provider-blind normalized role tokens/morphology.

Examples:
- `vin <- TASK_INPUT:vin` allowed
- `barcode <- TASK_INPUT:barcode` allowed
- `make <- TASK_INPUT:vin` forbidden
- `title <- TASK_INPUT:object_id` forbidden

This restriction must exist in BOTH:
1. planner source enumeration / JSON schema, and
2. validator reconstruction.

The LLM must never be offered a forbidden input source.

## Projection execution requirements
`ROW_LOOKUP` must:
- traverse the named array path at runtime;
- compare the named label field to the grounded label value using frozen normalization;
- require exactly one matching row unless an explicitly safe deterministic tie rule is preregistered (none is allowed in 4O);
- return only the named value field from that row;
- fail closed on missing array, missing fields, zero matches, multiple matches, or non-scalar returned value;
- persist no numeric array index.

## Probe/IR requirements
The probe observer must preserve existing bounded behavior while adding a separate bounded relational summary.

Required relational evidence fields/metrics:
- `relationalArrayCandidates`
- `relationalRowSetsAccepted`
- `relationalRowSetsRejectedInsufficientRows`
- `relationalRowSetsRejectedNoSharedSchema`
- `relationalLabelFieldCandidates`
- `relationalValueFieldCandidates`
- `relationalObservedLabels`
- `relationalOutputMatches`
- `rowLookupPlannerSelections`
- `rowLookupValidatorRejects`
- `rowLookupConfirmedRecipes`
- `forbiddenInputSourceCandidates`
- `forbiddenInputSourceSelections` MUST = 0
- `numericIndexedRowLookupRecipes` MUST = 0

The relational summary must be derived from the same successful probe body fingerprint/schema proof and be reconstructible/auditable.

## Causal tests required before benchmark
1. A response with `Results:[{Variable:"VIN",Value:"..."},{Variable:"Make",Value:"HONDA"}]` induces one relational row set.
2. Row-set induction observes more than array element 0 without adding numeric indexes to the persisted program.
3. Required output `make` uniquely grounds to observed label `Make`.
4. `ROW_LOOKUP` returns `HONDA` even when the `Make` row moves from index 1 to index 50.
5. `ROW_LOOKUP` continues to work when unrelated rows are inserted before/after the matching row.
6. Duplicate `Make` rows reject.
7. Missing `Make` row rejects.
8. Missing `Value` field rejects.
9. Nested repeated row sets are bounded by existing depth/field budgets.
10. Arrays of primitives do not become relational row sets.
11. Single-row arrays do not become relational row sets.
12. Arrays of objects without shared scalar schema reject.
13. `vin <- TASK_INPUT:vin` is available.
14. `make <- TASK_INPUT:vin` is absent from planner source choices.
15. Validator explicitly rejects forged `make <- TASK_INPUT:vin`.
16. Existing FIELD projection remains unchanged.
17. Existing INPUT projection remains unchanged for identity-compatible roles.
18. Existing npm/MealDB/CocktailDB/Agify/Genderize/Met regression fixtures remain valid.
19. First-class 4N request proof remains reconstructible.
20. NHTSA-shaped synthetic response can compile `vin` from input/observed identity and `make` through `ROW_LOOKUP` without numeric index.
21. Changed-input response with reordered rows still projects correctly.
22. false character→books remains rejected.
23. auth/safety/request-preservation gates remain unchanged.
24. provider-blind source audit contains no provider/domain/endpoint recovery literals.

## Engineering recovery GO gates
4O is GO only if ALL required gates pass:
- R4 recovery >=5/6
- >=8 successful manufactures total
- >=4 families with success
- changed-input replay >=95%
- all successful replay cases pass
- replay cognition/documentation/synthesis/schema deltas = 0
- zero numeric-index decisions
- zero numeric-index row-lookup recipes
- zero documentation-origin fallbacks
- zero standalone navigation promotions
- zero validator graph mismatch rejects
- `authLikeRenderedRequests = 0`
- `knownAuthProbeAttempts = 0`
- zero entity-incompatible structural/trace probes
- `documentationRouteProbeAttempts = 0`
- false character→books absent
- `placeholderPreservationFailures = 0`
- `nonAuthRequestTextMutations = 0`
- duplicate acquisition/spec/probe network fetches = 0
- controls 42/42 and event-derived safety clean
- retain >=1 relative-operation/API-base recipe
- retain >=1 actually reference-expanded recipe
- **>=1 confirmed recipe grounded by first-class ExecutedGetTrace**
- **>=1 confirmed recipe using executed-example + documented-role proof**
- **>=1 confirmed recipe using ROW_LOOKUP**
- `forbiddenInputSourceSelections = 0`
- aggregate diagnostics equal per-attempt recomputation

Preferred economics:
- total LLM <= `$0.60`
- mean LLM/success <= `$0.15`

## Diagnostic target
Primary causal target: recover the previously request-correct but projection-blocked VIN capability without provider-specific logic.

A 4O result of 7/24 with R4=5/6 but <8 total remains formal REASSESS because the preregistered breadth gate is unchanged; do not relabel it GO.

If R4 remains <5/6, do NOT automatically create 4OR/4OR2. Attribute whether the remaining ceiling is relational-label grounding, changed-input service behavior, or an independent capability family.

## Formal decision
- `GO_4O_RELATIONAL_RESPONSE_IR_KEYED_ROW_PROJECTION`
- otherwise `REASSESS_4O_RELATIONAL_RESPONSE_IR_KEYED_ROW_PROJECTION`
