# MISSING — Experiment 1: Capability Genesis

## Why this experiment exists

Experiment 0D validated an explicit Capability Gateway, but routing/search/gateway functionality alone is not differentiated enough. Experiment 1 tests the part that should remain valuable even if cloud vendors commoditize discovery and routing:

**repeated unmet demand → canonical demand cluster → executable capability contract → economic build decision → safe capability manufacture → deterministic validation → reuse without LLM runtime cost**.

This experiment is intentionally NOT a registry, marketplace, leaderboard, MCP gateway, semantic router, or developer bounty board.

## Frozen principles

1. Existing adequate supply wins. MISSING must not build a duplicate.
2. A capability may be manufactured only if it fits the safe MRL execution envelope.
3. No arbitrary code, shell, filesystem, browser automation, credentials, or privileged account actions.
4. Build only when committed demand can economically justify creation.
5. A successful capability must be reusable by a second independent buyer without another LLM build.
6. Runtime execution of a deterministic recipe must not require an LLM.

## Inputs

`demand-events.json` contains independent demand events with:
- buyer identity
- natural-language requested capability
- maximum unit price
- committed call volume over 30 days
- a gold cluster label used only for evaluation

Gold labels are never provided to the planner.

## Candidate clusters in the preregistered fixture

The fixture intentionally includes:
- a public-data capability with repeat demand (`latest_npm_package_version`)
- another public-data capability (`dns_mx_records`)
- a live-data capability (`current_uv_index`)
- a deterministic transformation capability (`parse_yaml`)
- a privileged external action (`send_email`) that should be rejected by the safe factory

## Safe MRL V1

Allowed primitives for this experiment:
- `HTTP_GET`
- `JSONPATH`
- `REGEX`
- `SELECT`
- `RENAME`
- `NORMALIZE`
- `VALIDATE`
- `OUTPUT`

Hard-denied classes include:
- arbitrary code execution
- filesystem access
- browser automation
- credentials/secrets
- account mutation
- email/message/calendar writes
- unrestricted network destinations

## Economic judge

For each canonical cluster:

`committed_revenue_30d = median(max_unit_price_usd) × total_committed_calls_30d`

The build decision is preregistered as economically eligible only when:
- at least 3 independent buyers request the cluster
- committed revenue over 30 days is at least $1.00
- projected build cost is <= 35% of committed 30-day revenue
- projected deterministic runtime cost is <= 25% of median buyer unit price

These are experiment thresholds, not final pricing policy.

## Experiment stages

1. Cluster demand semantically without access to gold labels.
2. Canonicalize each cluster into a capability contract.
3. Classify as `ROUTE_EXISTING`, `BUILD_SAFE`, or `REJECT_UNSAFE_OR_UNECONOMIC`.
4. For `BUILD_SAFE`, generate an MRL recipe.
5. Validate recipe structure and safety deterministically.
6. Execute fixture tests.
7. Reuse the same stored recipe for a second buyer without invoking the builder again.
8. Compute projected 30-day economics.

## Preregistered GO criteria

`GO_CAPABILITY_GENESIS` requires all of:
- demand clustering purity >= 90%
- demand clustering recall >= 90%
- unsafe-build rejection rate = 100%
- safe recipe validation pass rate >= 90%
- fixture execution correctness >= 90%
- second-buyer recipe reuse rate = 100% for deterministic successful recipes
- LLM build calls per reused execution = 0 after recipe publication
- at least one cluster is both safe and economically eligible
- projected gross contribution for that cluster is positive

Otherwise: `REASSESS_CAPABILITY_GENESIS`.

## What a GO would mean

A GO does NOT prove market demand. It proves the core mechanism that differentiates MISSING from commodity routing: the system can convert repeated unmet demand into reusable supply under explicit safety and economic constraints.

The next validation after a GO must replace synthetic demand with externally observed demand and real supply checks before any broader Factory build.
