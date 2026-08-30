# Product Iota.1 — Safe Provider Exploration

Iota v1 can rank only providers it has observed. When the primary provider succeeds continuously, verified backups can remain permanently cold and AgentRank cannot compare them.

Iota.1 adds bounded shadow exploration for already replay-verified provider recipes.

## Safety properties

- Disabled by default. Enable explicitly with `MISSING_AGENTRANK_EXPLORATION_ENABLED=1`.
- Never discovers or promotes new supply. Exploration can only select a recipe already present in the verified runtime registry.
- Never changes the response returned to the agent. The normal provider resolves the user request; exploration is advisory and fire-and-forget.
- Never changes circuit-breaker state. Shadow failures update AgentRank evidence only.
- Never copies the user's runtime input or output to an alternate provider. A shadow probe uses only the alternate recipe's already-verified `example_input`.
- At most one alternate provider is explored per successful resolution.
- Duplicate concurrent probes for the same recipe are suppressed process-locally.
- Exploration automatically stops for an alternate after it reaches `MISSING_AGENTRANK_MIN_OBSERVATIONS` observations (default 2).
- Telemetry remains in the existing persistent AgentRank ledger.

## Production bootstrap example

For `country_alpha_metadata`, if Warnely continues to resolve user requests while `countries.dev` has zero evidence, enabling exploration causes a bounded background probe of `countries.dev` using its verified example input (`JP`). Once `countries.dev` reaches the evidence threshold, shadow traffic stops and AgentRank has comparable evidence for both providers.

## Economic boundary

Iota.1 does not model upstream provider cost. Because exploration can create additional provider calls, the feature remains opt-in until Kappa introduces explicit cost, price, margin, and economic routing controls.
