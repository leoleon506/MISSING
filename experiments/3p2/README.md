# MISSING Experiment 3P2 — Contract-Aware Retrieval + Typed Binding Compiler

## Status
Preregistered before implementation and before benchmark execution.

## Relationship to 3P
3P remains `REASSESS_AUTONOMOUS_SOURCE_PROCUREMENT`. It successfully fetched and parsed all three live OpenAPI contracts, autonomously procured two cases, and completed one live recipe plus independent replay, but it did not reach the frozen requirement of at least two live providers and two replayable recipes.

3P2 is a methodological replication of the same procurement hypothesis. It keeps the same candidate specification index, same three cases, same build/replay inputs, same semantic validators, same network policy, and the same GO thresholds. It changes only two mechanisms that 3P directly exposed as insufficient:

1. lexical-only operation retrieval is replaced by contract-aware deterministic retrieval;
2. direct parameter bindings are replaced by a bounded typed binding compiler.

No failed 3P result is reinterpreted or rescued, and no GO threshold is relaxed.

## Question
Can MISSING, given only a live machine-readable candidate specification index and a capability request, autonomously select a viable provider and exact live OpenAPI operation, compile bounded typed input transformations required by that contract, execute and semantically validate the result, persist the recipe, and replay it on a different input with zero planner calls and zero source re-procurement?

## Frozen candidate specification index
The index contains specification locations only. It contains no case-to-provider mapping, execution endpoint, parameter binding, transform, or output JSON path.

1. `nws` — `https://api.weather.gov/openapi.json`
2. `github` — `https://raw.githubusercontent.com/github/rest-api-description/main/descriptions/api.github.com/api.github.com.2022-11-28.json`
3. `usgs_water` — `https://api.waterdata.usgs.gov/ogcapi/v0/openapi`

All three specifications are fetched live during the build phase and fingerprinted.

## Frozen cases

### Case A — NWS point metadata
Intent: Given an NWS point coordinate string, return the forecast grid office and grid coordinates.

Build input: `point = 39.7456,-97.0892`

Replay input: `point = 40.7128,-74.0060`

Required output leaf names: `gridId`, `gridX`, `gridY`.

### Case B — GitHub public repository metadata
Intent: Given a public GitHub repository owner and repository name, return full repository name, star count, and primary language.

Build input: `owner = openai`, `repo = openai-python`

Replay input: `owner = nodejs`, `repo = node`.

Required output leaf names: `full_name`, `stargazers_count`, `language`.

### Case C — USGS monitoring-location metadata
Intent: Return metadata for a USGS monitoring-location identifier.

Build input: `site_id = USGS-01435000`

Replay input: `site_id = USGS-01100000`.

Required output leaf names: `id`, `monitoring_location_name`, `state_name`.

## Contract-aware deterministic retrieval
For every case, MISSING inspects all GET operations derived from all three live contracts. Ranking may use only information present in the case request and live OpenAPI contract, including:

- path template and operationId;
- summary and description;
- declared parameter names, locations, required flags, descriptions, and schemas;
- deterministic compatibility between case input names and declared parameters;
- recursively resolved response-schema property names when present;
- deterministic compatibility between required output leaf names and response-schema properties;
- penalties for required contract parameters for which the case exposes no plausible input.

The retriever must not contain provider-specific paths, case-to-operation mappings, provider bonuses, or hard-coded knowledge that a particular case belongs to NWS, GitHub, or USGS. Every case receives candidates from all three providers.

The benchmark records the selected candidate's retrieval rank and whether the chosen operation was actually present in the live contract.

## Typed binding compiler
The planner still chooses provider and exact live GET operation, but parameter bindings are represented in a bounded typed form rather than arbitrary expressions.

Allowed binding kinds:

- `DIRECT`: use one complete `$input.<field>` value;
- `SPLIT`: split one `$input.<field>` on one bounded literal delimiter and select one bounded zero-based index;
- `LITERAL`: use one planner-supplied primitive literal only for a declared parameter;
- `UNUSED`: empty slot.

No concatenation, regex replacement, arithmetic, templates, URLs, code, eval, shell, generated JavaScript, dynamic imports, or arbitrary transform language is allowed.

Before network execution, the deterministic compiler must:

- verify the selected operation exists in the fetched live contract;
- verify every bound parameter is declared by that operation/path;
- verify every required path/query parameter is supplied;
- verify every `$input.<field>` exists;
- execute only the bounded transform kind specified;
- coerce and validate the resulting primitive against the declared OpenAPI parameter schema where available, including type, enum, numeric bounds, string length/pattern when safely representable, and requiredness;
- reject invalid typed bindings before live execution.

A compiled recipe persists the typed binding program. Replay executes that persisted program with the different frozen input; it does not ask the planner to regenerate bindings.

## Planner rules

- Structured output is mandatory.
- The planner sees the frozen case request plus contract-aware candidate operations from all three providers.
- The planner may select only an exact candidate provider/path pair.
- It may use at most six typed parameter bindings.
- One repair call is allowed only after planner-contract or deterministic static-validation failure, matching 3P's repair budget.
- No semantic normalization or hidden repair of malformed planner output is allowed.
- Live execution failure does not trigger a second provider search or additional planner call.
- Raw/redacted planner output and static errors are preserved as evidence.

## Output projection and semantic validation
After successful JSON execution, output projection is induced deterministically from required leaf names against the live response tree. The planner does not emit output JSON paths.

Semantic validators are unchanged from 3P:

- NWS: `gridId` is a non-empty string and `gridX`/`gridY` are finite numbers.
- GitHub: `full_name` equals `owner/repo` case-insensitively, `stargazers_count` is finite and non-negative, and `language` is a non-empty string or null.
- USGS Water: `id` equals the requested `site_id`; `monitoring_location_name` and `state_name` are non-empty strings.

## Network and execution policy
Unchanged from 3P:

- HTTPS only;
- IP literals rejected;
- DNS must resolve only to public addresses;
- redirects are not followed;
- execution hostname must be allowed by the selected live contract;
- no credentials, cookies, API keys, authorization headers, or arbitrary headers are supplied;
- GET only;
- JSON response required;
- bounded timeout and response size;
- no arbitrary code, shell, eval, dynamic imports, plugins, or generated JavaScript.

## Frozen negative controls
The benchmark must actually exercise all of these controls:

1. operation path absent from selected live contract is rejected;
2. undeclared parameter is rejected;
3. non-GET method is rejected;
4. wrong execution host is rejected;
5. empty/missing spec fingerprint does not count as fingerprint evidence;
6. `DIRECT` binding to a missing input field is rejected;
7. `SPLIT` binding with an out-of-range index is rejected;
8. transformed value incompatible with the declared OpenAPI parameter schema is rejected before execution;
9. unsupported transform kind is rejected.

## Frozen GO gates
Formal decision is `GO_CONTRACT_AWARE_TYPED_SOURCE_PROCUREMENT` only if all of the following hold:

- all three candidate specs are fetched live, parsed, and fingerprinted;
- zero case-to-provider/source/operation mappings exist in the frozen cases;
- at least 2 distinct cases autonomously procure a provider and exact live contract operation;
- at least 2 distinct providers reach deterministic static validation and live JSON execution;
- at least 2 persisted recipes replay successfully on the different frozen inputs;
- replay success rate among persisted recipes is 100%;
- planner calls during replay = 0;
- source procurement/spec-fetch calls during replay = 0;
- all nine frozen negative controls are rejected;
- wrong/unknown operations accepted = 0;
- undeclared parameters accepted = 0;
- invalid typed bindings accepted = 0;
- unsupported transforms accepted = 0;
- non-GET operations accepted = 0;
- host-policy violations accepted = 0;
- redirects followed = 0;
- credentials supplied = 0;
- arbitrary code executed = 0;
- fingerprint evidence is non-vacuous: at least 2 persisted recipes, each with non-empty spec and recipe fingerprints.

Otherwise the formal decision is `REASSESS_CONTRACT_AWARE_TYPED_SOURCE_PROCUREMENT`.

## Interpretation boundary
A GO would demonstrate bounded autonomous source procurement and typed adapter compilation from a small live OpenAPI candidate index. It would not demonstrate unrestricted open-web discovery, arbitrary API integration, universal transform synthesis, paid/commercial procurement, or autonomous economic selection.