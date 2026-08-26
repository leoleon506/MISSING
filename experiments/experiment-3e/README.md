# MISSING Experiment 3E — MCP Safe Read-Only Execution Gate

## Purpose

Test whether MISSING can discover live MCP tools, conservatively separate read-only tools from tools that may cause external side effects, and execute only the safe subset.

3E uses **no LLM**, **no credentials**, and **no paid APIs**. MCP tool annotations are treated as untrusted hints; they never override the deterministic safety policy.

## Frozen discovery source

Official MCP Registry:

- `https://registry.modelcontextprotocol.io/v0.1/servers?version=latest&limit=100`

Remote eligibility follows 3D: public HTTPS `streamable-http` or `sse`, no unresolved URL variables, no required secret/environment headers.

## Frozen execution safety policy

A tool is executable only when **all** are true:

1. `inputSchema` is an object.
2. `inputSchema.required` is absent or an empty array. No required argument is ever synthesized.
3. If `annotations.readOnlyHint === false`, reject.
4. If `annotations.destructiveHint === true`, reject.
5. Tool name plus description contains at least one explicit read signal:
   - `get`, `list`, `read`, `search`, `find`, `lookup`, `fetch`, `inspect`, `describe`, `status`, `health`, `info`, `view`, `show`, `discover`.
6. Tool name plus description contains **none** of these side-effect/transaction signals:
   - `create`, `update`, `delete`, `remove`, `send`, `publish`, `post`, `put`, `patch`, `upload`, `write`, `insert`, `checkout`, `purchase`, `buy`, `order`, `pay`, `transfer`, `submit`, `commit`, `merge`, `close`, `cancel`, `invite`, `message`, `email`, `reply`, `vote`, `like`, `follow`, `subscribe`, `unsubscribe`, `deploy`, `restart`, `stop`, `start`, `set`, `change`, `edit`, `add`, `execute`, `run`.
7. The call arguments are exactly `{}`.

Any ambiguity means **REJECT / DO NOT EXECUTE**.

## Frozen procedure

1. Discover remote MCP servers as in 3D.
2. Connect and call only `listTools()`.
3. Classify every returned tool using the frozen safety policy.
4. Persist accepted and rejected tools plus reasons.
5. Execute at most **one accepted tool per server** with arguments `{}`.
6. Execute at most **8 tools total**.
7. Persist the complete MCP result or error and latency.
8. Never execute any tool that fails the safety policy.

## Preregistered gates

`GO_MCP_SAFE_READONLY_EXECUTION` iff all are true:

- at least **4 safe tools** execute successfully
- successful executions span at least **4 distinct MCP servers/namespaces**
- execution success rate among attempted safe tools >= **80%**
- tools failing the safety policy that were executed = **0**
- executed tools with required parameters = **0**
- executed tools whose arguments differ from `{}` = **0**
- credentials supplied = **0**
- at least **10 live tools** are explicitly rejected by the safety gate, demonstrating that the gate is not simply allowing everything
- raw registry records, live tool metadata, safety decisions/reasons, call arguments, execution results/errors, and latencies are persisted

Otherwise decision is `REASSESS_MCP_SAFE_READONLY_EXECUTION`.

## Interpretation boundary

A GO would show conservative public read-only MCP execution from live-discovered supply. It would not prove that arbitrary annotations are trustworthy, that all accepted tools are semantically side-effect-free, safe execution with required inputs, composition, paid execution, or production authorization policy.
