# MISSING — Experiment 1A: Capability Genesis Decision

## Why this experiment exists

Experiment 0D validated an explicit Capability Gateway, but routing/search/gateway functionality alone is not differentiated enough. Experiment 1A tests the first differentiated loop that should remain valuable even if cloud vendors commoditize discovery and routing:

**repeated unmet demand → canonical demand cluster → capability contract → deterministic safety judgment → economic build decision**.

This experiment is intentionally NOT a registry, marketplace, leaderboard, MCP gateway, semantic router, or developer bounty board.

It also intentionally does NOT yet claim successful capability execution or reuse. Those are reserved for Experiment 1B if 1A passes.

## Frozen principles

1. Existing adequate supply should win in the eventual product; MISSING should not knowingly manufacture duplicates.
2. A proposed capability may proceed toward manufacture only if it fits the safe MRL execution envelope.
3. No arbitrary code, shell, filesystem, browser automation, credentials, or privileged account actions.
4. Build only when committed demand can economically justify creation.
5. Security and economics are deterministic judges, not LLM opinions.

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

## Safe MRL V1 proposal envelope

Allowed primitives:
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
- unrestricted privileged external actions

Experiment 1A checks whether the proposed recipe stays inside this envelope. It does not yet execute the recipe.

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
3. Propose an MRL primitive sequence for safe candidates.
4. Reject privileged or out-of-envelope demand deterministically.
5. Evaluate economic eligibility deterministically.
6. Compute projected 30-day gross contribution.

## Preregistered GO criteria

`GO_CAPABILITY_GENESIS` requires all of:
- demand clustering purity >= 90%
- demand clustering recall >= 90%
- unsafe-build rejection rate = 100%
- safe recipe-envelope validation pass rate >= 90%
- at least one cluster is both safe and economically eligible
- projected gross contribution for at least one eligible cluster is positive

Otherwise: `REASSESS_CAPABILITY_GENESIS`.

## What a GO would mean

A GO does NOT prove market demand and does NOT prove that MISSING can already execute or reuse a manufactured capability. It proves that the system can convert repeated unmet demand into a coherent, safe, economically justified build candidate without letting the LLM decide safety or economics.

## Required next step after GO: Experiment 1B

Experiment 1B must test actual manufacture and reuse:
- generate a complete executable MRL recipe
- deterministic validator passes
- fixture execution correctness >= 90%
- stored recipe reused by a second independent buyer
- no new LLM build call during deterministic reuse
- measured build cost and runtime cost, not only projections

Only after 1B should MISSING move toward externally observed demand, real supply checks, and later real payment experiments.
