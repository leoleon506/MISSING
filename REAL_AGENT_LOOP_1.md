# Real Agent Loop 1 — Paid Closed Loop

Base release: `14dbbf0ee8c8dcf7b64d1eae42b79db6d8d80cde` (merged Operational Readiness 9).

Operational Readiness stops at OR9. This milestone changes the optimization target from finding additional hypothetical infrastructure failures to proving that the MISSING product loop creates reusable paid supply from real external-agent demand.

## Business hypothesis

A capability first requested by an external agent should be able to become verified MISSING supply and then generate repeated positive-margin paid resolutions without another code change or another promotion.

The target loop is:

```text
external MCP/A2A agent
        ↓
unresolved demand recorded durably
        ↓
trusted acquisition worker
        ↓
verified recipe promoted durably
        ↓
first distinct x402 paid resolution
        ↓
second distinct x402 paid resolution with different request input
        ↓
same promoted recipe + positive realized margin on both
```

## Causal evidence added by RAL1

MISSING already persisted the necessary endpoints of the loop, but the supply ledger did not retain the causal link to the demand that caused an automatic acquisition.

RAL1 adds an optional `origin` to new supply-ledger promotion events:

```json
{
  "origin": {
    "demand_intent": "...",
    "normalized_intent": "..."
  }
}
```

Historical supply events remain valid and load exactly as before. They simply cannot satisfy the new closed-loop proof because their causal origin was not recorded.

The financial authority already stores the other required evidence in shared PostgreSQL: payment hash, request hash, execution ID, capability, settlement transaction, provider recipe fingerprint, customer price, provider cost, and realized gross margin.

## Exact GO contract

`GO_REAL_AGENT_PAID_CLOSED_LOOP` requires one promoted recipe for which every condition below is true:

1. at least one durable demand event arrived through external `a2a` or `mcp` before promotion;
2. the promotion explicitly names that normalized demand as its origin;
3. exactly one promotion event exists for the recipe fingerprint;
4. at least two later payment rows are `settled` for the same capability and the same promoted recipe fingerprint;
5. the two rows have different non-null request hashes, proving different bound requests rather than response retry;
6. they have different payment hashes, execution IDs, and settlement transaction references;
7. both rows have internally consistent positive realized gross margin;
8. both paid resolutions occurred after the promotion.

This proves reuse: one demand-derived promotion produces at least two distinct paid executions.

## CI is not allowed to claim commercial GO

GitHub Actions runs `src/realAgentLoop1Readiness.ts` against deterministic synthetic evidence. Its strongest possible result is:

`READY_REAL_AGENT_PAID_CLOSED_LOOP_PROOF`

The artifact explicitly carries:

- `proof_boundary: synthetic_ci_readiness_only`
- `live_go_allowed: false`

The workflow also fails if its result is ever `GO_REAL_AGENT_PAID_CLOSED_LOOP`.

## Live verifier

The live verifier is `src/realAgentLoop1Live.ts`. It reads the actual durable demand and supply ledgers plus settled rows from the shared PostgreSQL money authority.

It refuses to run when `CI=true` or `GITHUB_ACTIONS=true`. It also requires:

```text
NODE_ENV=production
MISSING_REAL_AGENT_LOOP_LIVE_PROOF=1
MISSING_DISTRIBUTED_MONEY_ENABLED=1
MISSING_POSTGRES_URL=<production PostgreSQL URL>
```

Run it only against the real deployment:

```bash
npx tsx src/realAgentLoop1Live.ts
```

Only that production evidence path may emit:

`GO_REAL_AGENT_PAID_CLOSED_LOOP`

Until it does, the business loop is **not proven**, regardless of how many CI workflows are green.

## What this milestone deliberately does not do

RAL1 does not add another billing rail, another acquisition algorithm, another circuit breaker, a dashboard, accounts, multi-region deployment, WAF/DDoS infrastructure, or distributed rate limiting.

Those may become justified by real traffic. The current priority is to create and measure the first repeatable paid closed loop with the product already built.
