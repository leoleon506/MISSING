# MISSING Experiment 3L — Seeded Intent Composition

## Purpose

Test whether MISSING can build and persist a safe two-step live MCP composition when the chain starts from explicit user-provided seed data rather than from a spontaneous zero-argument producer.

3L uses the live Official MCP Registry and one bounded planning/judging model (`gpt-5.6-luna`). The model may only select and connect already discovered live read-only MCP tools. It cannot invent tools, URLs, credentials, code, transforms, constants, or argument values.

## Frozen seed cases

3L uses **three generic seed intents**, each with one build seed and one independent replay seed. The model does not know which provider/tool should solve them.

1. `github_repository_owner_profile`
   - build seed: `{ "repository": "openai/openai-python" }`
   - replay seed: `{ "repository": "pallets/flask" }`
   - intent: `Given a GitHub repository identifier, return a public profile fact about the repository owner that cannot be obtained from the seed alone.`

2. `country_to_capital_fact`
   - build seed: `{ "country": "Costa Rica" }`
   - replay seed: `{ "country": "Japan" }`
   - intent: `Given a country name, use one capability to derive a capital/city entity and a second capability to return a public fact about that derived entity.`

3. `city_to_country_fact`
   - build seed: `{ "city": "San Jose" }`
   - replay seed: `{ "city": "Tokyo" }`
   - intent: `Given a city name, use one capability to derive a country entity and a second capability to return a public fact about that derived country.`

These are capability shapes, not provider-specific test fixtures. A case may REASSESS if the live MCP supply cannot support it.

## Frozen discovery and safety policy

1. Fetch first 100 latest Official MCP Registry records.
2. Inspect at most 58 eligible public HTTPS MCP servers.
3. Use conservative read-only policy from 3J/3K.
4. Reject tools with `destructiveHint === true`, mutation lexical signal, missing affirmative `readOnlyHint`, or invalid input schema.
5. No credentials, headers, writes, files, shell, browser automation, arbitrary HTTP, or paid APIs.
6. The known 3I pair `search_news -> advisors_store_readiness_check` is excluded.

## Frozen two-step recipe contract

A BUILD recipe must contain exactly two MCP tool calls:

- Step A consumes only fields from the user seed.
- Step B consumes exactly one scalar value extracted from Step A output.
- Every argument value must be either `$seed.<field>` or `$stepA.<path>`.
- No literal constants may be supplied except values already present verbatim in the seed.
- Step A and Step B must be on different MCP servers.
- Step B must contribute the final requested fact; returning Step A's intermediate value alone does not satisfy the intent.

The planner returns only:

`case_id`, `decision BUILD|REJECT`, `step_a_server`, `step_a_tool`, `step_a_args`, `step_a_output_path`, `step_a_output_concept`, `step_b_server`, `step_b_tool`, `step_b_arg_name`, `final_output_description`, `reason`.

No executable code is generated.

## Static validation

Before any candidate tool call:

- both tools must exist in the discovered catalog;
- both must satisfy the frozen safe read-only policy;
- Step A args must reference only known seed fields;
- Step B arg must reference only the declared Step A scalar output path;
- Step B must require exactly one scalar argument;
- cross-server requirement must hold;
- known 3I pair must not be used.

Any violation rejects the recipe before network execution.

## Live validation

For BUILD recipes:

1. Execute Step A using the build seed.
2. Require protocol success and functional result (`isError !== true`, non-empty content, no explicit auth/error signal, no top-level `ok:false`).
3. Extract the declared scalar path.
4. Require non-placeholder scalar type compatible with Step B input schema.
5. Execute Step B with exactly `{step_b_arg_name: extracted_value}`.
6. Apply the same strict functional-result gate.
7. Persist the recipe and evidence only if both calls pass.

A single bounded repair call is allowed only when the recipe was statically valid but failed live because the chosen output path or selected discovered tool was unusable. Repair receives generic failure evidence and the same frozen catalog. It may change tool selection/path references but cannot alter the case intent, safety policy, or thresholds.

## Independent replay

Every successfully validated recipe must replay with the **different frozen replay seed**:

- zero planner/repair/judge calls;
- fresh MCP connections;
- same Step A and Step B tools;
- same argument mappings and output path;
- Step A executes on replay seed;
- Step B consumes replay Step A output;
- both calls pass functional gates.

## Limits

- 3 intent cases
- at most 58 servers inspected
- at most 2 planner calls per case (initial + optional repair)
- exactly 2 calls per validated recipe execution
- exactly 2 calls per replay
- MCP timeout 12 seconds

## Preregistered gates

`GO_SEEDED_INTENT_COMPOSITION` iff all are true:

- at least **1 of 3** intents produces a statically valid two-step recipe
- at least **1 of 3** intents passes live two-step validation
- at least **1** persisted recipe passes replay on its different seed
- replay success rate across persisted recipes = **100%**
- every validated recipe uses exactly two different MCP servers
- every Step A argument comes only from seed data
- every Step B argument comes only from Step A output
- literals invented by planner = **0**
- unsafe/mutating tools executed = **0**
- credentials supplied = **0**
- known 3I pair used = **0**
- planner/repair calls during replay = **0**
- functional error/auth responses counted as success = **0**
- evidence, recipes, planner outputs, executions, and replay are persisted

Otherwise decision is `REASSESS_SEEDED_INTENT_COMPOSITION`.

## Interpretation boundary

A GO would prove that MISSING can take explicit seed data, select two discovered live MCP capabilities, connect a typed intermediate value, persist the recipe, and generalize it to a different seed without replanning. It would not prove arbitrary multi-hop planning, universal intent understanding, paid execution, arbitrary transforms, or unrestricted capability manufacturing.
