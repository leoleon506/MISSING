# Product Iota — AgentRank

Product Iota makes verified multi-provider routing evidence-driven.

## Goal

MISSING already knows whether a provider recipe is replay-verified and can fail over when a provider fails. Iota adds persistent runtime evidence so provider order can improve from actual production behavior rather than remain permanently fixed by registry order.

## Evidence collected

For every real capability-resolution attempt, MISSING records only provider-routing evidence:

- capability identifier;
- provider and recipe fingerprint;
- success/failure;
- HTTP status;
- latency;
- attempt position;
- whether a later provider rescued an earlier failure;
- timestamp and error summary.

The AgentRank ledger deliberately does **not** persist user input, response payloads, prompts, or request URLs.

By default the ledger is colocated with the demand ledger as `agentrank.jsonl`. On the Railway deployment where demand is `/data/demand.jsonl`, AgentRank therefore persists at `/data/agentrank.jsonl`.

## Cold-start behavior

Verified supply is not demoted merely because it is new. If no provider for a capability has runtime observations, Iota preserves the established recipe-registry order exactly.

Once runtime evidence exists, AgentRank may reorder eligible providers before the existing circuit-breaker/failover loop executes.

## Score

Iota v1 combines:

- 55% smoothed runtime reliability;
- 25% successful-call latency;
- 15% verification strength/freshness;
- 5% rescue history.

Reliability uses a small Bayesian prior so one observation does not produce an absolute 0% or 100% belief. Latency is normalized continuously rather than using hard buckets.

**Cost is intentionally excluded from Iota.** Provider pricing, margins, customer price, and economic routing belong to Product Kappa. Iota must not invent or infer monetary data that MISSING does not possess.

## Routing boundary

AgentRank only orders recipes that are already replay-verified and registered. It cannot:

- promote unverified supply;
- bypass circuit breakers;
- change recipe bindings or projections;
- suppress failover after a provider fails;
- create provider cost data;
- make a user request fail because telemetry persistence failed.

If AgentRank persistence is unavailable, capability execution still proceeds.

## MCP observability

`missing_agent_rank` returns per-capability provider rankings, score components, observation counts, success/failure counts, observed latency, rescue successes, and whether routing is still using cold-start registry order.

## Configuration

- `MISSING_AGENTRANK_ENABLED=0` disables AgentRank routing while preserving evidence. Enabled by default.
- `MISSING_AGENTRANK_LEDGER=/path/agentrank.jsonl` overrides the ledger path.

Health/readiness expose `agentrank_enabled` and `agentrank_persistence`.

## Next milestone

Kappa can extend the routing decision with explicit upstream cost, customer price, gross margin, budgets, metering, and settlement. Iota provides the operational-quality half of that future economic router.
