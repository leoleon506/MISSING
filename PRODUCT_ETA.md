# Product Eta: Public Agent Sandbox

Product Eta packages the MISSING product runtime so external agents can safely exercise the existing MCP and A2A surfaces without treating the service as production-grade infrastructure.

## Product flow

`external agent -> public MCP/A2A edge -> sandbox controls -> verified capability runtime -> persistent demand telemetry`

## Public surfaces

- `POST /mcp` — MCP Streamable HTTP.
- `GET /.well-known/agent-card.json` — A2A v1 Agent Card.
- `POST /` — A2A JSON-RPC transport.
- `GET /livez` — process liveness.
- `GET /readyz` — deployment readiness based on public URL validity and demand persistence.
- `GET /healthz` — safe product/runtime metadata.
- `GET /sandboxz` — aggregate sandbox limits and privacy-safe request counters.

## Sandbox limits

The sandbox uses an in-memory per-client fixed-window limit. Defaults:

- `MISSING_SANDBOX_ENABLED=1`
- `MISSING_SANDBOX_REQUESTS_PER_WINDOW=60`
- `MISSING_SANDBOX_WINDOW_MS=60000`

Control endpoints and Agent Card discovery do not consume agent quota. Rate-limited calls receive HTTP 429 and `Retry-After`.

This limiter is intentionally local to one process. It is sufficient for a single-node public sandbox but is not a distributed production quota system.

## Privacy boundary

Sandbox telemetry stores aggregate counts only:

- total requests;
- rate-limited requests;
- protocol counts;
- HTTP status-class counts.

It does not expose or persist client IP addresses, request prompts, capability inputs, authentication identities, or user profiles. Unknown capability demand continues to use Product Zeta's separate durable demand ledger.

## Container deployment

Build:

```bash
docker build -t missing-sandbox .
```

Run:

```bash
docker run --rm -p 3000:3000 \
  -e PUBLIC_BASE_URL=https://missing.example \
  -v missing-demand:/data \
  missing-sandbox
```

The container defaults to `HOST=0.0.0.0`, `PORT=3000`, sandbox mode enabled, and `MISSING_DEMAND_LEDGER=/data/demand.jsonl`.

`PUBLIC_BASE_URL` must be set to the externally reachable HTTPS origin in a real deployment so the A2A Agent Card advertises the correct endpoint.

## Readiness versus liveness

`/livez` answers whether the process is alive.

`/readyz` returns 200 only when:

1. the advertised public base URL parses as HTTP/HTTPS; and
2. durable demand persistence is configured.

This keeps orchestration health separate from product readiness.

## Deliberate exclusions

Product Eta does not add:

- accounts or authentication;
- billing or metering for money;
- distributed/shared rate limiting;
- a managed database;
- WAF or DDoS protection;
- TLS termination;
- multi-region deployment;
- public DNS or a hosted domain;
- provider-specific deployment manifests;
- automatic provider acquisition.

Those are intentionally deferred until public sandbox traffic demonstrates real agent demand.

## Scientific isolation

Product Eta does not modify historical experiments, frozen workloads, preregistrations, experiment evidence, or prior scientific decisions.
