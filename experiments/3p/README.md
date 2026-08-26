# MISSING Experiment 3P — Autonomous Source Procurement

## Status
Preregistered before benchmark execution.

## Pre-run amendment
Before implementation and before any benchmark execution, endpoint verification showed that `https://earthquake.usgs.gov/fdsnws/event/1/swagger.json` is not an official OpenAPI/Swagger document. USGS exposes WADL for that service. To keep 3P strictly OpenAPI-based and avoid knowingly freezing an invalid candidate contract, the earthquake candidate/case is replaced pre-run by GitHub's official REST OpenAPI description and a public-repository metadata case. No GO threshold is relaxed by this amendment.

## Question
Can MISSING detect a missing capability, inspect multiple live machine-readable provider contracts with no case-to-provider mapping, procure a viable source/operation, compile it into a bounded executable recipe, validate the live result, persist the recipe, and replay it on a different input with zero planner calls?

## What changes from 3O3
3O3 gave the planner a preapproved source catalog containing execution URLs, bindings, and output paths. 3P removes that case-specific source contract. Every case receives the same candidate specification index. MISSING must fetch the specifications live, derive GET operations and parameters from those contracts, select the provider and operation, compile the request, induce output paths from the live JSON response, validate the result, and persist the recipe.

## Frozen candidate specification index
The index contains specification locations only. It does not contain case mappings, execution endpoints, parameter bindings, or output JSON paths.

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

Replay input: `owner = nodejs`, `repo = node`

Required output leaf names: `full_name`, `stargazers_count`, `language`.

### Case C — USGS monitoring-location metadata
Intent: Return metadata for a USGS monitoring-location identifier.

Build input: `site_id = USGS-01435000`

Replay input: `site_id = USGS-01100000`

Required output leaf names: `id`, `monitoring_location_name`, `state_name`.

## Discovery and procurement rules

- Every case sees the same candidate specification index.
- The source index may provide only provider id and spec URL.
- No case may contain a required provider/source, endpoint, parameter mapping, execution URL, or output JSON path.
- Only live fetched OpenAPI contracts may contribute operations and parameter definitions.
- Only `GET` operations are eligible.
- Deterministic lexical retrieval may reduce each live contract to a bounded set of candidate operations before the planner sees it.
- Planner output is a flat typed Procurement Spec. It chooses provider id, live operation path, method, and up to six parameter bindings/fixed values.
- Every chosen operation and parameter must exist in the fetched live contract.
- Request compilation is deterministic; the LLM never emits URLs or code.
- The execution hostname must be declared by the selected live contract (`servers`) or be the contract's canonical API hostname derived deterministically from that specification when no `servers` entry is present.
- After a successful JSON probe, output projection is induced deterministically by matching the required leaf names against the live response tree. The planner does not receive or invent output JSON paths.
- Recipes persist provider, spec fingerprint, operation, bindings, induced projections, and recipe fingerprint.
- Replay uses the persisted recipe on a different input. It makes zero planner calls and does not re-procure a source.

## Network and execution policy

- HTTPS only.
- IP literals rejected.
- DNS must resolve only to public addresses.
- No redirects are followed.
- Execution host must be allowed by the selected live provider contract as defined above.
- No credentials, cookies, API keys, authorization headers, or arbitrary headers are supplied.
- GET only; no POST/PUT/PATCH/DELETE.
- JSON response required.
- Bounded timeout and bounded response size.
- No arbitrary code, shell, eval, dynamic imports, plugins, or generated JavaScript.

## Deterministic semantic validators

- NWS: `gridId` is a non-empty string and `gridX`/`gridY` are finite numbers.
- GitHub: `full_name` must equal `owner/repo` case-insensitively, `stargazers_count` is finite and non-negative, and `language` is either a non-empty string or null.
- USGS Water: `id` must equal the requested `site_id`; `monitoring_location_name` and `state_name` are non-empty strings.

## Frozen negative controls

1. An operation path not present in the selected live contract must be rejected before execution.
2. A parameter not declared by the selected live operation/path must be rejected before execution.
3. A non-GET method must be rejected before execution.
4. An execution URL whose hostname is not allowed by the selected live provider contract must be rejected.
5. A recipe with an empty or missing spec fingerprint must not count as fingerprint evidence.

## GO gates

Formal decision is `GO_AUTONOMOUS_SOURCE_PROCUREMENT` only if all of the following hold:

- all three candidate specs are fetched live, parsed, and fingerprinted;
- zero case-to-provider/source mappings exist in the frozen cases;
- at least 2 distinct cases autonomously procure a provider and a live contract operation;
- at least 2 distinct providers reach static validation and live JSON execution;
- at least 2 persisted recipes replay successfully on different inputs;
- replay success rate among persisted recipes is 100%;
- planner calls during replay = 0;
- source procurement calls during replay = 0;
- all frozen negative controls are rejected;
- wrong/unknown operations accepted = 0;
- undeclared parameters accepted = 0;
- non-GET operations accepted = 0;
- host-policy violations accepted = 0;
- redirects followed = 0;
- credentials supplied = 0;
- arbitrary code executed = 0;
- fingerprint evidence is non-vacuous: at least 2 persisted recipes, each with non-empty spec and recipe fingerprints.

Otherwise the formal decision is `REASSESS_AUTONOMOUS_SOURCE_PROCUREMENT`.

## Interpretation boundary
A GO demonstrates bounded autonomous procurement from a live machine-readable candidate index. It does **not** demonstrate unrestricted open-web discovery, arbitrary API integration, commercial procurement, paid execution, or universal contract induction.