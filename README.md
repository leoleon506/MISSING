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
- shared PostgreSQL financial authority for multi-replica exclusion, crash recovery, settlement reconciliation, lease fencing, request binding, exact on-chain settlement proof, finality/reorg monitoring, dependency backpressure, and abortable deadlines.

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

## Current phase: Real Agent Loop

The Kappa.5 correctness track and Operational Readiness 1–9 established the money/recovery and single-process dependency-safety envelope needed to stop spending the project primarily on hypothetical infrastructure failure modes.

The current objective is now commercial falsification:

> Can one real external-agent demand create verified supply that is then reused by two different paid agent requests with positive realized margin?

`REAL_AGENT_LOOP_1.md` defines the exact proof contract.

CI can only emit:

`READY_REAL_AGENT_PAID_CLOSED_LOOP_PROOF`

It is explicitly forbidden from claiming the live commercial result.

Only production demand/supply ledgers plus real settled rows in the shared PostgreSQL money authority may emit:

`GO_REAL_AGENT_PAID_CLOSED_LOOP`

Until that happens, the business loop is not considered proven.

## Tests

```bash
npm test
npm run build
```

The repository keeps experimental evidence, product milestones, and operational-readiness gates separate so a passing synthetic/formal test cannot be mistaken for live market evidence.

## Historical experiments

The project began by testing whether an explicit fallback tool changes an agent's behavior when a needed capability is absent. Those preregistration-oriented experiments remain under `experiments/` and the corresponding experiment source/workflow files.

They are retained as historical scientific evidence. Product code does not rewrite their provenance or promote newly discovered providers as experimental results.
