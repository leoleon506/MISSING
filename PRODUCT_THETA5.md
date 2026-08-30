# Product Theta.5 — Trusted Worker Control Plane

Theta.5 moves privileged supply-growth execution out of anonymous MCP access while preserving the public MISSING runtime as the single durable owner of demand and promoted supply.

## Architecture

```text
Railway cron worker (no public domain)
        |
        | HTTP over Railway private network
        | Authorization: Bearer <secret>
        v
MISSING public runtime
  POST /internal/acquisition/run
        |
        v
Theta.4 orchestrator
        |
        +-> ranked durable demand
        +-> provider discovery
        +-> OpenAPI compilation
        +-> evidence-backed verification inputs
        +-> Theta live replay
        +-> durable promotion -> /data/supply.jsonl
```

The worker does not own a supply ledger and does not need a volume. Promotion happens inside the existing MISSING service, so the same mounted `/data` volume remains the source of truth.

## Security boundary

`/internal/acquisition/run` is inert unless `MISSING_CONTROL_PLANE_TOKEN` is configured with at least 32 characters.

The endpoint:
- accepts POST only;
- requires an exact bearer token using timing-safe comparison;
- accepts no caller-supplied provider URL, candidate, or recipe body;
- derives candidate count and provider timeout only from server-side environment variables;
- calls the existing Theta.4 orchestrator directly;
- lives outside anonymous sandbox rate limiting because it is authenticated machine-to-machine traffic.

Critically, enabling the control plane does **not** enable privileged public MCP tools. Keep these unset on the public MISSING service:

- `MISSING_SUPPLY_ACQUISITION_ENABLED`
- `MISSING_PROVIDER_DISCOVERY_ENABLED`
- `MISSING_OPENAPI_COMPILER_ENABLED`
- `MISSING_THETA_ORCHESTRATOR_ENABLED`

They should continue to report `false` publicly.

## Runtime variables on the existing MISSING service

Required:

```text
MISSING_CONTROL_PLANE_TOKEN=<random secret, at least 32 characters>
```

Optional:

```text
MISSING_CONTROL_PLANE_CANDIDATE_LIMIT=5
MISSING_CONTROL_PLANE_TIMEOUT_MS=8000
```

`/healthz` and `/readyz` expose only `control_plane_enabled: true|false`; they never expose the token.

## Trusted Railway worker

Create a second Railway service from the same GitHub repository in the same `production` environment. It needs no public domain and no volume.

Override its start command to:

```text
node dist/src/worker/acquisitionWorker.js
```

Configure it as a Railway Cron Job. A conservative first cadence is hourly:

```text
0 * * * *
```

The worker is intentionally one-shot: it performs one acquisition cycle, prints the JSON result, and exits. Railway Cron starts it again at the next schedule.

Worker variables:

```text
MISSING_RUNTIME_URL=http://${{MISSING.RAILWAY_PRIVATE_DOMAIN}}:${{MISSING.PORT}}
MISSING_CONTROL_PLANE_TOKEN=${{MISSING.MISSING_CONTROL_PLANE_TOKEN}}
```

The reference-variable syntax keeps the runtime hostname, port, and token synchronized with the MISSING service without duplicating literals.

## Terminal worker outcomes

A successful HTTP request can still produce a product-level terminal state:

- `promoted` — a candidate passed all Theta gates and was durably registered;
- `rejected` — candidates were found but all verification paths failed;
- `needs_evidence` — at least one candidate compiled but lacked two evidence-backed replay inputs;
- `no_candidates` — no unresolved demand or no matching provider leads.

Only transport/authentication/control-plane errors cause the worker process to fail.

## First production proof

After deployment, run the worker manually once before enabling a recurring cron. The expected proof is an ordered Theta.4 trace for the highest-priority unresolved durable demand. If promotion succeeds, verify that:

1. `/healthz` capability/recipe counts increase;
2. `supply.jsonl` contains the promoted recipe on the existing MISSING volume;
3. the new capability resolves through the normal public A2A/MCP runtime;
4. privileged MCP feature flags remain false.

If the first real demand returns `needs_evidence`, that is a valid fail-closed outcome rather than a deployment failure.
