# Experiment 4A-R2 — Typed IR Recovery

## Status
Engineering recovery over the already-burned 4A development workload. This is not fresh blind evidence.

## Frozen parent evidence
- 4A-R merge SHA: `d8b7b0f2b0d4269d6bd39a7509089e75fe41c596`
- 4A-R run: `33018509285`
- 4A-R artifact: `9625994752`
- artifact digest: `sha256:2f67410face41d9a49e28d958d526d6ed8c0bd9952c426f8e786311c98406c80`
- report fingerprint: `914c3a95d23c3275e1f9f27e8d07226d2088cb2e707eea23e3d7d0182ffff9a4`

## Motivation
4A-R produced 0 live calls despite extensive documentation acquisition. Forensic inspection showed many planner outputs were rejected at the planner→typed-IR boundary because of output-shape variation. 4A-R2 repairs that boundary only.

## Changes
1. Strict JSON Schema Structured Outputs for the planner.
2. Intermediate list-based IR with no dynamic JSON object keys.
3. Deterministic canonicalization into the existing request contract and 3X projection DSL.
4. Provider-blind source audit checks actual hard-coded provider URL assignments instead of generic `case_id` validation.
5. Runner is deterministically derived from the frozen 4A-R source, preserving the original historical source at its SHA.

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
- 3X DSL executor
- controls and economics thresholds

## Formal gates
Same breadth/economics targets as 4A and 4A-R:
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
- `GO_4A_R2_TYPED_IR_RECOVERY`
- otherwise `REASSESS_4A_R2_TYPED_IR_RECOVERY`

A GO is engineering recovery evidence only. The next confirmatory step must use fresh blind holdouts.
