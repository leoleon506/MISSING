# MISSING Experiment 3F — MCP Execution Readiness Discovery

## Purpose

Classify live-discovered MCP supply by actual execution readiness before it can enter the usable Capability Graph.

3F uses **no LLM**, **no credentials**, and **no paid APIs**.

## Frozen states

Each inspected server is assigned one terminal readiness state:

- `public`: a conservatively safe read-only tool with zero required parameters executes with `{}` and succeeds again on a fresh connection.
- `auth_required`: the safe execution attempt returns an authentication/authorization requirement.
- `execution_error`: the server lists tools and a safe candidate exists, but execution fails for a non-auth reason or fails confirmation.
- `no_safe_candidate`: server is live but exposes no tool that satisfies the frozen safe policy.
- `unreachable`: initialize or `listTools()` fails.

## Frozen safe-tool policy

Same as Experiment 3E:

- object `inputSchema`
- no required parameters
- `annotations.readOnlyHint === true`
- `annotations.destructiveHint !== true`
- explicit read lexical signal
- no mutation/transaction lexical signal
- arguments exactly `{}`

## Frozen procedure

1. Fetch the first 100 latest records from the Official MCP Registry.
2. Keep public HTTPS Streamable HTTP/SSE remotes without unresolved variables or declared credential headers.
3. Sort by server name and URL.
4. Inspect at most **40 servers**.
5. For each live server, classify all tools using the frozen safety policy and select at most the first safe candidate.
6. Execute at most **12 safe candidates total** with `{}`.
7. Detect auth-required failures only from explicit protocol/error text containing `auth`, `unauthorized`, `forbidden`, `401`, or `403`.
8. For every first execution success, close the client, create a fresh connection, re-list tools, and execute the exact same tool again with `{}`.
9. A server is `public` only if both executions succeed.
10. Never supply credentials, synthesize arguments, or execute a tool that fails safety policy.

## Preregistered gates

`GO_MCP_EXECUTION_READINESS` iff all are true:

- at least **4 public servers** confirmed
- at least **4 distinct namespaces/providers** among public servers
- public confirmation rate = **100%** for first-success candidates
- at least **1 auth_required** server is correctly separated from public supply
- unsafe tools executed = **0**
- required-parameter tools executed = **0**
- non-empty argument executions = **0**
- credentials supplied = **0**
- at least **3 readiness states** are observed in the live sample
- raw registry evidence, tool decisions, first/second execution results, latencies, and terminal readiness states are persisted

Otherwise decision is `REASSESS_MCP_EXECUTION_READINESS`.

## Interpretation boundary

A GO would prove that MISSING can distinguish immediately usable anonymous read-only MCP supply from auth-gated or otherwise unusable supply. It would not prove safe execution with required inputs, semantic composition, paid execution, or production authorization.
