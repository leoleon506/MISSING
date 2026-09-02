# Product Kappa.5.13 — Owned Known-Tx Reconciliation

## Problem

A distributed x402 payment can crash after the facilitator has returned a transaction and after that `transaction_reference` has been durably persisted, but before the Kappa.5.4/Kappa.5.5 on-chain proof commits the payment as settled.

Before Kappa.5.13, `priorDistributedResult()` special-cased `settling + transaction_reference` and could invoke on-chain reconciliation before the retrying process had verified x402 and acquired the current recovery lease/fence. The reconciliation then attempted fenced database mutations without a process-local ownership session. Under strict Kappa.5.10/Kappa.5.11 fencing this could fail closed and leave the payment stuck in `settling`.

## Invariant

A durable known settlement transaction may be reconciled only after:

1. request binding matches;
2. x402 verification succeeds;
3. the retrying process acquires the current recovery lease/fence;
4. the existing durable `transaction_reference` is proven by the Kappa.5.4/Kappa.5.5 exact on-chain proof;
5. the authoritative transition to `settled` or `failed` is written using that owned lease.

No provider call and no facilitator `/settle` call is allowed merely because a durable transaction is already known.

## Production change

- `priorDistributedResult()` now returns `null` for all active distributed states, including `settling` with a known transaction.
- Known-transaction reconciliation runs only from `resumeDistributedPayment()` after `claimDistributedRecovery()` succeeds.
- `reconcileKnownDistributedSettlement()` requires the owned `leaseToken` and passes it to `settleDistributedPayment()` / `failDistributedPayment()`.
- A new test-only crash point, `after_settlement_transaction_persisted`, is located after the transaction is durably written and before the first chain RPC.

## Proof

`src/experimentKappa513.ts` uses:

- real PostgreSQL;
- the real `handleAgentPaidResolution()` path in independent Node processes;
- a verified idempotent POST provider;
- an explicitly idempotent x402 facilitator;
- deterministic JSON-RPC satisfying Kappa.5.4/Kappa.5.5 exact settlement/finality proof.

The first owner is killed after the transaction is persisted and before any chain RPC. The proof then requires:

- durable state remains `settling`, transaction present, fence 1;
- zero chain RPC calls before owned recovery;
- a retry while the dead owner's lease is still live is blocked and cannot reconcile;
- after expiry, another process takes fence 2;
- the second process performs only chain reconciliation of the durable transaction;
- provider calls/effects remain exactly 1;
- facilitator settlement calls/effects remain exactly 1;
- the final authoritative state is `settled` with the same transaction.

Formal decision:

`GO_OWNED_KNOWN_TX_RECONCILIATION`

## Boundary

Kappa.5.13 proves ownership of restart reconciliation for a transaction reference that is already durably known. It does not add a long-lived watcher for transactions that remain pending indefinitely, nor does it change Kappa.5.5 finality policy or deep-reorg monitoring.
