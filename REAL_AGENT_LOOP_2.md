# Real Agent Loop 2 — Autonomous Commercial Replication

Base release: `edc7c194dc079fe5003d38aaea1633cec6959e74` (merged post-RAL1 RPC identity and telemetry hardening).

RAL1 emitted `GO_REAL_AGENT_PAID_CLOSED_LOOP` from production after one external demand produced one promoted recipe that was reused by two distinct settled x402 requests with positive realized margin.

RAL2 changes the question from **can the loop happen once?** to **can the product reproduce the loop autonomously across independent capabilities?**

## Business hypothesis

Independent external-agent demands should be able to enter MISSING, be selected by the trusted acquisition control plane, become replay-verified supply without manual candidate injection or manual promotion, and then generate positive-margin paid reuse.

The target loop is repeated at least twice:

```text
external MCP/A2A demand A              external MCP/A2A demand B
          ↓                                      ↓
durable unresolved demand              durable unresolved demand
          ↓                                      ↓
trusted control-plane cycle             trusted control-plane cycle
          ↓                                      ↓
discover → compile → replay verify      discover → compile → replay verify
          ↓                                      ↓
autonomous promotion A                  autonomous promotion B
          ↓                                      ↓
2 distinct settled paid requests        2 distinct settled paid requests
          ↓                                      ↓
positive realized margin                positive realized margin
```

The two loops must use different capabilities and different promoted recipe fingerprints.

## Preregistered evidence boundary

RAL2 counts only evidence created **after this milestone is deployed**. Historical RAL1 evidence may remain in the ledgers but cannot satisfy RAL2.

A qualifying promotion must contain durable provenance showing that it was emitted from an authenticated trusted control-plane acquisition cycle:

```json
{
  "origin": {
    "demand_intent": "...",
    "normalized_intent": "...",
    "acquisition_path": "trusted_control_plane",
    "control_plane_run_id": "..."
  }
}
```

This proves the product path used for acquisition. It does not attempt to prove the philosophical absence of every human action; rather, it excludes direct/manual candidate injection and direct/manual promotion from the qualifying evidence.

## Exact GO contract

`GO_AUTONOMOUS_COMMERCIAL_REPLICATION` requires **two independent qualifying loops**. For each loop all conditions below must be true:

1. at least one durable demand event arrived through external `mcp` or `a2a` after the RAL2 boundary and before promotion;
2. the promotion names the same normalized demand as its origin;
3. the promotion origin has `acquisition_path = trusted_control_plane` and a non-empty `control_plane_run_id`;
4. exactly one promotion exists for the qualifying recipe fingerprint;
5. the recipe verification source is `product_live` and contains at least two replay verification inputs;
6. at least two later PostgreSQL payment rows are `settled` for the same capability and recipe fingerprint;
7. the two payment rows have different non-null request hashes, payment hashes, execution IDs, and transaction references;
8. each settlement is on an approved value-bearing network;
9. each payment has internally consistent positive realized gross margin;
10. both paid resolutions occurred after that promotion.

Across the two qualifying loops:

- capabilities must differ;
- recipe fingerprints must differ;
- normalized demand intents must differ;
- control-plane run IDs must differ.

No single capability, recipe, demand, promotion, payment, or settlement may satisfy both loops.

## Why two loops

One successful loop can be an accident, a provider-specific edge case, or hidden operator assistance. Two independent capabilities do not prove infinite scalability, but they materially test whether MISSING is a repeatable product rather than a one-off integration.

RAL2 deliberately does **not** require a third billing rail, UI/dashboard, accounts, multi-region infrastructure, additional circuit breakers, or new provider classes. Those are not the current uncertainty.

## CI boundary

CI may test the verifier and provenance logic using deterministic synthetic evidence, but its strongest allowed result is:

`READY_AUTONOMOUS_COMMERCIAL_REPLICATION_PROOF`

CI must never emit the live commercial GO.

Only production demand/supply ledgers plus real settled PostgreSQL rows on approved value networks may emit:

`GO_AUTONOMOUS_COMMERCIAL_REPLICATION`

## Failure is useful

RAL2 is a falsification milestone. If two independent external demands cannot autonomously become paid reusable supply, the failure stage must be reported rather than bypassed manually:

- discovery failure;
- compilation failure;
- verification-input/evidence failure;
- provider setup requirement;
- replay rejection;
- promotion failure;
- no paid reuse;
- non-positive economics;
- payment/settlement failure.

A manual workaround may be useful operationally, but any loop that needs one is excluded from the RAL2 GO evidence.
