# MISSING Experiment 3O3 — Typed Capability Spec Compiler

## Purpose

Re-test the unchanged 3O multi-family hypothesis after 3O2 failed at the transport layer because the Structured Output schema used unsupported `oneOf` inside `ops.items`.

3O3 keeps exactly the same three families, approved sources, build/replay inputs, semantic validators, negative controls, safety envelope, and GO thresholds. The only architectural change is that the LLM emits a flat semantic Capability Spec. A deterministic compiler converts that spec into the already-frozen safe DSL `SOURCE -> PROJECT_PATHS -> OUTPUT`.

## Frozen families and inputs

Identical to 3O/3O2:

- scholarly DOI metadata → Crossref `crossref_work`
  - build `10.1038/nphys1170`
  - replay `10.1126/science.169.3946.635`
- current weather by coordinates → Open-Meteo `openmeteo_current`
  - build `40.7128,-74.0060`
  - replay `35.6762,139.6503`
- earthquake latest feed item → USGS `usgs_feed`
  - build `all_day`
  - replay `all_week`

The planner sees all three sources in every case.

## Flat Structured Output schema

No `oneOf`, `anyOf`, `allOf`, discriminated unions, dynamic object properties, or planner-generated DSL operations.

Every field is required and the schema forbids additional properties:

- `case_id: string`
- `decision: MANUFACTURE|REJECT`
- `reason: string`
- `source_id: crossref_work|openmeteo_current|usgs_feed|none`
- source bindings, each string and empty when unused:
  - `source_arg_doi`
  - `source_arg_latitude`
  - `source_arg_longitude`
  - `source_arg_window`
- output paths, each string and empty when unused:
  - `path_doi`, `path_title`, `path_publisher`
  - `path_temperature`, `path_weather_code`, `path_time`
  - `path_id`, `path_magnitude`, `path_place`

For MANUFACTURE, source bindings must use frozen input refs such as `$input.doi`; output paths must be selected from the frozen source contract. Empty unused fields are ignored by the compiler.

## Deterministic compiler

The LLM does not emit executable operations. The compiler:

1. validates the flat spec with strict Zod;
2. checks case/source family and frozen input bindings;
3. checks required output names and allowed paths for that source;
4. compiles a canonical DSL recipe:
   - `SOURCE`
   - `PROJECT_PATHS`
   - `OUTPUT`
5. passes the compiled recipe through static validation before any network execution.

No LLM-generated URL, HTTP method, code, regex, transform, or operation is accepted.

## Planner transport

Chat Completions Structured Outputs with `response_format.type=json_schema`, `strict:true`, and the flat schema above.

Persist for every initial/repair attempt: HTTP status, raw response/content, refusal, parsed spec, schema/Zod errors, compile errors, and static errors.

One bounded repair call remains allowed after planner/spec/compile/static failure. It cannot alter cases, sources, safety rules, DSL, or GO thresholds.

## Negative controls and metrics

The original three synthetic wrong-source controls remain and are compiled/static-validated deterministically. All must be rejected.

`wrong_source_detected` counts detected wrong-source specs/controls. `wrong_source_accepted` counts only a wrong-source spec that somehow reaches validated/persisted live status. GO requires zero.

`fingerprints_evidence` is non-vacuous: at least one persisted recipe is required.

## Frozen GO thresholds

Decision remains `GO_MULTI_FAMILY_AUTONOMOUS_GAP_FILL` iff all original 3O conditions hold:

- >=2 distinct families have MANUFACTURE decisions
- >=2 distinct families have strict typed static-valid compiled plans
- >=2 distinct families have live semantic success
- >=2 distinct families have independent replay success
- replay success rate across persisted recipes = 100%
- wrong-source accepted = 0
- explicit negative controls rejected = 100%
- unknown/alias fields accepted = 0
- replay planner/repair calls = 0
- source/operation/host-policy violations = 0
- redirects followed = 0
- credentials = 0
- arbitrary code = 0
- fingerprints/evidence persisted non-vacuously

Otherwise: `REASSESS_MULTI_FAMILY_AUTONOMOUS_GAP_FILL`.

## Interpretation boundary

A GO demonstrates bounded semantic source selection, deterministic safe recipe compilation, live execution, and replay across at least two unrelated families from a small approved source catalog. It does not prove open-web discovery, arbitrary API understanding, commercial demand, pricing, or paid execution.
