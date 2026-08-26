# MISSING Experiment 3D — Live MCP Tool Discovery

## Purpose

Test whether MISSING can discover live remote MCP servers from the Official MCP Registry, complete the MCP initialize handshake, obtain `tools/list`, persist normalized tool contracts, and confirm them with a second fresh connection — without executing any tool.

3D uses **no LLM**, **no tool execution**, **no credentials**, and **no paid APIs**.

## Frozen source

Official MCP Registry:

- `https://registry.modelcontextprotocol.io/v0.1/servers?version=latest&limit=100`

The registry is only a discovery source. A server is considered live only if a fresh MCP client can connect to its published remote transport and `listTools()` succeeds.

## Frozen selection rules

1. Fetch latest server records from the Official MCP Registry.
2. Keep only active/non-deleted records with a concrete HTTPS remote URL and transport type `streamable-http` or `sse`.
3. Reject remote URLs containing unresolved `{variables}`.
4. Reject remotes whose declared headers contain required values that are not literal public values; no credentials or environment variables are supplied.
5. Sort candidates by server name and then remote URL.
6. Attempt at most **30 distinct server names**, at most one remote per server.
7. For each candidate, create a fresh MCP `Client`, connect using the declared transport, and call only `listTools()`.
8. A first-list success requires at least one tool and every admitted tool to have a non-empty name and object `inputSchema`.
9. Close the client. Create a second fresh client/transport to the same URL and call only `listTools()` again.
10. Second-list persistence passes when every first-list tool name is present again and its `inputSchema` JSON is unchanged.
11. **Never call `callTool()` in this experiment.**

## Limits

- registry records fetched: **100**
- max distinct servers attempted: **30**
- per-connect/list timeout: **12 seconds**
- max admitted servers retained: **10**

## Preregistered gates

`GO_LIVE_MCP_TOOL_DISCOVERY` iff all are true:

- at least **5 live MCP servers** admitted
- at least **5 distinct server namespaces/providers** represented
- at least **20 tools** discovered across admitted servers
- first-list success rate among attempted eligible remote servers >= **40%**
- **100%** of admitted tools have non-empty names and object input schemas
- second fresh-connection persistence rate for admitted servers = **100%**
- tool calls executed = **0**
- credentials supplied = **0**
- unresolved-variable remotes admitted = **0**
- raw registry records, remote URLs, server info, tool schemas, first/second list evidence, and rejection reasons are persisted

Otherwise decision is `REASSESS_LIVE_MCP_TOOL_DISCOVERY`.

## Interpretation boundary

A GO would prove live agent-native discovery of tool contracts from public remote MCP servers. It would not prove tool execution quality, semantic substitutability, composition, paid execution, authorization flows, resale rights, or commercial demand.
