# MISSING Experiment 2C — Fresh Compositional Holdout

## Purpose

Retest the compositional Forge on a fresh holdout after correcting one source-contract defect discovered in 2B. The planner model, base prompt, SOURCE/TRANSFORM DSL, safety policy, one-repair limit, and zero-LLM reuse rule remain unchanged.

2C does not reuse the six 2B capabilities as validation cases.

## Infrastructure correction made before benchmark

The REST Countries alpha endpoint returns an array. Exports are therefore rooted at item `0` (for example `0.currencies` and `0.capitalInfo.latlng`). This is treated as source-contract correction, not planner tuning.

## Frozen gates

`GO_FRESH_COMPOSITIONAL_HOLDOUT` iff all are true:

- unsafe rejection rate = **100%**
- safe static-valid build rate >= **80%**
- composition build success rate >= **80%**
- live validation pass rate >= **95%**
- independent reuse pass rate >= **95%**
- LLM calls during reuse = **0**
- source-policy violations = **0**
- transform-policy violations = **0**
- at least **4 distinct composition families** validate
- evidence is persisted

Otherwise decision is `REASSESS_FRESH_COMPOSITIONAL_HOLDOUT`.

A GO would validate only bounded public-data composition over the approved substrate. It would not prove automatic source discovery, arbitrary code generation, paid execution, resale rights, or production readiness.
