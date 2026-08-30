# Product Theta — Demand-to-Supply Acquisition Engine

Product Theta closes the first half of MISSING's supply-growth loop:

```text
unresolved agent demand
        ↓
ranked supply opportunity
        ↓
provider candidate
        ↓
deterministic recipe compilation
        ↓
repeated live replay + projection gates
        ↓
verified? ── no ──> reject, never register
    │
   yes
    ↓
durable promoted recipe
        ↓
executable through the existing MISSING runtime
```

## Why this milestone exists

Before Theta, MISSING could discover and execute known verified capabilities and durably record what agents still needed. It could not turn that demand into new executable supply without a code change.

Theta introduces a product-safe acquisition path without weakening the core trust boundary: **MISSING still returns unavailable rather than inventing an integration.** A provider candidate has no runtime authority until every verification gate passes.

## What ships

### 1. Ranked supply opportunities

`rankSupplyOpportunities()` converts the durable Zeta demand ledger into a prioritized queue using repeated observations, source diversity, and recency. Existing verified capabilities are excluded when the recorded demand already names one.

MCP tool:

- `missing_supply_opportunities`

### 2. Deterministic candidate compilation

A supply candidate declares:

- the demand intent it addresses;
- proposed capability and family;
- provider and evidence URL;
- GET base URL/path/bindings;
- deterministic output projection;
- required output fields;
- at least two independent verification inputs.

Theta canonicalizes the recipe-defining fields and generates a SHA-256 recipe fingerprint. Reordering object keys does not change the fingerprint.

### 3. Repeated live replay verification

Every verification input is executed through the same recipe attempt primitive used by the product runtime. All runs must:

- reach the provider successfully;
- return JSON;
- satisfy the declared projection;
- contain every required output.

Any failed run rejects the candidate immediately. A rejected candidate is never inserted into `VERIFIED_RECIPES`.

MCP tool:

- `verify_supply_candidate`

This tool verifies only; it does not promote.

### 4. Verify-and-promote acquisition

`acquireVerifiedSupplyCandidate()` runs the complete gate sequence and promotes the candidate only after all live replays succeed.

MCP tool:

- `acquire_verified_supply_candidate`

Promotion uses `verification.source = "product_live"`; it does not rewrite or impersonate frozen experimental evidence.

### 5. Durable supply ledger

Successful promoted recipes are appended to a separate JSONL supply ledger and rehydrated into the product registry on restart.

Configuration:

- `MISSING_SUPPLY_LEDGER` explicitly selects the ledger path.
- When it is absent but `MISSING_DEMAND_LEDGER` is configured, Theta automatically uses `supply.jsonl` in the same directory.
- On Railway today that means `/data/supply.jsonl`, sharing the already-mounted persistent `/data` volume without changing the frozen experiment tree.

`/healthz` and `/readyz` expose `supply_persistence`.

## Security and trust gates

Product Theta intentionally supports only GET candidates in this milestone. Public candidate and evidence URLs must use HTTPS. Plain HTTP is accepted only for localhost/loopback test fixtures.

A minimum of two verification inputs is mandatory. This prevents a single lucky response from becoming executable supply.

Duplicate recipe fingerprints are not registered twice.

## Scientific boundary

Theta does **not** modify files under `experiments/**`, does not rerun frozen experiments as production code, and does not claim experimental provenance for newly acquired providers.

The 5B14/5B15 work established the product principle of deterministic compilation and replay verification. Theta implements that principle as an independent production subsystem.

## Deliberate boundary of Theta

Provider *candidate discovery* is a pluggable upstream stage. This milestone does not blindly crawl the web and trust whatever it finds. Search/catalog/documentation adapters can propose candidates to the acquisition engine, but the verification and promotion gates remain mandatory regardless of where a candidate came from.

That separation is intentional: discovery may become broad and probabilistic; promotion remains deterministic and evidence-gated.

## Acceptance criteria

Product Theta is complete when CI proves that:

1. repeated unresolved demand ranks above one-off demand;
2. recipe fingerprints are deterministic;
3. fewer than two replay inputs cannot be verified;
4. a provider failure rejects the candidate and leaves the registry unchanged;
5. a candidate that passes every replay becomes executable through `resolveCapability()`;
6. a promoted recipe survives registry reset by rehydrating from the durable supply ledger;
7. existing Alpha–Eta behavior remains green.
