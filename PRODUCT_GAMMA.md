# MISSING Product Gamma — Supply Demand + AgentRank Foundations

Product Gamma moves MISSING beyond a static verified-recipe registry.

## Product behavior

`agent intent -> capability search -> verified execution when known -> unresolved demand capture when unknown`

## New runtime capabilities

### `search_verified_capabilities`
Accepts a natural-language task description and ranks currently executable MISSING capabilities. Results include providers, recipe redundancy, matched terms and example input.

The first implementation is deterministic and local: normalized terms, curated capability aliases and a small redundancy bonus. It does not claim to be a universal semantic-ranking model. It creates the product seam where embedding/registry/LLM ranking can later plug in without changing the agent-facing contract.

### `record_missing_capability_demand`
Records a capability intent that MISSING cannot currently resolve. Recording demand does not create a recipe and does not claim support.

Repeated identical normalized demand is counted so the Supply Engine can later prioritize acquisition by observed usage rather than by manually chosen APIs.

### `missing_demand_snapshot`
Returns process-local unresolved demand ordered by repetition.

## Why this matters

The Product Alpha/Beta registry proves execution, normalization and failover for verified recipes. Product Gamma starts the feedback loop required for scale:

`unknown agent demand -> demand graph -> provider acquisition priority -> verified recipe -> searchable capability -> reuse`

## AgentRank direction

The same intent stream used to prioritize supply will later measure discovery performance across:

- MCP metadata/tool retrieval
- A2A Agent Card skills
- lexical registry search
- embedding/vector retrieval
- model tool selection

The product metric is not raw rank. It is successful discovery: the share of relevant agent intents for which MISSING is found, selected and successfully resolves the task.

## Current scope

- no billing
- no automatic provider acquisition yet
- no invented capabilities
- no mutation of historical experiments, preregistrations or holdouts
- demand state is process-local in this milestone; persistence is a later product concern
