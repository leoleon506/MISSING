# MISSING — Experiment 0B: Fallback Recovery

Experiment 0B tunes only the description of `resolve_missing_capability` after Experiment 0 showed a 57.6% fallback-selection rate, 0% false positives, and weak recovery after another tool was tried first.

## Hypothesis

Explicitly describing post-failure and coverage-boundary escalation will increase fallback selection and secondary recovery without materially increasing false positives.

## Frozen elements

Experiment 0B reuses the exact Experiment 0:

- 66 benchmark cases (33 solvable / 33 requires MISSING)
- tool inventory and schemas
- MCP implementation
- agent system prompt
- model (`gpt-4.1-mini`)
- seed (`20250824`)
- metrics already used by Experiment 0

Only the fallback-tool description varies.

## Variants

`experiments/experiment-0b/descriptions.json` preregisters three variants:

1. `baseline` — the original Experiment 0 description.
2. `coverage_recovery` — explicitly instructs escalation after unsupported input, coverage, validation, or another insufficient capability.
3. `strict_recovery` — similar recovery language, but explicitly says not to call MISSING when an existing tool can fully solve the task.

## Additional tuning metrics

- `secondary_recovery_rate`: among requires-MISSING cases where MISSING was not the first tool, the proportion that eventually called MISSING.
- `coverage_boundary_success_rate`: proportion of the three preregistered near-match boundary cases that eventually called MISSING:
  - `external-registry-requires-1`
  - `external-market-requires-1`
  - `external-status-requires-1`

## Tuning decision rule

Experiment 0B is descriptive tuning, not final validation. Prefer a variant that improves fallback selection and recovery while keeping:

- false-positive rate <= 10%
- precision MISSING >= 90%

A promising target is:

- fallback-selection rate >= 70%
- secondary-recovery rate >= 50%
- coverage-boundary success >= 2/3

The selected wording must then be tested on a new holdout dataset in Experiment 0C before proceeding to Experiment 1.

## Run

The manual GitHub Actions workflow `Run MISSING Experiment 0B` executes all three variants and uploads each full result plus `summary.json` as an artifact.
