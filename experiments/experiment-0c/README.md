# MISSING — Experiment 0C Holdout

Experiment 0C is the first fresh holdout after tuning in Experiments 0B and 0B2.

Frozen configuration:
- model: `gpt-4.1-mini`
- seed: `20250824`
- fallback tool name: `request_missing_capability`
- fallback description: the `strict_recovery` wording selected during tuning
- MCP tool inventory, schemas, system prompt, and execution loop unchanged

Dataset:
- 40 completely new cases
- 20 `solvable_without_missing`
- 20 `requires_missing`
- among requires-MISSING: 10 `direct_*` cases and 10 `boundary_*` cases

The direct group tests whether the agent recognizes a clearly absent capability. The boundary group tests whether the agent escalates after an available tool is relevant but insufficient.

## Preregistered decision rules

### GO_EXPERIMENT_1_FACTORY
All of:
- overall fallback-selection rate >= 75%
- false-positive rate <= 10%
- precision MISSING >= 90%
- direct-missing fallback rate >= 80%
- boundary-missing fallback rate >= 60%

### GO_REROUTING_GATEWAY_BEFORE_FACTORY
All of:
- false-positive rate <= 10%
- precision MISSING >= 90%
- direct-missing fallback rate >= 80%
- boundary-missing fallback rate < 60%

Interpretation: semantic fallback works, but recovery after partial-tool failure needs a deterministic routing/escalation layer before the Factory.

### REASSESS
Any other outcome. In particular, weak performance on fresh direct-missing cases would challenge the core fallback-distribution thesis.

No description, tool-name, dataset, threshold, model, seed, or system-prompt changes should be made after running 0C and before interpreting the result.
