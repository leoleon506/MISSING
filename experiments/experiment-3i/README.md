# MISSING Experiment 3I — Canonical Semantic Bridge

## Purpose

Test whether MISSING can bridge semantically equivalent MCP fields that use different surface names, while remaining deterministic, auditable, and conservative.

3I uses **no LLM**, **no embeddings**, **no credentials**, and **no paid APIs**.

## Frozen canonicalization

Field names are tokenized on camelCase, snake_case, kebab-case, punctuation, and digit boundaries. Tokens are lowercased and mapped through this frozen structural alias table:

- `id`, `identifier`, `key` -> `identifier`
- `url`, `uri`, `link`, `href` -> `url`
- `repo`, `repository` -> `repository`
- `org`, `organization`, `organisation` -> `organization`
- `user`, `username`, `account` -> `user`
- `path`, `route` -> `path`
- `name`, `title` -> `name`
- `lang`, `language`, `locale` -> `language`
- `country`, `nation` -> `country`
- `city`, `town` -> `city`
- `code`, `slug` -> `code`

Stop tokens `the`, `a`, `an`, `current`, `target`, `source`, `input`, `output`, `value`, `data`, `result`, `item`, `object` are removed.

The canonical concept is the sorted remaining token set joined by `+`.

## Context evidence

A source leaf and target parameter may bridge only when all are true:

1. source and target are on different MCP servers;
2. both tools pass the conservative read-only policy;
3. source has zero required inputs;
4. target has exactly one required scalar input;
5. source and target runtime/schema scalar types match;
6. canonical source concept equals canonical target concept;
7. the canonical concepts are not empty;
8. source value is non-empty and not a known placeholder;
9. at least one non-stop canonical concept token appears in either the source tool description or target parameter description/tool description, providing textual context evidence;
10. the target call passes the same functional outcome validator used in 3H (`isError !== true`, non-empty content, no explicit auth/error signal).

No substring-only matching, arbitrary transforms, regex transforms, generated synonyms, LLMs, or embeddings are allowed.

## Replay

Every successful bridge is persisted as a recipe containing canonical concept, source server/tool/path, target server/tool/parameter, evidence tokens, and first execution outcome. Replay must use fresh MCP connections and zero planner calls.

## Limits

- registry records: **100**
- servers inspected: **58**
- source executions: max **24**
- composition attempts: max **35**
- recipes retained: max **3**
- timeout per MCP operation: **12 seconds**

## Preregistered gates

`GO_CANONICAL_SEMANTIC_BRIDGE` iff all are true:

- at least **1** functionally successful cross-server bridge uses **different surface field names** but the same canonical concept
- at least **1** persisted bridge replays successfully on fresh connections
- replay success rate for persisted recipes = **100%**
- every persisted bridge has canonical concept equality and textual context evidence
- direct exact-normalized field-name equality among successful bridges = **0**
- placeholder source values used = **0**
- auth/error-like target results counted as success = **0**
- unsafe/mutating tools executed = **0**
- credentials supplied = **0**
- planner/LLM/embedding calls = **0**
- at least **30 candidate pairs** are rejected by canonical/type/context/outcome gates
- evidence, canonical concepts, and recipes are persisted

Otherwise decision is `REASSESS_CANONICAL_SEMANTIC_BRIDGE`.

## Interpretation boundary

A GO would prove a narrow deterministic semantic bridge for known structural aliases. It would not prove open-domain semantic understanding, arbitrary ontology induction, or natural-language planning.
