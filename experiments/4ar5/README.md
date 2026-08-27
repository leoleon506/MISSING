# Experiment 4A-R5 — Deterministic Evidence Discovery Recovery

## Status
Development/recovery only over the already-burned 4A workload. No fresh blind evidence is consumed.

## Frozen parent evidence
- 4A-R4 merge SHA: `43b72b332fd0a1e7a18aac6454ff69d30122886d`
- 4A-R4 run: `33027569131`
- job: `98372392491`
- artifact: `9629192653`
- artifact digest: `sha256:9f9d107f7bdf29c793e104f906c8ff2b4237eb111d8f6d5338363d30f54cf368`
- report fingerprint: `15054f0b84a3589f5a08bddfa048a9d20bb66dbf932643806ce0731e0923c978`
- ledger fingerprint: `940fb33e79e5b979ca40eab4d1c179d96e6c2e2f3386782d02b6ce41ccde2aaf`

## Frozen R4 outcome
- 24 cases / 8 families
- 6 successful manufactures / 5 families / 6 providers
- 6 persisted recipes
- 5/6 changed-input replay = 83.33%
- 26 live calls
- 6 response-grounded repair calls; only 1 persisted recipe used that repair and it did not add a net-new capability versus R3
- total LLM cost `$0.3949852`
- mean LLM cost/success `$0.06583087`
- median success latency `11.752s`
- p90 success latency `23.710s`
- 42/42 controls
- safety counters all zero

## Motivation
R4 showed diminishing returns from post-live projection repair. The dominant losses are now pre-live: provider selection variance, documentation/evidence quality, and planner REJECT decisions caused by incomplete endpoint/response-schema evidence. R4 also demonstrated run-to-run provider/contract variance on the same frozen workload, which weakens causal attribution.

## Allowed generic changes
1. **Deterministic semantic reranking**
   - keep the exact R2 mechanical catalog frontier and its top-120 cap;
   - use strict structured scoring with `temperature=0`;
   - score functional fit and likelihood of anonymous machine-readable documentation independently;
   - deterministically sort scored candidates using numeric score, then frozen lexical rank, then candidate id;
   - preserve the existing maximum of 8 provider attempts per case.
2. **Deterministic evidence frontier**
   - rank same-domain documentation links mechanically using API/spec/schema/example terms plus the frozen case input/output tokens;
   - extract same-domain literal/config references to OpenAPI/Swagger/JSON/YAML specifications from HTML without executing JavaScript;
   - prioritize valid parsed API specifications and operation/response-schema summaries before generic prose windows;
   - keep crawl depth <=2, max bytes unchanged, and a bounded per-provider documentation budget.
3. **Stable evidence packing**
   - construct a deterministic evidence packet ordered by evidence class, structural relevance score, evidence id and URL;
   - prefer operation summaries and response schema/property names over repeated navigation prose;
   - no model-generated evidence, inferred endpoints, external search, or provider-specific rules.
4. **Planner stability**
   - typed contract synthesis remains Structured Outputs and uses `temperature=0`;
   - request/projection/binding validators remain unchanged;
   - no response-grounded repair in R5. R5 isolates discovery/evidence effects.

## Frozen unchanged components
- exact 24 cases / 8 families, build inputs and replay inputs
- R2 catalog source and top-120 mechanical frontier
- max 8 provider attempts per case
- anonymous HTTPS GET only
- DNS/private-host/cross-domain/credential/header safety
- typed binding IR from R3
- 3X projection DSL/executor
- semantic validators
- changed-input zero-cognition replay
- 42 controls
- original 4A success, breadth, replay, latency and economics gates

## Forbidden
- case-, provider-, domain- or endpoint-specific maps/rules
- adding curated providers or hand-authored recipes
- external web/search-engine discovery
- increasing max provider attempts above 8
- relaxing grounding, semantic validation, safety, replay or cost gates
- using live response bodies to repair contracts/projections
- consuming fresh blind holdouts

## Attribution requirements
The report must record:
- frozen lexical rank and deterministic rerank score for every attempted provider;
- reranker packet fingerprint;
- evidence class/score for each planner-visible evidence item;
- evidence packet fingerprint;
- counts of parsed spec operations and response properties;
- planner COMPILE/REJECT outcome;
- exact source of every successful manufacture.

## Formal gates
Same original 4A gates:
- >=12/24 successful manufactures
- >=6/8 successful families
- >=8 distinct provider hosts
- double live verification for all persisted recipes
- >=95% changed-input replay
- replay catalog/reranker/docs/synthesis deltas all zero
- 42/42 controls
- event-derived safety clean
- median success latency <=90s
- p90 success latency <=180s
- mean LLM cost/success <=$0.15
- total LLM cost <=$3.00

Formal decision:
- `GO_4A_R5_DETERMINISTIC_EVIDENCE_RECOVERY`
- otherwise `REASSESS_4A_R5_DETERMINISTIC_EVIDENCE_RECOVERY`

A GO is engineering recovery evidence only. Fresh blind breadth validation is required afterward.
