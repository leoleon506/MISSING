# MISSING Experiment 3A — Primitive Contract Gate

## Purpose

Test whether MISSING can prevent stale or malformed primitive/source contracts from entering the Capability Graph before the planner/Forge sees them.

3A is deterministic and uses **no LLM**.

Each candidate contract is probed live and checked for:
- HTTP success
- JSON content type / parseability
- required export paths
- expected primitive export types
- stable host policy
- observed top-level shape fingerprint

Only contracts that pass all checks are eligible for the Forge.

## Preregistered gates

`GO_PRIMITIVE_CONTRACT_GATE` iff all are true:

- valid-contract acceptance rate = **100%**
- invalid/stale-contract rejection rate = **100%**
- false acceptance rate = **0%**
- false rejection rate = **0%**
- host-policy violations = **0**
- evidence/fingerprints persisted = **true**

Otherwise decision is `REASSESS_PRIMITIVE_CONTRACT_GATE`.

## Interpretation boundary

A GO would prove only that MISSING can gate known candidate contracts before composition. It would not yet prove automatic discovery or automatic contract generation from documentation/OpenAPI.
