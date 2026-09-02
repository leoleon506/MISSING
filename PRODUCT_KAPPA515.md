# Product Kappa.5.15 — Post-Settlement Deep Reorg Monitoring

## Gap

Kappa.5.5 proves canonicality and confirmation depth immediately before a distributed payment is committed as `settled`. That protects the settlement decision at commit time, but a sufficiently deep later reorganization can still invalidate a transaction that was previously accepted.

Without a long-lived monitor, a row can remain `settled` forever even after its receipt disappears, moves off the canonical chain, reverts, or ceases to contain the exact ERC20 transfer.

## Production invariant

A distributed x402 payment that remains `settled` must continue to prove the same economic condition on-chain:

- expected EIP-155 network;
- successful receipt;
- sufficient confirmation depth;
- canonical receipt block;
- stable receipt across the proof;
- exact ERC20 asset;
- exact recipient;
- exact raw amount.

The production HTTP server can start a recurring watcher with:

```text
MISSING_X402_SETTLED_REORG_MONITOR_ENABLED=1
```

Optional controls:

```text
MISSING_X402_SETTLED_REORG_MONITOR_INTERVAL_MS=60000
MISSING_X402_SETTLED_REORG_MONITOR_BATCH_SIZE=100
```

The monitor uses the same `x402SettlementProof()` as the settlement path and persists every audit in `missing_x402_settlement_audits`.

If a previously settled transaction returns `failed` or `pending`, the payment is atomically quarantined as `ambiguous` with a `post_settlement_proof_*` reason. The monitor never replays the provider or facilitator settlement operation.

An `unavailable` proof is treated differently: RPC infrastructure failure is not chain evidence, so the payment remains `settled`, the outage is recorded, and a later cycle retries it.

## Proof

`src/experimentKappa515.ts` runs against PostgreSQL 16 and deterministic JSON-RPC behavior for four settled transactions:

1. healthy canonical settlement remains `settled`;
2. previously settled receipt disappears and is quarantined;
3. previously settled receipt block no longer matches the canonical block and is quarantined;
4. RPC outage is durably recorded but does not falsely quarantine the settlement.

The proof also asserts zero provider calls and zero facilitator settlement calls during monitoring.

Formal decision:

```text
GO_POST_SETTLEMENT_DEEP_REORG_MONITORING
```

## Boundary

This milestone detects and quarantines post-settlement invalidation. It does not attempt to reverse an already delivered provider-side effect or automatically reimburse the payer/provider. Those are business-level remediation policies.

Kappa.5.16 remains the final planned hardening milestone for strict fail-closed confirmation configuration and chain-specific finality policy.
