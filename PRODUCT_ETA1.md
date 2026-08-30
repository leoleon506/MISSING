# Product Eta.1 — Railway public sandbox deployment

This milestone connects the provider-neutral Product Eta sandbox to a concrete low-cost public deployment path on Railway while keeping the runtime portable.

## Runtime contract

The existing Docker image remains authoritative. Railway builds it from `Dockerfile`, exposes the service over HTTPS, and probes `/readyz` before considering a deployment healthy.

MISSING automatically derives its external origin in this order:

1. `PUBLIC_BASE_URL` when explicitly configured;
2. `https://${RAILWAY_PUBLIC_DOMAIN}` when running on Railway;
3. the local host/port fallback for local development.

This is important because the A2A Agent Card must advertise an externally reachable URL rather than the container-local origin.

## Railway setup

Create a Railway service from the GitHub repository and use the repository Dockerfile. Generate a public domain for the service. Railway exposes that domain through `RAILWAY_PUBLIC_DOMAIN`, so no manual `PUBLIC_BASE_URL` is required unless a custom domain is used.

Attach one persistent volume mounted at:

`/data`

The Product Eta Docker image already configures:

`MISSING_DEMAND_LEDGER=/data/demand.jsonl`

so unresolved Product Zeta demand survives service restarts and redeployments.

Recommended sandbox environment values are already present in the Docker image:

- `HOST=0.0.0.0`
- `MISSING_SANDBOX_ENABLED=1`
- `MISSING_SANDBOX_REQUESTS_PER_WINDOW=60`
- `MISSING_SANDBOX_WINDOW_MS=60000`
- `MISSING_DEMAND_LEDGER=/data/demand.jsonl`

Railway supplies `PORT`; the service should not hard-code it externally.

## Public endpoints

Once Railway has generated the domain, the public surfaces are:

- `https://<domain>/mcp`
- `https://<domain>/.well-known/agent-card.json`
- `https://<domain>/livez`
- `https://<domain>/readyz`
- `https://<domain>/healthz`
- `https://<domain>/sandboxz`
- A2A JSON-RPC at the public origin.

## Proxy safety

When Railway is detected, Express trusts one proxy hop so per-client sandbox rate limiting can use the forwarded client address rather than grouping every external agent under the Railway proxy address. MISSING still does not persist client IPs.

## Deployment acceptance

A public deployment is acceptable only when all of the following are true:

1. `/livez` returns HTTP 200;
2. `/readyz` returns HTTP 200;
3. `/.well-known/agent-card.json` advertises the Railway/custom HTTPS origin;
4. `/healthz` reports `demand_persistence: true` and `sandbox: true`;
5. the `/data` volume is attached;
6. an unknown A2A or MCP demand survives a service restart;
7. verified capabilities still resolve through the existing replay-verified runtime.

## Deliberate exclusions

This is still a public sandbox, not production billing infrastructure. It does not add authentication, accounts, payments, distributed rate limiting, WAF/DDoS protection, multi-region replication, managed SQL, or provider acquisition automation.
