# MISSING Experiment 3K — Intent-First Capability Procurement

## Purpose

Test whether MISSING performs better when composition is driven backward from a target capability requirement rather than by forward-pairing arbitrary tool outputs.

3K uses the live Official MCP Registry plus one bounded semantic judge (`gpt-5.6-luna`). The judge may only classify candidate source producers for a previously selected target input. It cannot invent tools, URLs, values, transforms, or arguments.

The known 3I bridge `search_news -> advisors_store_readiness_check` is explicitly excluded from all candidate generation.

## Frozen target-first procedure

1. Fetch the first 100 latest Official MCP Registry records.
2. Inspect at most 58 eligible public HTTPS MCP servers.
3. Apply the same conservative read-only policy used in 3J.
4. Construct the **target queue first**, before executing any source tools:
   - target tool is read-only and safe;
   - exactly one required scalar input;
   - target parameter has a non-empty canonical concept using the frozen 3I alias table;
   - target description is non-empty.
5. Sort targets deterministically by server name, tool name, target parameter and keep the first **15**.
6. For each target, construct a canonical intent from the target only:
   `Obtain <target tool documented result> for an entity identified by <target parameter/canonical concept>.`
7. Only after the target queue and intents are frozen, execute safe zero-required-input source tools and index all non-placeholder scalar leaves by canonical concept and runtime type.
8. For each target, retrieve candidate producers only from the matching concept+type bucket.
9. Source and target must be on different MCP servers.
10. The known 3I pair is excluded.

## Frozen semantic procurement judge

For a target intent and one candidate producer, the judge receives only:

- frozen target intent;
- target server/tool description and required parameter metadata;
- source server/tool description;
- source scalar path/name/canonical concept/type and a truncated example value.

It returns JSON:

`{"decision":"PROCURE|REJECT","entity_relation":"same_entity|derived_entity|different_entity|unclear","purpose_fit":"direct|indirect|mismatch|unclear","reason":"...","confidence":0..1}`

A source may be procured only when all are true:

- `decision === PROCURE`
- `entity_relation === same_entity`
- `purpose_fit === direct`
- confidence >= **0.90**

If more than one producer passes, choose highest confidence, then lexicographically by server/tool/path. The judge cannot synthesize or alter the source value.

## Frozen negative controls

For every target with at least two concept+type-compatible source candidates, create one deterministic decoy by choosing the lexicographically last candidate instead of the first. Decoys are judged but never executed as targets.

Decoy false-positive rate must be **0%**.

## Functional outcome validation

A procured target execution succeeds only when:

- MCP call resolves;
- `result.isError !== true`;
- non-empty content or structured content exists;
- no explicit authentication/error signal exists;
- top-level `ok:false` rejects;
- top-level status `error`, `failed`, `invalid`, or `unauthorized` rejects.

## Replay

Persist successful procurement recipes containing target intent, target tool/parameter, source producer/path, canonical concept, source value type, and judge evidence.

Replay must use fresh MCP connections, re-execute the exact source, extract the same path, and call the exact target with the new source value. Replay makes **zero judge/planner calls**.

## Limits

- target queue: **15**
- source executions: max **30**
- real procurement judge calls: max **30**
- decoy judge calls: max **15**
- target execution attempts: max **10**
- retained recipes: max **3**
- MCP timeout: **12 seconds**

## Preregistered gates

`GO_INTENT_FIRST_CAPABILITY_PROCUREMENT` iff all are true:

- at least **1** target-first procurement produces a functionally successful cross-server composition
- at least **1** persisted procurement recipe replays successfully on fresh connections
- replay success rate for persisted recipes = **100%**
- semantic judge decoy false-positive rate = **0%**
- every executed producer has `same_entity`, `direct` purpose fit, confidence >= **0.90**
- target queue and intents were frozen before source execution
- known 3I pair used = **0**
- auth/error-like results counted as success = **0**
- unsafe/mutating tools executed = **0**
- credentials supplied = **0**
- judge/planner calls during replay = **0**
- at least **20 producer candidates** are rejected before target execution
- target queue, intents, source index, judge evidence, recipes, executions, and replay evidence are persisted

Otherwise decision is `REASSESS_INTENT_FIRST_CAPABILITY_PROCUREMENT`.

## Interpretation boundary

A GO would prove that backward procurement from a target requirement can identify and reuse at least one semantically direct upstream producer under a narrow one-input pattern. It would not prove open-ended user intent decomposition, multi-hop planning, arbitrary transforms, paid execution, or universal capability synthesis.
