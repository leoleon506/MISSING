# MISSING — Experiment 1D: Capability Continuity

## Question

Is real x402 supply sufficiently volatile across schema, price, and payment destination that agents would benefit from a provider-neutral stable capability contract with automatic migration?

This experiment measures observed catalog churn only. It does **not** assume every schema change is breaking, and it does not claim automatic compatibility repair is feasible yet.

## Frozen source

Public x402 List API change feed and service catalog.

## Frozen method

1. Fetch up to 365 days of public x402 List change events using pagination.
2. Fetch the current public service catalog using pagination.
3. Count change events by type (`schema_changed`, `price_changed`, `payto_changed`, and other types).
4. Count unique services affected by any change.
5. Count services with repeated churn (>=2 change events).
6. Compute changed-service share relative to the current catalog size.
7. Persist the raw change feed and summary for audit.

## Preregistered GO gates

`GO_CAPABILITY_CONTINUITY` requires all of:

- >= 50 observed change events;
- >= 20 unique changed services;
- >= 10 schema-change events;
- >= 5 services with repeated churn;
- changed-service share >= 3% of the current catalog;
- raw evidence persisted.

Otherwise: `NO_GO_CAPABILITY_CONTINUITY`.

A GO only justifies Experiment 1E: determining which schema changes are actually breaking for agent callers and whether a stable canonical contract can be automatically adapted. A GO does not establish a product or moat.

A NO-GO means MISSING should not pursue continuity/migration as a central differentiation thesis.
