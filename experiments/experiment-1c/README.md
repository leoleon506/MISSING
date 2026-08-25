# MISSING — Experiment 1C: Real Supply Independence Graph

## Question

Do apparently distinct agent/API capabilities exhibit correlated real-world availability failures, such that naive multi-provider failover overstates true redundancy?

Experiment 1C uses public x402 List telemetry. It does not use synthetic provider success probabilities.

## Source limitation

x402 List health checks primarily validate that a service exposes the expected x402/payment handshake. They do not prove that a paid execution returns a semantically correct result. Therefore 1C measures **availability/handshake correlation**, not end-to-end answer correctness.

## Frozen method

1. Search the public x402 List service API for the preregistered capability queries in `config.json`.
2. Keep services returned under the same search query as candidate substitutes. This is only a proxy for capability equivalence; the experiment must report this limitation.
3. Fetch up to the configured number of public checks per selected service.
4. Bucket checks by UTC hour. An hourly service state is `down` when at least the configured fraction of checks in that hour failed.
5. Compare service pairs only across hours in which both have observations.
6. For each pair calculate:
   - overlapping hours
   - failure hours for A and B
   - joint failure hours
   - marginal failure rates
   - expected joint failures under independence
   - observed/expected joint-failure multiplier
   - binary phi correlation
7. A pair is `correlated_failure_candidate` only if all preregistered thresholds are met.

## Preregistered evidence gates

`GO_REAL_INDEPENDENCE_GRAPH` requires all of:

- at least 2 capability-query groups contain at least 2 services with sufficient telemetry;
- at least 5 service pairs have >= `min_overlap_hours` comparable hours;
- at least 1 pair has >= `min_failure_hours_per_service` failure hours for both services;
- at least 1 pair qualifies as a correlated-failure candidate using BOTH:
  - phi >= `behavioral_phi_threshold`, and
  - observed joint failures / expected joint failures >= `joint_failure_multiplier_threshold`,
  - with >= `min_joint_failure_hours` observed joint failures;
- raw source metadata and aggregated hourly observations are persisted for audit.

Otherwise: `INSUFFICIENT_REAL_EVIDENCE`.

A GO would not yet prove shared infrastructure causality. It would show that naive independence assumptions are unsafe enough to justify a deeper dependency-fingerprinting experiment using DNS/ASN/TLS/provider metadata and paid execution telemetry.

## Product implication

No product is built from a GO alone. Only after correlation is demonstrated would MISSING test an **independence-aware standby market** where backups are priced and selected based on empirically distinct failure domains rather than merely different provider identities.
