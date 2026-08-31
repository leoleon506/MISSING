# Product Kappa — Economics & Metering

Kappa adds explicit provider economics, margin policy, durable resolution metering, and economics-aware routing to the MISSING product runtime.

## Core rule

Missing pricing is **unknown**, never zero.

Kappa will not infer that a provider is free from a public endpoint, documentation omission, or successful execution. Economic routing is enabled only from explicit operator-supplied configuration.

## Money representation

All money uses integer micro-USD:

- `1 USD = 1,000,000 micro-USD`
- `$0.003 = 3000 micro-USD`
- `$0.0005 = 500 micro-USD`

This avoids floating-point accounting errors.

## Configuration

Economics are keyed by immutable recipe fingerprint using `MISSING_ECONOMICS_JSON`:

```json
{
  "recipes": {
    "<recipe_fingerprint>": {
      "provider_cost_microusd": 1000,
      "customer_price_microusd": 3000
    }
  }
}
```

Optional routing enforcement:

```text
MISSING_ECONOMICS_ENFORCEMENT_ENABLED=1
MISSING_MIN_MARGIN_MICROUSD=1000
```

Enforcement is disabled by default.

When enforcement is disabled, existing AgentRank routing remains unchanged and successful resolutions are still metered. If a recipe has no configured economics, its meter event records `null` cost, price, and margin.

When enforcement is enabled:

1. AgentRank produces the quality-based candidate order.
2. Recipes with missing/invalid economics are excluded.
3. Recipes below the configured minimum absolute margin are excluded.
4. Remaining recipes are ordered by explicit absolute margin, with the incoming AgentRank order as stable tie breaker.
5. If no provider remains, MISSING returns `unavailable` before making a network request.

## Durable metering

Every successful user-visible capability resolution appends one event to `economics.jsonl` when persistence is configured. The event contains only:

- timestamp;
- capability;
- provider;
- recipe fingerprint;
- provider cost;
- customer price;
- gross margin.

It does **not** persist user input, output, prompt, or provider URL.

Default path follows the persistent demand directory. On Railway, when demand persistence is under `/data`, the economics ledger is `/data/economics.jsonl`. Override with `MISSING_ECONOMICS_LEDGER`.

Shadow AgentRank exploration is not billed as a customer resolution. When economics enforcement is enabled, exploration is restricted to economically eligible providers so Kappa cannot generate unapproved shadow spend.

## MCP visibility

`missing_economics` reports:

- enforcement state;
- minimum margin;
- persistence availability;
- per-recipe configured/unknown economics;
- eligibility;
- aggregate resolution count;
- priced vs unknown-economics resolutions;
- cumulative provider cost;
- cumulative customer revenue;
- cumulative gross margin.

`/healthz` and `/readyz` report `economics_enforcement_enabled` and `economics_persistence`. Economics persistence is observable but does not itself gate global readiness.

## Explicit non-goals of Kappa v1

Kappa v1 does not:

- charge a credit card, wallet, or agent account;
- reserve balances before execution;
- settle money with providers;
- guarantee exactly-once financial accounting across process crashes;
- infer provider prices from documentation;
- estimate costs when pricing is unknown;
- implement taxes, refunds, credits, invoices, or multi-currency conversion;
- convert AgentRank and margin into one learned utility score.

Those require a transactional billing backend and are intentionally outside this milestone. Kappa v1 establishes the trustworthy economic data plane and routing guardrail first.
