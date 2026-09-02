# Operational Readiness 2 — Observability & SLO Instrumentation

## Goal

Make distributed-money operational risk visible before production deployment.

## Runtime signals

`src/runtime/operationalObservability.ts` exposes:

- PostgreSQL pool total / idle / waiting gauges;
- distributed payment state gauges (`reserved`, `executing`, `provider_done`, `settling`, `settled`, `ambiguous`, `failed`);
- request-bound vs legacy-unbound payment counts;
- settled-reorg monitor enabled/running/error state;
- structured SLO signals with `ok`, `warning`, or `critical` severity;
- Prometheus text exposition.

## Default thresholds

- pool waiting warning: 25
- pool waiting critical: 100
- ambiguous payments critical: 1
- failed payments warning: 1

Thresholds are configurable with:

- `MISSING_SLO_POOL_WAITING_WARNING`
- `MISSING_SLO_POOL_WAITING_CRITICAL`
- `MISSING_SLO_AMBIGUOUS_CRITICAL`
- `MISSING_SLO_FAILED_WARNING`

## Formal proof

The OR2 experiment uses PostgreSQL 16, writes representative distributed-money states into the real payment table, refreshes the production snapshot, then proves:

1. database payment states are visible;
2. ambiguous payments become critical;
3. failed payments become warning;
4. pool saturation becomes critical when the threshold is crossed;
5. a settled-reorg monitor error becomes critical;
6. Prometheus output contains payment, pool, and monitor metrics;
7. the machine-readable aggregate status becomes critical when a critical condition exists.

Formal result:

`GO_OPERATIONAL_OBSERVABILITY_SLO`

This milestone establishes instrumentation and alert semantics. It does not claim production SLO compliance; production SLO targets require deployment-specific traffic and infrastructure measurements.
