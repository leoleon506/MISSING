# RAL1 Production Runbook — First Real Paid Closed Loop

Base release: `ab6d3dac829f43115a06044e65546e8a7a743300` (merged PR #189).

This runbook exists to obtain production evidence for `GO_REAL_AGENT_PAID_CLOSED_LOOP`. It does not define RAL2 and it does not allow synthetic/testnet evidence to satisfy the commercial gate.

## 1. Deployment topology

Use the existing Railway project that contains the public MISSING runtime.

### Public runtime service

- Repository: `leoleon506/MISSING`
- Config-as-code file: `/railway.json`
- Public domain currently observed from GitHub deployment status: `missing-production-e3da.up.railway.app`
- Persistent volume mounted at `/data`
- Keep the existing `/readyz` healthcheck.

The Docker image already sets `MISSING_DEMAND_LEDGER=/data/demand.jsonl`. Supply, economics, AgentRank, and other file-backed ledgers derive their default location from the same persistent directory.

### Trusted acquisition worker

Create/use a private worker service in the **same Railway project/environment** as the runtime.

- Repository: same MISSING repository
- Custom config-as-code path: `/railway.worker.json`
- No public domain
- One-shot command: `node dist/src/worker/acquisitionWorker.js`
- Cron: hourly (`0 * * * *`)
- No HTTP healthcheck; the process is expected to execute one cycle and terminate.

Do not keep two independent production acquisition workers active. Once the same-project worker is green, disable/delete the older duplicate worker in the separate Railway project so one demand event cannot trigger competing acquisition cycles.

## 2. Shared runtime/worker control plane

Generate one random control-plane token of at least 32 characters outside Git and add it as a Railway secret to both services:

```text
MISSING_CONTROL_PLANE_TOKEN=<secret>
```

Runtime variables:

```text
MISSING_SUPPLY_ACQUISITION_ENABLED=1
MISSING_PROVIDER_DISCOVERY_ENABLED=1
MISSING_OPENAPI_COMPILER_ENABLED=1
MISSING_THETA_ORCHESTRATOR_ENABLED=1
MISSING_SAFE_POST_REPLAY_ENABLED=1
MISSING_CONTROL_PLANE_TOKEN=<same secret>
```

Worker variables:

```text
MISSING_RUNTIME_URL=<private Railway URL for the runtime, or the public HTTPS URL if private routing is not configured>
MISSING_CONTROL_PLANE_TOKEN=<same secret>
```

The control endpoint is intentionally private-by-secret: `POST /internal/acquisition/run` returns 404 when the control plane is disabled and 401 for an invalid bearer token.

## 3. Shared PostgreSQL financial authority

Provision/attach one Railway PostgreSQL service to the runtime and configure:

```text
MISSING_DISTRIBUTED_MONEY_ENABLED=1
MISSING_POSTGRES_URL=<Railway PostgreSQL DATABASE_URL reference>
MISSING_TRANSACTIONAL_RESPONSE_CACHE_ENABLED=0
```

Do not use the local SQLite authority for the live proof. The production verifier requires the shared PostgreSQL payment table.

After deployment, `/readyz` must report distributed money ready before paid traffic is enabled.

## 4. Mainnet payment configuration

The first commercial proof uses x402 v2 on Base mainnet:

```text
MISSING_AGENT_PAYMENTS_ENABLED=1
MISSING_X402_ENABLED=1
MISSING_PRODUCTION_ADMISSION_ENABLED=1
MISSING_X402_FACILITATOR_URL=https://facilitator.payai.network
MISSING_X402_FACILITATOR_IDEMPOTENCY=1
MISSING_X402_NETWORK=eip155:8453
MISSING_X402_ASSET=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
MISSING_X402_PAY_TO=<merchant-owned Base EVM address>
MISSING_X402_RPC_URL=<reliable Base mainnet JSON-RPC URL>
MISSING_X402_FINALITY_POLICIES={"eip155:8453":12}
MISSING_X402_SETTLED_REORG_MONITOR_ENABLED=1
MISSING_REAL_AGENT_LOOP_VALUE_NETWORKS=eip155:8453
```

`MISSING_X402_FACILITATOR_BEARER` may remain unset for PayAI's free tier. If an authenticated PayAI lane is later used, add its bearer secret in Railway rather than Git.

### Why 12 confirmations?

This is an explicit MISSING operator policy for the first low-value proof, not a claim of Ethereum L1 batch finality. Base documents sealed L2 blocks at roughly 2 seconds, L1 batch inclusion at roughly 2 minutes, and L1 batch finality at roughly 20 minutes. MISSING also keeps the post-settlement reorg monitor enabled after settlement.

A stronger policy can be chosen later, but do not silently lower the configured confirmation count during a proof run.

## 5. Production preflight

After the runtime redeploys, verify:

```text
GET https://missing-production-e3da.up.railway.app/livez   -> 200
GET https://missing-production-e3da.up.railway.app/readyz  -> 200
GET https://missing-production-e3da.up.railway.app/healthz -> 200
```

`/readyz` must show:

- demand persistence true;
- supply persistence true;
- distributed money ready;
- production admission enabled and ready;
- finality policy ready for `eip155:8453`;
- RPC configured;
- settled-reorg monitor enabled, running, and healthy;
- provider discovery/compiler/orchestrator enabled;
- control plane enabled.

Do not send a mainnet payment while `/readyz` is 503.

## 6. Generate real external-agent demand

The demand that starts the proof must arrive through MISSING's real MCP or A2A interface, not by editing a ledger file and not from the CI fixture.

Use a capability that is not already in the registry. A valid unresolved request must create a durable demand event with source `mcp` or `a2a` before any new recipe is promoted.

Then let the trusted worker run. Its JSON result exposes `recipe_fingerprint` when a candidate is successfully promoted.

If the result is `no_candidates`, `needs_provider_setup`, `needs_evidence`, or `needs_safe_verification`, that is real market/supply evidence. Do not manufacture a promotion merely to satisfy RAL1; choose the next organically unresolved capability or resolve the stated provider blocker.

## 7. Configure economics only after promotion

Once a recipe is promoted, take the exact `recipe_fingerprint` returned by the worker and configure its economics on the runtime.

For the first proof, use a provider whose API has no per-call charge. Only if provider cost is genuinely known to be zero, configure:

```text
MISSING_ECONOMICS_ENFORCEMENT_ENABLED=1
MISSING_MIN_MARGIN_MICROUSD=1
MISSING_ECONOMICS_JSON={"recipes":{"<PROMOTED_FINGERPRINT>":{"provider_cost_microusd":0,"customer_price_microusd":10000}}}
```

`10000` microusd/USDC atomic units is USD 0.01 for six-decimal USDC.

Do **not** enter provider cost `0` merely because the cost is unknown. If the provider charges per call, enter the real incremental provider cost. RAL1 measures realized gross margin against provider cost; it is not a claim of total company net profit after Railway/RPC/other overhead.

Redeploy and require `/readyz` to return 200 again.

## 8. Two distinct mainnet paid resolutions

Fund a payer wallet with a very small amount of native Base USDC plus whatever the payer client requires. Keep private keys outside ChatGPT, GitHub, Railway logs, and repository files.

Send two valid x402 requests to:

```text
POST https://missing-production-e3da.up.railway.app/v1/agent/resolve
```

Both must use the promoted capability but **different request inputs**. RAL1 requires distinct request hashes, payment hashes, execution IDs, and settlement transaction references. A retry/replay of the same signed request does not count as reuse.

Each successful row must ultimately be `settled` in shared PostgreSQL, use the same promoted recipe fingerprint, be on `eip155:8453`, and have positive realized gross margin.

## 9. Run the production-only proof

Use the Railway **Shell on the public runtime service** so the process sees both the mounted `/data` volume and the runtime's PostgreSQL environment.

Run:

```bash
MISSING_REAL_AGENT_LOOP_LIVE_PROOF=1 \
MISSING_REAL_AGENT_LOOP_VALUE_NETWORKS=eip155:8453 \
node dist/src/realAgentLoop1Live.js
```

The verifier intentionally refuses CI and non-production environments.

Possible final outcomes:

```text
GO_REAL_AGENT_PAID_CLOSED_LOOP
NO_GO_REAL_AGENT_PAID_CLOSED_LOOP
```

Only `GO_REAL_AGENT_PAID_CLOSED_LOOP` from this production path closes RAL1 commercially.

## 10. Evidence that must be retained

For the first GO, retain the verifier JSON plus the two on-chain transaction references and the promoted recipe fingerprint. Never retain payer private keys or bearer/control secrets in the artifact.

A green GitHub PR, a testnet transfer, a synthetic fixture, or two retries of the same payment are explicitly insufficient.
