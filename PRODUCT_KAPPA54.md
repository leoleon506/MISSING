# Product Kappa.5.4 — Exact On-Chain Settlement Proof

Kappa.5.4 hardens distributed x402 settlement so a successful transaction receipt is not sufficient evidence of payment.

## Security invariant

A distributed payment may transition from `settling` to `settled` only after MISSING proves all of the following from the configured EVM RPC:

1. the RPC chain ID matches the x402 `eip155:<chainId>` network;
2. the transaction receipt succeeded;
3. the expected ERC-20 contract emitted a standard `Transfer(address,address,uint256)` event;
4. the indexed recipient equals the configured x402 `payTo` address;
5. the transferred raw token amount equals the x402 `amount` exactly.

Receipt `status == 1` without the exact transfer is deliberately insufficient.

## Fresh distributed settlement

After the facilitator reports a successful settlement transaction, MISSING queries the RPC before committing PostgreSQL state.

- exact proof: continue to `settled`;
- pending/unavailable evidence: persist the transaction reference in `settling` and return reconciliation-required;
- wrong network, reverted transaction, missing Transfer, wrong asset, wrong recipient, or wrong amount: fail closed and transition the payment to `failed`.

The SQLite transactional path and the non-transactional in-memory guard are intentionally unchanged in this milestone.

## Reconciliation

A retry of a distributed `settling` payment with a transaction reference now uses the same exact settlement proof. It no longer upgrades the row based solely on `eth_getTransactionReceipt.status`.

## ERC-20 proof

The proof matches the canonical ERC-20 Transfer topic:

`0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef`

The token contract is read from `log.address`, the recipient from indexed topic 2, and the raw amount from the 32-byte event data word.

## Fail-closed behavior

The proof distinguishes:

- `verified`
- `failed`
- `pending`
- `unavailable`

RPC outages and pending receipts never become successful payments. Semantic mismatches become explicit proof failures.

## Tests

`tests/productKappa54OnchainSettlementProof.test.ts` covers:

- exact successful transfer;
- network mismatch;
- asset mismatch;
- recipient mismatch;
- amount mismatch;
- successful receipt with no ERC-20 Transfer;
- reverted transaction;
- pending receipt;
- missing RPC configuration.

## Boundaries

Kappa.5.4 does not change pricing, provider economics, AgentRank, request binding, provider selection, or the Kappa.5.3 PostgreSQL reservation invariant.

It validates the exact transfer requested by x402. It does not yet add confirmation-depth/finality thresholds, reorg monitoring, multi-transfer aggregation, token-decimal discovery, or chain-specific finality policies. Those are separate hardening concerns.

## Decision

The final decision is `GO_EXACT_ONCHAIN_SETTLEMENT_PROOF` only if the full repository tests/build and the dedicated Kappa.5.4 proof tests are green.
