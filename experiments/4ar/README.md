# Experiment 4A-R — Breadth Recovery

Status: development/recovery experiment using the burned 4A workload only.

## Purpose

Recover breadth on the exact 24 cases from Experiment 4A without consuming any new blind holdouts and without adding provider-specific rules.

## Frozen references

- 4A run SHA: `9038f5591be396a44f1971520288ddec64098141`
- 4A run: `33016853408`
- 4A artifact: `9625107684`
- 4A artifact digest: `sha256:f1fda614e5bcda5197f963618eb28027a8dc87f1f2a40afab62ec786b6332fda`
- 4A report fingerprint: `ded911e7ef49faf67979b033ec2cefea76451b4e1333554d79b6d35fae1d55dd`

## Development-set rule

The exact 24 cases, families, build inputs, replay inputs, and semantic validators from 4A are reused unchanged. They are burned and are not confirmatory evidence.

## Allowed generic changes

1. Evidence acquisition may probe bounded same-domain standard API specification paths and rank evidence by endpoint/parameter/response density.
2. A typed intermediate representation may normalize generic request syntax before validation:
   - `$input.x` embedded in a path becomes `{x}` + `path_bindings.x=$input.x`.
   - `:x` path parameters become `{x}` when `x` can be bound to an existing input.
   - JSONPath-like `$.a.b` becomes `a.b`.
   - bracket array indices such as `a[0].b` become `a.0.b`.
3. Projection may use the already-proven 3X DSL operators FIELD, INPUT, LOOKUP, and FIND when grounded in supplied evidence.
4. Evidence sent to synthesis may be relevance-windowed around URLs, methods, parameters, schemas, examples, response fields, and required output terms.

## Forbidden changes

- no provider name/domain/endpoint mapping keyed by case id
- no hand-authored recipe for any 4A case
- no case-specific provider ordering
- no reduction of DNS/HTTPS/GET-only/same-domain safety
- no new blind holdouts
- no weakening of the 4A semantic validators

## Recovery gates

All are evaluated on the same 24-case development workload:

- exactly 24 cases / 8 families unchanged
- no case-specific provider/domain/endpoint seeds in 4AR sources
- existing R2 retrieval and reranker remain the source of candidate providers
- at least 12/24 successful manufactures
- at least 6/8 families with a success
- at least 8 distinct provider hosts
- every persisted recipe has two successful fresh build verifications
- at least 95% changed-input replay
- replay causes zero catalog/reranker/docs/synthesis calls
- 42/42 existing controls active
- event-derived safety gate passes
- real non-empty safety ledger
- all recipes use the real 3X interpreter
- median successful manufacture latency <= 90 seconds
- p90 successful manufacture latency <= 180 seconds
- mean LLM cost per success <= $0.15
- total LLM cost <= $3.00

Formal decision:

- `GO_4A_R_BREADTH_RECOVERY`
- otherwise `REASSESS_4A_R_BREADTH_RECOVERY`

A GO is engineering recovery evidence only. A fresh blind breadth experiment is required afterward for confirmatory generalization.