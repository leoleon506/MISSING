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

- `GET /` — public product landing and connection guide;
- `POST /mcp` — MCP Streamable HTTP;
- `GET /.well-known/agent-card.json` — A2A Agent Card;
- `POST /` — A2A JSON-RPC;
- `POST /v1/agent/resolve` — agent-native paid resolution path when payments are enabled;
- `GET /livez`, `/readyz`, `/healthz` — operational state.

Local stdio MCP remains available with:

```bash
npm run mcp
```

## Public deployment

Human-readable landing:

```text
https://missing-production-e3da.up.railway.app/
```

Canonical MCP endpoint:

```text
https://missing-production-e3da.up.railway.app/mcp
```

A2A Agent Card:

```text
https://missing-production-e3da.up.railway.app/.well-known/agent-card.json
```

Canonical paid execution endpoint:

```text
POST https://missing-production-e3da.up.railway.app/v1/agent/resolve
```

## Public MCP workflow

The anonymous MCP exposes exactly four product tools:

1. `list_verified_capabilities` — inspect the complete replay-verified catalog and example inputs.
2. `search_verified_capabilities` — find a verified capability from a natural-language task description.
3. `record_missing_capability_demand` — persist an unresolved capability need when no verified match exists.
4. `resolve_capability` — prepare paid execution for an exact verified capability.

Discovery and catalog inspection are free. `resolve_capability` does **not** execute a provider inside MCP and does not charge the caller. It returns a `payment_required` handoff containing the current price, exact request body, canonical `/v1/agent/resolve` endpoint, and recovery-safe x402 instructions.

The subsequent HTTP x402 flow performs provider execution and settlement. Agents should preserve the exact request body and exact `PAYMENT-SIGNATURE` for recovery and should not create a second authorization for a payment already associated with a known transaction.

## Public discovery

MISSING is published in the official MCP Registry as:

```text
io.github.leoleon506/missing
```

Smithery public server:

```text
https://smithery.ai/servers/leo-leon506/missing
```

Smithery-hosted MCP gateway:

```text
https://missing--leo-leon506.run.tools
```

MISSING is also indexed by Glama from its public MCP/Registry surface.

Third-party MCP directories should point to the existing remote Streamable HTTP endpoint rather than deploy or proxy a second MISSING runtime. `PUBLIC_DISTRIBUTION.md` records the current Smithery and Glama distribution procedure.

The x402 `402 Payment Required` challenge advertises Bazaar discovery metadata while the durable payment, request-binding, settlement, finality, fencing, and recovery state machine remains unchanged.

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
