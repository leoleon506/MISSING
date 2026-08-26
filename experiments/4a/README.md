# Experiment 4A — Breadth + Economics at Scale

Purpose: measure whether the confirmed 3Z capability-manufacture stack remains useful across a broad portfolio, and whether manufactured recipes are economically reusable.

This is a **scale/economics benchmark**, not another recovery experiment.

## Frozen base
- base SHA: `c1088fc7f3fb54dc648c224b440a544a67fdba41`
- inherits the R2 retrieval/safety stack and 3Z/3Z-A interpretation
- no changes to retrieval scoring, TOP_K, morphology, DNS/private-host guards, redirect policy, GET-only rule, or 3X interpreter

## Preregistered workload
Exactly 24 cases in 8 families, 3 cases/family:
- software
- location
- publication
- consumer
- identity
- culture
- transport
- science

Cases, build inputs, replay inputs, required canonical outputs, semantic validators, model snapshot, prices, budgets and GO gates are frozen in `src/experiment4aCore.ts` before the runner is added.

No provider identity, domain, documentation URL, endpoint, provider parameter name, response mapping, or recipe may be seeded for any case.

## Model and pricing snapshot
- model: `gpt-4.1-mini-2025-04-14`
- input: $0.40 / 1M tokens
- cached input: $0.10 / 1M tokens
- output: $1.60 / 1M tokens

The benchmark records API-reported token usage for reranking and synthesis and computes LLM cost from the frozen prices. Network/API providers are required to be anonymous/free under the existing safety contract, so provider-call monetary cost is treated as zero for this experiment; latency and call volume are still recorded.

## Per-case budget
- mechanical R2 frontier: top 120 unchanged
- reranker: existing bounded selection
- max provider attempts: 8
- max documentation pages/provider: 8
- max documentation depth: 2
- max response/document bytes: 4 MiB
- 2 fresh build verifications before recipe persistence
- 1 changed-input replay from persisted recipe

## Replay rule
Replay may execute the persisted recipe against its provider, but must make **zero** new catalog, reranker, documentation, or synthesis calls.

## GO gates
All must pass:
1. exactly 24 preregistered cases across exactly 8 families
2. no case-specific provider/domain/endpoint/docs/mapping seeds
3. frozen R2 retrieval/safety and real 3X projection path
4. >=12/24 successful manufactures
5. >=6/8 families with at least one successful manufacture
6. >=8 distinct providers
7. every persisted recipe has two successful fresh build verifications
8. changed-input replay success rate >=95%
9. replay cognitive/discovery deltas = 0
10. 42/42 active controls
11. event-derived safety gate passes with a non-empty real ledger
12. fingerprints/timestamps are present for successful recipes
13. median successful manufacture latency <=90 seconds
14. p90 successful manufacture latency <=180 seconds
15. mean LLM cost per successful recipe <=$0.15
16. total LLM cost <=$3.00

Formal result:
- `GO_4A_BREADTH_ECONOMICS_AT_SCALE`
- otherwise `REASSESS_4A_BREADTH_ECONOMICS_AT_SCALE`

A REASSESS is evidence: thresholds and cases must not be changed after observing results. Any subsequent engineering repair gets a new experiment label.
