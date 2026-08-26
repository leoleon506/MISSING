# MISSING Experiment 3G — Live MCP Capability Composition

## Purpose

Test whether MISSING can autonomously discover two distinct public MCP primitives, compose them into a new executable two-step capability, persist the recipe, and replay it on fresh connections without replanning.

3G uses **no LLM**, **no credentials**, and **no paid APIs**.

## Frozen composition pattern

A candidate composition must have this exact shape:

1. **Source tool A**
   - public HTTPS MCP remote
   - conservative read-only policy
   - `annotations.readOnlyHint === true`
   - no destructive hint or mutation lexical signal
   - zero required parameters
   - called with `{}`
   - returns `structuredContent` or a whole-text JSON object containing at least one scalar leaf
2. **Target tool B**
   - different MCP server from A
   - conservative read-only policy
   - exactly one required input property
   - required property type is scalar: string, number/integer, or boolean
3. **Compatibility**
   - source scalar type equals target required-property type (`integer` is compatible with runtime number)
   - normalized source leaf name equals normalized target parameter name, or one contains the other with length >= 3
   - string values longer than 200 chars are rejected
4. Execute B using exactly `{requiredProperty: sourceValue}`.
5. Persist a recipe containing source server/tool, scalar output path, target server/tool, and target parameter.
6. Replay the persisted recipe using fresh MCP connections, re-executing A, extracting the same path, and calling B without rediscovery or replanning.

No arbitrary transforms, regex, code generation, credentials, or mutating tools are allowed.

## Limits

- registry records: **100**
- servers inspected: **40**
- source executions: max **12**
- composition attempts: max **20**
- successful recipes retained: max **3**
- timeout per MCP operation: **12 seconds**

## Preregistered gates

`GO_LIVE_MCP_CAPABILITY_COMPOSITION` iff all are true:

- at least **1** cross-server composition executes successfully
- at least **1** persisted recipe replays successfully on fresh connections
- replay success rate for persisted recipes = **100%**
- every successful recipe uses **2 distinct MCP servers**
- every successful target call has exactly **1 argument** derived from A
- unsafe/mutating tools executed = **0**
- credentials supplied = **0**
- planner/LLM calls during discovery, composition, and replay = **0**
- at least **10 incompatible candidate pairs** are rejected, demonstrating non-trivial matching
- raw registry data, tool schemas, source outputs, rejected pair reasons, recipes, first executions, and replay evidence are persisted

Otherwise decision is `REASSESS_LIVE_MCP_CAPABILITY_COMPOSITION`.

## Interpretation boundary

A GO would prove autonomous cross-server MCP composition for a narrow schema-compatible pattern. It would not prove semantic equivalence to a user-level intent, arbitrary multi-step planning, required-input synthesis beyond observed outputs, paid execution, or universal composition.
