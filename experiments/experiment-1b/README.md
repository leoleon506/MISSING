# MISSING — Experiment 1B: Capability Underwriter

## Thesis

Commodity routers choose a provider. MISSING should instead sell a **result contract**: a fixed maximum price and completion SLA for a capability invocation, while MISSING absorbs provider failure risk and performs failover internally.

This experiment is intentionally NOT a registry, marketplace, semantic router, gateway, bounty board, or autonomous capability builder.

## Why this may be defensible

The accumulating asset is the underwriting history: intent, candidate providers, quoted price, realized provider cost, failure correlation, failover path, completion outcome, latency, and contribution margin. The customer buys a guaranteed outcome contract rather than access to a particular provider.

## Experiment

Synthetic provider portfolios are used so failure rates and costs are measurable and reproducible. For each scenario MISSING must either:
- `ACCEPT`: issue a quote <= buyer max price, choose a failover portfolio, and take execution risk; or
- `REJECT`: decline when the requested SLA cannot be insured economically.

Each accepted scenario is simulated for 10,000 calls with a deterministic PRNG. The comparison baseline is the cheapest single provider that satisfies the latency constraint.

## Preregistered GO criteria

`GO_CAPABILITY_UNDERWRITER` requires all of:
- at least 5 scenarios accepted;
- 100% of accepted quotes <= buyer max price;
- at least 95% of accepted scenarios achieve their promised completion SLA in simulation;
- aggregate completion rate improves by >= 5 percentage points versus cheapest-single-provider baseline;
- every accepted scenario has positive realized gross contribution;
- all scenarios explicitly marked `uninsurable=true` are rejected;
- aggregate realized gross margin >= 20%.

Otherwise: `REASSESS_CAPABILITY_UNDERWRITER`.

A GO proves only that risk pooling/failover can create a viable economic product under controlled assumptions. The next experiment must use observed provider telemetry and real execution costs before production claims.
