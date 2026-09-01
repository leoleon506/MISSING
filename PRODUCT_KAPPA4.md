# Product Kappa.4 — Autonomous Payment Production Hardening

Kappa.4 hardens the Kappa.3 x402 path before any mainnet/real-money experiment.

## What this milestone closes

### Durable payment-use guard

After facilitator verification and before any provider execution, MISSING hashes the x402 payment signature and persists a payment guard event:

`verified payment -> reserved -> settled | failed`

The raw payment signature is never persisted.

A previously reserved, failed, or settled payment hash cannot execute a provider again. This moves replay protection in front of the provider network boundary instead of relying only on a final settlement record.

### Provider-attempt cost accounting

Every routing attempt is now metered separately with:

- execution ID;
- capability;
- provider;
- recipe fingerprint;
- source (`routing` or `exploration`);
- success/failure outcome;
- configured provider cost or `null` when unknown;
- customer-billable flag.

Shadow AgentRank exploration is recorded as a separate operational cost source and is never attached to customer revenue.

### Realized x402 gross margin

A settled x402 execution computes COGS from all routing attempts for the execution, not only the winning provider.

Example:

- customer revenue: 5000 micro-USD;
- provider A fails and costs 1000;
- provider B succeeds and costs 3000;
- realized routing COGS: 4000;
- realized gross margin: 1000.

If any routing attempt has unknown economics, realized provider cost and realized gross margin remain `null`. Unknown is never converted to zero.

## Persistence

Defaults, when the economics ledger is under `/data`:

- `/data/x402.jsonl` — settled x402 accounting;
- `/data/x402-payment-guard.jsonl` — payment-use state;
- `/data/provider-costs.jsonl` — provider attempt costs.

Overrides:

- `MISSING_X402_PAYMENT_GUARD_LEDGER`
- `MISSING_PROVIDER_COST_LEDGER`

## Failure semantics

- verification failure: no reservation, no provider call;
- provider failure after verified payment: guard becomes `failed`, payment is not settled;
- settlement failure/unavailable: guard becomes `failed` and the same payment signature cannot be reused automatically;
- successful settlement: settlement accounting is recorded and guard becomes `settled`;
- duplicate payment signature after a prior use returns HTTP 409 and does not call a provider again.

A settlement transport failure can be ambiguous: the facilitator may have accepted a settlement even if the response was lost. Kappa.4 therefore fails closed and refuses to reuse the same payment authorization. Reconciliation is a future transactional-backend concern.

## Important remaining boundary

JSONL append/replay plus process-local locking is **not** a distributed atomic money store.

Kappa.4 is suitable for the current single-instance testnet deployment, but it does not authorize multi-replica or mainnet money operation. Before real-money production, the payment guard and financial ledgers must move to a transactional database with unique constraints / compare-and-swap semantics so two replicas cannot reserve the same payment concurrently.

## Production gate before mainnet

Do not enable real-money mainnet settlement until all of the following are true:

1. transactional payment reservation with a unique payment-hash constraint;
2. atomic settlement/accounting transaction;
3. durable settlement reconciliation for ambiguous facilitator responses;
4. provider-attempt COGS persisted transactionally;
5. spend/price limits and operational alerts;
6. explicit mainnet facilitator and asset verification.
