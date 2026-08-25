# MISSING — Experiment 0B2: Tool-name salience

Experiment 0B showed that stronger fallback descriptions increased total fallback selection above 70% while preserving 0% false positives and 100% precision, but did not improve the three preregistered coverage-boundary cases. This experiment tests whether the fallback tool's *name* affects recovery after a partial or insufficient tool is tried.

## Frozen elements

- Same 66 Experiment 0 cases (33 solvable / 33 requires MISSING)
- Same tool inventory and schemas
- Same MCP implementation except that the fallback registration name is configurable
- Same model: `gpt-4.1-mini`
- Same seed: `20250824`
- Same agent system prompt
- Same strict-recovery description selected from Experiment 0B

Only the fallback tool name varies.

## Preregistered names

1. `resolve_missing_capability` — original name
2. `request_missing_capability` — more explicit action verb
3. `fallback_for_unavailable_capability` — explicitly communicates fallback semantics

## Primary tuning metrics

- fallback-selection rate
- false-positive rate
- precision MISSING
- secondary-recovery rate
- coverage-boundary success rate

The preferred name should preserve false positives <= 10% and precision >= 90%, while improving secondary recovery and coverage-boundary success. Experiment 0B2 is still tuning; the selected name and description must be tested on a new holdout dataset in Experiment 0C before Experiment 1.
