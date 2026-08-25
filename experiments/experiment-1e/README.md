# MISSING — Experiment 1E: Synthetic Capability Market Spread

## Question

Does public x402 supply show enough price dispersion inside narrowly searched capability families to justify a deeper experiment on stable synthetic capabilities and procurement arbitrage?

Experiment 1E is a **market-spread discovery filter**, not proof of arbitrage profitability.

## Important limitation

Search results returned for the same query are only candidate substitutes. `min_price_usd` is a service-level minimum and may not be the exact price of the matched endpoint. Therefore a GO from 1E does **not** establish functional equivalence, resale rights, exact executable spread, buyer willingness to pay, or realized profit.

Those must be tested in Experiment 1F before any real-money arbitrage.

## Frozen method

1. Query the public x402 List service API using the preregistered narrow capability queries in `config.json`.
2. Keep only services that are online/payment-ready and expose a positive `min_price_usd`.
3. Deduplicate services inside each query family.
4. Sort paid candidates by price.
5. For each family calculate:
   - candidate count
   - cheapest price
   - second-cheapest price
   - median price
   - maximum price
   - second-cheapest / cheapest ratio
   - second-cheapest minus cheapest absolute spread
6. A family is a `spread_candidate` only when it has at least the configured number of paid candidates and both the ratio and absolute-spread thresholds are met.
7. Persist raw search evidence and the calculated family table.

## Preregistered decision

`GO_SYNTHETIC_CAPABILITY_SPREAD` requires:

- at least `min_qualifying_families` spread candidates;
- every qualifying family has at least `min_paid_candidates_per_family` candidates;
- raw evidence is persisted.

Otherwise: `NO_GO_SYNTHETIC_CAPABILITY_SPREAD`.

## What a GO authorizes

Only Experiment 1F:

- inspect exact endpoint-level schemas/prices for candidate providers;
- establish true functional substitutability;
- validate canonical input/output adapters;
- check provider terms/resale/cache rights;
- calculate an executable buy price and a defensible sell price;
- perform, at most, tiny testnet/real-money executions after explicit economic gates.

No real-money trading or provider resale occurs in 1E.
