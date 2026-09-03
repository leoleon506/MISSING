# MISSING — Capability Fallback Network for AI Agents

MISSING is a product runtime for agents that need a capability they do not currently have.

Instead of hallucinating support or stopping at “I cannot do that”, an agent can ask MISSING to discover an existing replay-verified capability, execute it through a verified provider recipe, or durably record the unresolved demand so the trusted acquisition loop can search for new supply.

The long-term product loop is:

```text
agent needs capability
        ↓
MISSING discovery
        ↓
verified supply exists? ── yes ──> execute
        │
        no
        ↓
durable unresolved demand
        ↓
trusted supply acquisition
        ↓
deterministic compilation + repeated live replay verification
        ↓
promote verified recipe
        ↓
future agents reuse it
        ↓
x402 paid resolution + positive margin
```

## Current product surface

MISSING currently includes:

- a verified capability registry and deterministic provider execution;
- multi-provider failover and capability search;
- remote MCP over Streamable HTTP;
- A2A v1 Agent Card discovery and JSON-RPC invocation;
- durable unresolved-demand telemetry;
- a public-sandbox deployment model with rate limiting and readiness/liveness endpoints;
- automatic demand-ranked provider discovery from structured API catalogs;
- OpenAPI-to-recipe compilation, grounded verification-input harvesting, repeated live replay, and durable supply promotion;
- a trusted worker/control plane for automatic acquisition outside anonymous public access;
- provider-readiness diagnostics and durable blocker/backoff handling;
- explicit provider economics, margin-aware routing, and metering;
- an autonomous agent payment endpoint using x402;
- shared PostgreSQL financial authority for multi-replica exclusion, crash recovery, settlement reconciliation, lease fencing, request binding, exact on-chain settlement proof, finality/reorg monitoring, dependency backpressure, abortable deadlines, RPC-chain identity admission, and telemetry reconciliation.

Historical experiments and formal operational gates remain in the repository as evidence, but they are no longer the product description.

## Agent interfaces

Run the remote product runtime:

```bash
npm ci
npm run build
npm run missing:serve
```

Primary surfaces include:

- `POST /mcp` — MCP Streamable HTTP;
- `GET /.well-known/agent-card.json` — A2A Agent Card;
- `POST /` — A2A JSON-RPC;
- `POST /v1/agent/resolve` — agent-native paid resolution path when payments are enabled;
- `GET /livez`, `/readyz`, `/healthz` — operational state.

Local stdio MCP remains available with:

```bash
npm run mcp
```

## Trust boundary

MISSING does not treat discovery as proof.

A discovered provider lead cannot become executable merely because its documentation looks relevant. Automatic supply must pass deterministic compilation and replay-verification gates before promotion. Unknown demand remains unknown until that boundary is crossed.

Paid execution also fails closed around authoritative payment state. A successful provider call alone is not customer revenue; revenue is recognized only after settlement succeeds.

## Current phase: Real Agent Loop 2

Kappa.5 and Operational Readiness 1–9 established the money/recovery and dependency-safety envelope. Real Agent Loop 1 then crossed the first live commercial boundary: production emitted `GO_REAL_AGENT_PAID_CLOSED_LOOP` from two distinct settled Base-mainnet payments reusing the same demand-derived promoted recipe with positive realized margin.

The current uncertainty is no longer whether the loop can happen once. It is whether MISSING can reproduce the commercial loop autonomously across independent capabilities:

> Can at least two different external-agent demands each be selected by the trusted control plane, autonomously become replay-verified promoted supply, and each generate repeated positive-margin paid reuse?

`REAL_AGENT_LOOP_2.md` defines the preregistered proof contract.

Qualifying RAL2 promotions carry durable trusted-control-plane provenance (`acquisition_path` plus `control_plane_run_id`) so direct/manual promotion cannot be confused with autonomous acquisition evidence.

CI may validate the proof machinery but cannot claim the live commercial outcome. Only production ledgers plus real settled PostgreSQL rows on approved value networks may eventually emit:

`GO_AUTONOMOUS_COMMERCIAL_REPLICATION`

## Tests

```bash
npm test
npm run build
```

The repository keeps experimental evidence, product milestones, and operational-readiness gates separate so a passing synthetic/formal test cannot be mistaken for live market evidence.

## Historical experiments

The project began by testing whether an explicit fallback tool changes an agent's behavior when a needed capability is absent. Those preregistration-oriented experiments remain under `experiments/` and the corresponding experiment source/workflow files.

They are retained as historical scientific evidence. Product code does not rewrite their provenance or promote newly discovered providers as experimental results.
