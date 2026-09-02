# Product Kappa.5.5 — Settlement Finality & Reorg Resistance

Kappa.5.5 extends the exact on-chain proof from Kappa.5.4 with confirmation depth and canonical block anchoring.

## Security invariant

A distributed x402 payment may transition from `settling` to `settled` only if all Kappa.5.4 conditions remain true and the transaction is sufficiently final:

1. chain ID matches the configured `eip155:<chainId>` network;
2. the receipt succeeded;
3. the exact ERC-20 Transfer matches asset, recipient and raw amount;
4. the receipt contains a block number and block hash;
5. the transaction has at least `MISSING_X402_MIN_CONFIRMATIONS` confirmations;
6. `eth_getBlockByNumber(receipt.blockNumber)` still returns the same block hash;
7. a second receipt read still places the transaction in the same block with successful status.

Only after all seven checks does the proof return `verified`.

## Confirmation policy

`MISSING_X402_MIN_CONFIRMATIONS` controls the required confirmation depth.

- default: `1`;
- valid values: positive safe integers;
- invalid, zero or negative values fail to the conservative default of `1`.

A transaction below the threshold returns `pending` with `reason=insufficient_confirmations`. It remains in `settling` and is eligible for later reconciliation; provider execution is not repeated.

## Reorg resistance

The proof records and compares the transaction's `blockNumber` and `blockHash` against the current canonical block at that height.

Fail-closed reorg signals include:

- `reorg_block_hash_mismatch` — the canonical block hash changed;
- `reorg_receipt_disappeared` — the transaction receipt disappeared after initially being observed;
- `reorg_receipt_moved` — the receipt moved to a different block/hash during the proof;
- `reorg_receipt_status_changed` — the re-read receipt is no longer successful.

A successful receipt without a valid block anchor never becomes settled.

## Evidence returned by the proof

Successful and finality-related proof results include, where available:

- `chain_id`;
- `block_number`;
- `block_hash`;
- `confirmations`;
- `required_confirmations`;
- `transfer_log_index`.

This evidence is deliberately metadata only; no payment signature or secret is logged.

## Scope

Kappa.5.5 hardens the distributed PostgreSQL x402 path through the common `x402SettlementProof`, so both fresh settlements and later reconciliation use the same finality rule.

It does not change:

- pricing or provider economics;
- AgentRank/provider ranking;
- request binding;
- Kappa.5.3 reservation exclusion;
- the exact ERC-20 semantics from Kappa.5.4;
- SQLite/non-transactional payment semantics;
- the PostgreSQL `psql` subprocess backend.

## Remaining boundaries

This milestone provides confirmation-depth and same-height canonical-block revalidation. It does not implement a long-lived background watcher that reopens already-settled payments after arbitrary deep reorgs, nor chain-specific probabilistic/finalized-tag policies. Those would be separate operational hardening layers.

## Decision

Emit `GO_SETTLEMENT_FINALITY_REORG_RESISTANCE` only when:

- dedicated Kappa.5.5 tests are green;
- Kappa.5.4 regression tests remain green;
- the full repository test suite is green;
- TypeScript build is green.
