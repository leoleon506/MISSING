# Product Kappa.5.7 — Crash Consistency & Restart Recovery

Kappa.5.7 proves a narrow money-safety invariant across process death:

> After an authoritative payment reservation exists, a restarted process must never blindly re-run an ambiguously completed provider effect or settlement. Persisted settlement transactions may be reconciled, but only one database transition may win.

## Crash windows

The dedicated experiment kills independent Node processes with `process.exit(...)` at five windows while all processes share the same PostgreSQL 16 database:

1. **after reservation** — payment is durable `reserved`; a restart cannot reserve it again;
2. **after provider effect** — an external append-only probe records one provider effect, then the process dies before `settling`; restart remains blocked and the effect count stays one;
3. **after `settling`, before transaction reference** — restart cannot run the provider again and the ambiguous payment remains `settling` without inventing a transaction;
4. **after settlement transaction persistence** — two restart reconcilers independently prove the same ERC-20 transaction, but PostgreSQL permits only one `settling -> settled` commit;
5. **after authoritative `settled` commit, before client response** — restart cannot reserve the payment or repeat provider work.

The experiment uses the production distributed-money functions, native `pg.Pool`, the production exact ERC-20/finality proof, and a local deterministic JSON-RPC server. It does not weaken Kappa.5.3–5.6 gates.

## External-effect probe

Provider execution is represented by a shared append-only probe outside process memory. Crash workers write the probe only after they have won the production PostgreSQL reservation. The GO gate requires at most one provider-effect record for every scenario where provider work occurs.

## Settlement recovery

When a transaction reference is durably present in `settling`, recovery workers do **not** call a facilitator to create another settlement. They re-check the already persisted transaction with `x402SettlementProof` and then race the existing conditional `settleDistributedPayment` transition. Exactly one worker must report `changed=true`.

## Fail-closed liveness boundary

A `reserved` record after a crash is intentionally **not** auto-replayed. MISSING cannot know whether the external provider performed an irreversible side effect immediately before process death. The safe default is to block/reconcile rather than duplicate the side effect. A future lease/operation-id protocol may improve liveness only if the provider can prove idempotency.

Likewise, a `settling` row without a transaction reference is not guessed or retried. It remains an operator/reconciliation case.

## Kappa.5.3 pool cleanup

Kappa.5.6 introduced a persistent native PostgreSQL pool. The Kappa.5.3 worker now closes that pool after emitting its result so each short-lived replica exits immediately instead of waiting for the pool idle timeout. This is test-harness lifecycle cleanup only; reservation semantics are unchanged.

## GO gate

`GO_CRASH_CONSISTENCY_RESTART_RECOVERY` is emitted only when all five scenarios pass simultaneously:

- no restart wins an already durable payment reservation;
- no provider effect is duplicated;
- ambiguous pre-transaction state remains blocked;
- persisted transaction reconciliation proves the existing transaction;
- two concurrent reconcilers yield exactly one authoritative settlement commit;
- a crash after `settled` cannot cause provider replay.

Any failed condition emits `NO_GO_CRASH_CONSISTENCY_RESTART_RECOVERY` and the workflow exits non-zero.
