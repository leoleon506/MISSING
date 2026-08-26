# MISSING Experiment 3H — Intent-Bound Semantic Composition & Outcome Validation

## Purpose

Test whether MISSING can turn live MCP primitives into a genuinely successful synthetic capability rather than merely wiring schema-compatible calls.

3H uses **no LLM**, **no credentials**, and **no paid APIs**.

## Frozen intent model

For every candidate pair, MISSING constructs a canonical intent:

> Obtain the target tool's documented result for the exact entity/value produced by the source tool at `<source_leaf>`.

A composition is eligible only when:

1. source and target are on **different MCP servers**;
2. both tools pass the conservative read-only policy;
3. source has zero required parameters and is called with `{}`;
4. target has exactly one required scalar parameter;
5. normalized source leaf name equals normalized target parameter name **exactly**;
6. runtime scalar type matches target parameter type (`integer` -> runtime number);
7. source value is non-empty and is not a placeholder (`unable`, `unknown`, `none`, `null`, `n/a`, `na`, `undefined`, `error`, `failed`);
8. the target tool itself cannot satisfy the intent without the source-produced required argument.

No substring matching, arbitrary transforms, regex transforms, code generation, or argument invention are allowed.

## Functional outcome success

A target call counts as successful only when all are true:

- MCP call resolves;
- `result.isError !== true`;
- result contains non-empty content or structured content;
- serialized result contains no explicit authentication/error signal: `authentication required`, `unauthorized`, `forbidden`, `requires a subscriber`, `requires an api key`, `error:` or JSON field `"error"` with a non-empty value.

Protocol-level success alone does **not** count.

## Replay

Every persisted recipe is replayed on fresh MCP connections. Replay must:

1. re-run source tool;
2. extract the same source path;
3. revalidate non-placeholder/type constraints;
4. call the exact persisted target tool and parameter;
5. pass the functional outcome validator again;
6. use zero planner/LLM calls.

## Limits

- registry records: **100**
- servers inspected: **50**
- source executions: max **18**
- composition attempts: max **25**
- recipes retained: max **3**
- timeout per MCP operation: **12 seconds**

## Preregistered gates

`GO_INTENT_BOUND_MCP_COMPOSITION` iff all are true:

- at least **1** cross-server composition passes functional outcome validation
- at least **1** persisted recipe passes fresh replay
- replay success rate for persisted recipes = **100%**
- every successful recipe has exact normalized concept match between source leaf and target parameter
- every successful source value is non-placeholder
- every successful target result has `isError !== true`
- auth/error-like target results counted as success = **0**
- unsafe/mutating tools executed = **0**
- credentials supplied = **0**
- planner/LLM calls = **0**
- at least **20 candidate pairs** are rejected by semantic/type/outcome gates
- evidence and canonical intents are persisted

Otherwise decision is `REASSESS_INTENT_BOUND_MCP_COMPOSITION`.

## Interpretation boundary

A GO would prove a narrow, intent-bound, functionally successful cross-server composition with fresh replay. It would not prove open-ended natural-language semantic planning, arbitrary transformations, paid execution, or universal capability synthesis.
