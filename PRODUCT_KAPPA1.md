# Product Kappa.1 — Transactional Charging Boundary

Kappa.1 turns Kappa metering into an idempotent charge state machine without binding the runtime to a payment processor.

## State machine

`reserved -> committed | voided`

A successful provider resolution commits exactly one economic event for an idempotency key. A failed resolution voids the transaction and records no revenue.

## Safety

- disabled by default; enable with `MISSING_TRANSACTIONAL_CHARGING_ENABLED=1`;
- idempotency keys are SHA-256 hashed before persistence;
- charge ledger stores no user input, output, prompt, or provider URL;
- retries of a committed key do not execute the provider again and do not meter revenue again;
- retries of a voided key do not silently re-charge; callers must use a new key;
- charged execution requires explicit provider economics;
- all eligible failover providers must share one customer price, otherwise quoting returns `pricing_conflict`;
- money remains integer micro-USD;
- provider execution still uses AgentRank, Kappa economics policy, failover, and circuit breakers.

## MCP tools

- `missing_charge_quote`
- `resolve_capability_charged`
- `missing_charging_snapshot`

## Persistence

Default charge ledger lives next to the economics ledger as `charges.jsonl`. Override with `MISSING_CHARGING_LEDGER`.

## Stripe boundary

Kappa.1 deliberately does not call Stripe yet. The next adapter can map:

- `reserved` -> authorization / payment intent hold;
- `committed` -> capture or wallet debit;
- `voided` -> cancel/release authorization.

This keeps provider execution independent from Stripe and allows another payment rail later.

## Known v1 boundary

The append-only ledger plus process-local in-flight lock prevents duplicate execution on one runtime instance and across completed retries after restart. It is not yet a distributed compare-and-swap store for multiple active replicas. A production Stripe adapter should pair this contract with a transactional store or Stripe idempotency guarantees before horizontal multi-replica charging.
