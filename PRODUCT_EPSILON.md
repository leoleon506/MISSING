# MISSING Product Epsilon — A2A + Agent Discovery

Product Epsilon makes the MISSING product runtime discoverable and callable by A2A-compatible agents while preserving the verified-capability contract introduced in Product Alpha/Beta/Gamma/Delta.

## Product behavior

`A2A client -> Agent Card discovery -> natural-language capability discovery -> verified execution/failover`

MISSING continues to expose MCP over Streamable HTTP at `/mcp`. Product Epsilon adds a second, agent-native discovery and invocation surface using the official A2A JavaScript SDK and A2A Protocol v1.

## Agent Card

MISSING publishes its public Agent Card at:

`/.well-known/agent-card.json`

The card advertises a JSON-RPC A2A interface and two product skills:

- `discover_verified_capability` — accepts a natural-language intent and returns ranked replay-verified MISSING capabilities. If no capability matches, the demand is recorded instead of inventing support.
- `resolve_verified_capability` — accepts JSON text with `capability` and `input`, then executes only the existing verified recipe registry and its runtime failover behavior.

Example discovery input:

`locate this IP address`

Example execution input:

```json
{"capability":"ip_geolocation_metadata","input":{"ip_address":"1.1.1.1"}}
```

## Running

```bash
npm run missing:serve
```

Environment variables:

- `HOST` — bind host; defaults to `127.0.0.1`.
- `PORT` — bind port; defaults to `3000`.
- `PUBLIC_BASE_URL` — externally reachable base URL advertised by the A2A Agent Card. For a public deployment this must be the real HTTPS origin.

Local endpoints:

- MCP: `http://127.0.0.1:3000/mcp`
- A2A Agent Card: `http://127.0.0.1:3000/.well-known/agent-card.json`
- A2A JSON-RPC: `http://127.0.0.1:3000/`
- Health: `http://127.0.0.1:3000/healthz`

## Product guarantees

A2A does not bypass MISSING verification rules. An A2A request can only execute a capability already present in the replay-verified product registry. Unknown natural-language demand is captured but never converted into a claimed capability automatically.

## Current limitations

Product Epsilon deliberately does not add:

- billing;
- authentication or accounts;
- persistent unresolved-demand storage;
- automatic provider acquisition;
- public hosting or DNS;
- push notifications;
- streaming A2A tasks;
- signed Agent Cards;
- a public registry submission or search-engine indexing guarantee.

Those are later product concerns. Product Epsilon establishes a standards-compliant discovery seam first.

## Scientific isolation

Product Epsilon does not modify historical experiments, preregistrations, frozen workloads, holdouts, historical decisions, or experiment reports. It consumes the existing product registry and runtime exactly as previous product milestones do.
