# MISSING Experiment 3J — Intent-Constrained Semantic Composition

## Purpose

Test whether MISSING can distinguish a merely type-compatible/canonical bridge from a composition whose **purpose and entity semantics** actually support a synthetic user-level capability.

3J uses the live Official MCP Registry. It uses one bounded semantic judge (`gpt-5.6-luna`) only after deterministic safety, type, canonical-concept, and functional checks. The judge cannot invent tools, arguments, transforms, URLs, or values.

## Frozen candidate generation

1. Fetch the first 100 latest Official MCP Registry records.
2. Inspect at most 58 eligible public HTTPS MCP servers.
3. Use the same conservative read-only policy as 3I.
4. Source tool: zero required inputs; execute with `{}`; functional result only.
5. Target tool: exactly one required scalar input.
6. Source scalar and target parameter must have the same runtime/schema scalar type.
7. Source and target field names must map to the same frozen canonical concept from 3I.
8. Placeholder values are rejected.
9. Source and target must be different servers.

## Frozen semantic-purpose judge

For each deterministic candidate pair, the judge receives only:

- source server/tool name and description
- source scalar path, surface field name, canonical concept, type, and redacted/truncated example value
- target server/tool name and description
- target parameter name, description, canonical concept, and type
- one canonical proposed intent: `Use the exact <source concept> produced by <source tool> as the entity consumed by <target tool> to obtain the target tool's documented result.`

The judge must return JSON:

`{"decision":"COMPATIBLE|INCOMPATIBLE","entity_relation":"same_entity|derived_entity|different_entity|unclear","reason":"...","confidence":0..1}`

A pair may execute only if:

- `decision === COMPATIBLE`
- `entity_relation === same_entity`
- `confidence >= 0.90`

`derived_entity`, `different_entity`, or `unclear` always reject.

The judge is forbidden to assume facts not present in the supplied metadata. If uncertain, it must reject.

## Frozen negative controls

Before executing approved real pairs, 3J creates semantic decoys by pairing each candidate source with a deterministic different target that shares the same canonical concept/type but comes from a different functional context when such an alternative exists. Decoys are never executed.

Semantic judge false-positive rate on decoys must be **0%**.

## Functional outcome validation

A real target call counts as success only when:

- MCP call resolves;
- `result.isError !== true`;
- non-empty content/structured content exists;
- no explicit auth/error signal exists;
- if structured content contains top-level `ok`, it must not be `false`;
- if structured content contains top-level `status`, values `error`, `failed`, `invalid`, or `unauthorized` reject.

## Replay

Every successful recipe is persisted with semantic-judge evidence and replayed on fresh connections without calling the semantic judge or any planner again. Replay re-executes the source, extracts the same path, revalidates type/canonical concept/non-placeholder constraints, and executes the exact target.

## Limits

- servers inspected: **58**
- source executions: max **24**
- semantic judge calls: max **20 real candidates + 20 decoys**
- target execution attempts: max **10**
- retained recipes: max **3**
- MCP timeout: **12 seconds**

## Preregistered gates

`GO_INTENT_CONSTRAINED_SEMANTIC_COMPOSITION` iff all are true:

- at least **1** semantically approved cross-server composition passes strict functional outcome validation
- at least **1** persisted recipe replays successfully on fresh connections
- replay success rate for persisted recipes = **100%**
- semantic judge false-positive rate on deterministic decoys = **0%**
- every executed real pair has judge confidence >= **0.90** and `entity_relation === same_entity`
- every successful result has `isError !== true` and no top-level `ok:false`
- auth/error-like results counted as success = **0**
- unsafe/mutating tools executed = **0**
- credentials supplied = **0**
- judge/planner calls during replay = **0**
- at least **20 candidate/decoy pairs** are rejected before execution
- all judge inputs/outputs, candidate evidence, recipes, executions, and replay evidence are persisted

Otherwise decision is `REASSESS_INTENT_CONSTRAINED_SEMANTIC_COMPOSITION`.

## Interpretation boundary

A GO would prove a narrow semantic-purpose gate can prevent obvious entity-purpose mismatches while still yielding at least one functional, replayable synthetic capability. It would not prove open-domain planning, universal semantic understanding, or production-grade ontology induction.
