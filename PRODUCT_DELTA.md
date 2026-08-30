# MISSING Product Delta — Remote MCP Edge

Product Delta turns the existing local Product Alpha/Beta/Gamma runtime into a remotely consumable MCP service while preserving the same replay-verified capability contract.

## Product flow

`remote agent -> HTTP MCP discovery -> capability search -> verified execution/failover`

## Why this milestone

Product Alpha made verified recipes executable. Product Beta added real multi-provider failover. Product Gamma added natural-language capability discovery and unresolved-demand capture. Delta makes that product surface reachable by remote MCP clients instead of requiring a local stdio child process.

## Transports

### Local stdio

Existing local usage remains available:

```bash
npm run mcp
```

### Remote Streamable HTTP

Start the remote edge:

```bash
npm run missing:serve
```

Defaults:

- `HOST=127.0.0.1`
- `PORT=3000`
- MCP endpoint: `http://127.0.0.1:3000/mcp`
- health endpoint: `http://127.0.0.1:3000/healthz`

Example public/container binding:

```bash
HOST=0.0.0.0 PORT=3000 npm run missing:serve
```

The `/mcp` endpoint uses the official MCP TypeScript SDK v2 `createMcpHandler` Streamable HTTP implementation. The same product tool registration is shared with stdio.

## Remote product tools

- `list_verified_capabilities`
- `search_verified_capabilities`
- `resolve_capability`
- `missing_runtime_health`
- `record_missing_capability_demand`
- `missing_demand_snapshot`

## Health

`GET /healthz` returns only safe local metadata:

- status
- product name
- product version
- registered capability count
- registered recipe count

It never calls upstream providers.

## Client example

A standard MCP Streamable HTTP client can connect to:

```text
http://HOST:PORT/mcp
```

For example, with the MCP TypeScript SDK, configure `StreamableHTTPClientTransport` with that URL and connect a normal `Client`.

## Current limitations

Product Delta intentionally does **not** add:

- billing;
- authentication or user accounts;
- automatic provider acquisition;
- persistent unresolved-demand storage;
- a public deployment;
- A2A protocol implementation;
- an A2A Agent Card.

No `/.well-known/agent-card.json` is published because MISSING does not yet implement the corresponding A2A server interface.

## Scientific isolation

Product Delta does not modify historical experiments, preregistrations, frozen workloads, holdouts, reports, or experiment decision logic. It only exposes the existing product runtime through an additional official MCP transport.
