# Experiment 4A-R3 — Typed Binding IR Recovery

## Status
Engineering recovery over the already-burned 4A development workload. This is not fresh blind evidence.

## Frozen parent evidence
- 4A-R2 merge SHA: `2b6718b8625eb257291bcb6df9d2a586f5126346`
- 4A-R2 run: `33021647548`
- 4A-R2 artifact: `9627153170`
- artifact digest: `sha256:5cfe8066c58707b2f8d27dfc83bf7f80c2f94b9b612739a18c99f5b7c2ee18d2`
- report fingerprint: `5ac172e89b66eeadedbaa121af7398a5fc16a95ee2905db8b816ee94d241f3b9`

## Motivation
4A-R2 restored live execution (7 live calls) but still produced 0 successful manufactures. Forensic inspection showed that projection IR was typed while request bindings remained free-form strings, allowing planner outputs such as `input.name`, `INPUT`, or bare input names to reach execution as literal query values.

## Changes
1. Path bindings use a strict typed row and may only select `source_kind=INPUT`.
2. Query bindings use strict typed rows with `source_kind=INPUT|LITERAL`.
3. `input_name` is constrained by JSON Schema to the exact frozen inputs of the current case.
4. Deterministic canonicalization is the only component allowed to emit `$input.<name>`.
5. Literal query values require `source_kind=LITERAL`, `input_name=null`, and a string literal.
6. Empty-recipe fingerprint/projection gates are no longer vacuously true.

## Frozen unchanged components
- exact 24 cases / 8 families
- build and replay inputs
- semantic validators
- Public APIs catalog retrieval
- R2 broad retrieval
- reranker
- documentation crawl and standard spec probing
- DNS/network safety
- evidence grounding
- 3X projection DSL and executor
- controls and economics thresholds

## Formal gates
Same breadth/economics targets as 4A, 4A-R and 4A-R2:
- >=12/24 successful manufactures
- >=6/8 families
- >=8 distinct provider hosts
- double live verify for every recipe
- >=95% changed-input replay
- zero catalog/reranker/docs/synthesis calls during replay
- 42/42 controls
- event-derived safety clean
- latency and cost budgets unchanged

Formal decision:
- `GO_4A_R3_TYPED_BINDING_RECOVERY`
- otherwise `REASSESS_4A_R3_TYPED_BINDING_RECOVERY`

A GO is engineering recovery evidence only. Fresh blind breadth validation is required afterward.
