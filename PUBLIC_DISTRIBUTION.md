# Public MCP Distribution

MISSING exposes one production MCP server and should not be re-hosted or proxied as a second product runtime just for directory distribution.

## Canonical remote MCP endpoint

```text
https://missing-production-e3da.up.railway.app/mcp
```

Transport: MCP Streamable HTTP.

Official MCP Registry name:

```text
io.github.leoleon506/missing
```

## Smithery

Smithery supports publishing an already-hosted public Streamable HTTP server by URL. The canonical endpoint above should be submitted directly.

Preferred web flow:

1. Open `https://smithery.ai/new`.
2. Enter `https://missing-production-e3da.up.railway.app/mcp`.
3. Complete the authenticated publishing flow.
4. Keep Smithery pointing at the existing Railway endpoint; do not create another MISSING deployment.

CLI equivalent after authenticating with Smithery:

```bash
npm install -g smithery@latest
smithery auth login
smithery mcp publish "https://missing-production-e3da.up.railway.app/mcp" -n leoleon506/missing
```

If the namespace selected in the Smithery account differs, use the namespace owned by that account instead of `leoleon506`.

MISSING's public MCP surface intentionally provides free discovery while `resolve_capability` returns an x402 handoff. Paid provider execution remains on the canonical HTTP endpoint:

```text
POST https://missing-production-e3da.up.railway.app/v1/agent/resolve
```

## Glama

Glama ingests entries from the official MCP Registry, so the existing registry publication is the preferred first distribution path. No second MISSING runtime is required.

For explicit Glama Connector ownership, Glama requires a file at:

```text
/.well-known/glama.json
```

on the production domain. The file contains the email associated with the Glama account. Do not commit a personal account email to the public repository merely to claim the connector. Add this only when a dedicated public maintainer address or intentionally public Glama account address is available.

Expected ownership document shape:

```json
{
  "$schema": "https://glama.ai/mcp/schemas/connector.json",
  "maintainers": [
    { "email": "PUBLIC_GLAMA_ACCOUNT_EMAIL" }
  ]
}
```

## Discovery semantics

Third-party directories should advertise the existing MCP endpoint as a discovery surface. They must not bypass the public/trusted split or the paid execution boundary.

Expected public behavior:

1. Search/list verified capabilities over MCP for free.
2. Call `resolve_capability` to receive a payment handoff.
3. POST the exact handoff request to `/v1/agent/resolve`.
4. Receive the x402 `402 Payment Required` challenge, including Bazaar discovery metadata.
5. Retry the same request with the signed `PAYMENT-SIGNATURE`.
6. Let the existing durable RAL2 payment/recovery path perform provider execution and settlement.

Directory integrations are distribution metadata only. They do not become payment authorities, provider runners, or trusted acquisition workers.
