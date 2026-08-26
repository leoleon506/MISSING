# MISSING Experiment 3O2 — Schema-Constrained Multi-Family Forge

## Purpose

Re-test the frozen 3O multi-family hypothesis after 3O failed before any live execution because all six planner attempts violated the planner→DSL contract.

3O2 keeps the same three families, source catalog, build/replay inputs, semantic validators, safety rules, and GO thresholds. It changes only planner serialization and instrumentation:

1. planner output is constrained with a strict JSON Schema Structured Output;
2. raw planner response content and refusal/error metadata are persisted for every attempt;
3. wrong-source metrics distinguish detected/rejected from actually accepted;
4. fingerprint/evidence gates require at least one persisted recipe and cannot pass vacuously.

## Frozen families, sources, and inputs

Identical to Experiment 3O:

- scholarly DOI metadata → Crossref `crossref_work`
  - build DOI `10.1038/nphys1170`
  - replay DOI `10.1126/science.169.3946.635`
- current weather by coordinates → Open-Meteo `openmeteo_current`
  - build `40.7128,-74.0060`
  - replay `35.6762,139.6503`
- earthquake latest feed item → USGS `usgs_feed`
  - build `all_day`
  - replay `all_week`

The planner sees all three approved sources for every case.

## Frozen DSL

Same as 3O: exactly `SOURCE -> PROJECT_PATHS -> OUTPUT` for MANUFACTURE.

Structured Output schema restricts SOURCE to one of three exact source-specific variants and forbids additional properties. `PROJECT_PATHS.fields` is an object of string paths. Static validation still enforces the frozen source-specific allowed paths and required output names.

## Planner transport

Chat Completions uses `response_format.type = json_schema` with `strict: true`.

Every planner attempt persists:

- HTTP status
- raw `message.content`
- refusal field if present
- parsed JSON if present
- Zod/static validation errors
- whether the attempt was initial or repair

One bounded repair call remains allowed for planner-contract/static failure. The repair may not alter sources, cases, DSL, semantics, safety rules, or GO thresholds.

## Metric corrections

- `wrong_source_detected`: number of plans/controls caught using a non-required source.
- `wrong_source_accepted`: incremented only if a wrong-source plan reaches persisted/live-valid status. GO requires zero.
- `negative_controls_rejected`: all three synthetic wrong-source controls must fail static validation.
- `fingerprints_evidence`: true only when at least one recipe is persisted AND every persisted recipe has a SHA-256 fingerprint and evidence.

## Frozen GO thresholds

`GO_MULTI_FAMILY_AUTONOMOUS_GAP_FILL` iff all original 3O conditions hold:

- >=2 distinct families have MANUFACTURE decisions
- >=2 distinct families have strict typed static-valid plans
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

A GO demonstrates bounded typed autonomous source selection, manufacture, live execution, and recipe reuse across at least two unrelated families from a small approved source catalog. It still does not prove open-web source discovery, arbitrary API understanding, unrestricted composition, demand, pricing, or paid execution.
