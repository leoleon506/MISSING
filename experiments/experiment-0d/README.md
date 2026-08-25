# MISSING — Experiment 0D Capability Gateway

Experiment 0D tests a revised architecture after Experiment 0C showed that spontaneous fallback selection by a generic agent does not generalize reliably.

The gateway does **not** execute tools and does **not** build capabilities. It receives the user task plus the actual MCP capability inventory and returns one structured decision:

- `ROUTE_EXISTING` with the selected tool name, or
- `MISSING` when the inventory does not fully cover the task.

## Fresh dataset

- 60 new cases not used in Experiments 0, 0B, 0B2, or 0C
- 30 `solvable_without_missing`
- 30 `requires_missing`
  - 15 direct missing
  - 15 boundary missing

The gateway receives no evaluator labels, expected tool, case family, difficulty, or case ID.

## Frozen inventory

The inventory is obtained through MCP `listTools()` from the current benchmark server with the MISSING fallback tool disabled. The gateway sees the exact MCP tool names, descriptions, and input schemas.

## Frozen gateway policy

The gateway must judge declared capability coverage, not whether the model personally knows an answer. It must return MISSING if the requested values, data source, action, granularity, operation, or complete task are outside the explicit descriptions/schemas.

## Preregistered thresholds

`GO_CAPABILITY_GATEWAY_ARCHITECTURE` requires all of:

- coverage detection accuracy >= 95%
- missing recall >= 90%
- missing precision >= 95%
- false missing rate <= 5%
- boundary missing detection >= 90%
- correct selected tool rate on solvable cases >= 90%

Anything else is `REASSESS_GATEWAY`.

No Factory, x402, payment, capability generation, deployment, marketplace, or execution routing is implemented in this experiment.
