# Experiment 4A-R6 — Documented Operation IR Recovery

## Status
Development/recovery only over the already-burned 4A workload. No fresh blind holdout is consumed.

## Frozen parent evidence
- 4A-R5R merge SHA: `a5beb7049dcceadcd7e40b6190fa453ba22e4f79`
- 4A-R5R run: `33033653560`
- job: `98391532267`
- artifact: `9631986496`
- artifact digest: `sha256:30edd3ba75e1aa384d4193a13d4e52843da0af1d5dcecd8a4b229a2efbbafac0`
- report fingerprint: `66c775d9532df7a10521a0d2a2bea3c19c192be4c52401f3b774e39c1e673105`
- ledger fingerprint: `cbdcf9b7a51feff4d00b2d7ff1fa48b2dcb4396b2afee8e0303e4e6ac6aa049e`

## Frozen R5R outcome
- 24 cases / 8 families
- 2 successful manufactures / 2 families / 2 providers
- 2 persisted recipes
- 1/2 changed-input replay = 50%
- total LLM cost `$0.5217368`
- mean LLM cost/success `$0.2608684`
- 195 LLM calls
- 2,468 documentation fetches
- 1,497 spec probes
- 9 live calls
- 42/42 controls
- event-derived safety clean

## Frozen diagnosis before R6
R5R validated exact resolved-URL origin grounding and compact evidence packets economically, but breadth remained 2/24. The dominant failure moved to `docs -> planner`: 159 explicit planner REJECTs and 162 contract rejects. Several providers already proven in R3/R4 were still selected correctly but rejected before live.

Observed generic failure classes:
1. **Documented parameter names are renamed to task input names.** Example shape: documented `/resource/{id}` becomes `/resource/{object_id}` instead of keeping `{id}` and binding `id <- $input.object_id`.
2. **Documented base path / operation path representation is ambiguous.** Server URL path prefixes and operation paths are sometimes split or dropped inconsistently.
3. **Query parameter names/literals are present in examples/specs but the planner must rediscover them from prose.**
4. **Response paths already exist in parsed OpenAPI schemas, but legacy grounding re-proves them by substring search.**
5. **Useful URL/operation facts can be lost during prose/window packing even though the evidence was fetched.**

## R6 hypothesis
Compile verified documentation into a deterministic, provider-blind `DocumentedOperation` intermediate representation before the LLM. The LLM may only select a documented operation and map case inputs/outputs to already-proved parameter/response paths. It may not author host/path/query names or response paths.

## DocumentedOperation IR
Each operation may contain only facts mechanically extracted from cited fetched evidence:
- `operation_id` stable fingerprint
- exact HTTPS `origin`
- exact documented `base_path`
- exact documented `operation_path`
- method (`GET` only eligible)
- documented path parameter names
- documented query parameter names
- documented literal query values when observable
- documented response property paths
- evidence ids / proof type
- source resolved URL(s)

IR proof sources allowed:
1. parsed OpenAPI/Swagger operations and response schemas;
2. exact absolute HTTPS URL examples from fetched provider evidence;
3. exact relative endpoint examples only when mechanically anchored to a cited verified evidence origin.

## Allowed changes
1. Deterministic extraction of `DocumentedOperation` IR from already-fetched evidence.
2. Canonical URI composition from exact documented `origin + base_path + operation_path`.
3. Deterministic typed binding boundary:
   - endpoint placeholder/query names remain exactly documented;
   - task input names may map to those documented names;
   - the LLM cannot rename endpoint parameter names.
4. Structured response grounding:
   - OpenAPI-derived response paths are accepted directly from the cited parsed schema proof;
   - example-derived paths require exact mechanical observation in structured JSON/example evidence.
5. Planner schema constrained to:
   - select `operation_id` from an enum of supplied operations;
   - choose input mappings only from exact case input names to exact documented parameter names;
   - choose required output mappings only from exact documented response paths or INPUT;
   - otherwise REJECT.
6. Keep R5 deterministic provider reranker and R5R compact evidence economics where prose is still needed for attribution/context.

## Frozen unchanged
- exact 24 cases / 8 families
- R2 top-120 mechanical frontier
- R5 deterministic provider reranker/scoring
- max 8 provider attempts per case
- crawl depth and byte limits
- anonymous HTTPS GET only
- DNS/private-host/redirect/cross-domain/credential/header safety
- semantic validators
- 3X projection executor semantics
- double-live verification
- changed-input zero-cognition replay
- 42 controls
- original 4A economic/latency/breadth gates
- no response-body repair

## Forbidden
- provider/domain/case/endpoint maps or hard-coded recipes
- curated provider allowlists
- external search-engine discovery
- increasing top-120 or max-8 attempts
- weakening semantic/safety/replay gates
- inventing or normalizing undocumented endpoint parameter names
- using live response bodies to repair request/projection contracts
- fresh blind holdouts

## Attribution requirements
For every attempted provider record:
- operation IR count
- operation packet fingerprint
- per-operation proof source and evidence ids
- exact selected operation id or REJECT
- input mapping proof
- output mapping proof
- whether any compile rejection occurs after a valid operation selection
- live/replay disposition

## Formal gates
Same original 4A gates:
- >=12/24 successful manufactures
- >=6/8 successful families
- >=8 distinct provider hosts
- all persisted recipes double-live verified
- >=95% changed-input replay
- replay cognition deltas all zero
- 42/42 controls
- event-derived safety clean
- median success latency <=90s
- p90 success latency <=180s
- mean LLM cost/success <=$0.15
- total LLM cost <=$3.00

Formal decision:
- `GO_4A_R6_DOCUMENTED_OPERATION_IR_RECOVERY`
- otherwise `REASSESS_4A_R6_DOCUMENTED_OPERATION_IR_RECOVERY`

A GO is engineering recovery evidence only. Fresh blind breadth validation remains required afterward.
