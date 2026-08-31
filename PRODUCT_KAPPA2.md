# Product Kappa.2 — Prepaid Credits

Kappa.2 adds internal prepaid service credits to MISSING. These credits are intended only to pay for MISSING capability executions; they are not a general-purpose transferable wallet.

## Accounting boundary

A top-up is not MISSING revenue.

Example:

- customer funds 25 USD -> prepaid liability / service credit balance increases by 25 USD;
- customer executes a capability priced at 0.005 USD;
- on successful commit, prepaid balance decreases by 0.005 USD;
- MISSING recognizes 0.005 USD customer revenue;
- if the selected provider costs 0.001 USD, provider cost is 0.001 USD;
- MISSING gross profit for that committed execution is 0.004 USD before infrastructure, payment fees, taxes, refunds, and other operating costs.

All internal values use integer micro-USD. `1 USD = 1,000,000 micro-USD`.

## State flow

```text
funding adapter (later Stripe)
  -> credit(account, amount)
  -> available prepaid credits
  -> Kappa quote
  -> reserve(customer_price)
  -> provider execution
     -> success: commit credits + commit charge + recognize revenue/cost/gross margin
     -> failure: release credits + void charge + recognize no revenue
```

## Safety and idempotency

- funding references are SHA-256 hashed before persistence;
- repeated funding with the same account + external reference cannot double-credit;
- charge idempotency remains owned by Kappa.1;
- insufficient credits stop execution before any provider network request;
- provider failure releases the reserved credits;
- successful retry with an already committed idempotency key does not execute or charge twice;
- credit ledgers contain no user input, output, prompt, or provider URL.

## Environment

- `MISSING_PREPAID_CREDITS_ENABLED=1` enables prepaid credits;
- `MISSING_PREPAID_CREDIT_LEDGER` optionally overrides the ledger path;
- `MISSING_MANUAL_CREDIT_ENABLED=1` enables the administrative/bootstrap MCP credit tool and should not be enabled on an anonymous public runtime.

By default the credit ledger is colocated with the economics ledger as `credits.jsonl`.

## MCP surface

- `missing_prepaid_credits` inspects balances;
- `missing_credit_account` is a controlled bootstrap/admin funding operation and is disabled by default;
- `resolve_capability_charged` accepts `account_id` and consumes prepaid credits when enabled;
- Kappa.1 tools `missing_charge_quote` and `missing_charging_snapshot` are registered in the product MCP surface.

## Stripe boundary

Stripe should fund prepaid credits in a later adapter milestone. A verified, idempotent Stripe webhook will translate a successful top-up payment into exactly one `credit` event. Stripe should not be called for each micro-execution.
