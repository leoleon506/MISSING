# Operational Readiness 1 — Load & Concurrency Baseline

This milestone begins the post-Kappa operational-readiness phase. It does not introduce a new payment/recovery security protocol. It measures whether the hardened PostgreSQL reservation primitive preserves its safety invariant under multi-process contention while producing reproducible latency and throughput evidence.

## Invariant

Under concurrent independent Node.js processes sharing one PostgreSQL database, every `payment_hash` admits exactly one successful reservation owner, including a deliberately contended hot key. Database state must contain exactly one row per unique payment hash and no duplicate external owner may emerge from the reservation layer.

## Workload

The CI baseline launches 8 independent worker processes. After sequential initialization, all workers wait on a barrier and are released simultaneously. The default workload is:

- 200 ordinary payment hashes;
- 4 contenders per ordinary key;
- 200 contenders on one hot key;
- 1,000 total reservation attempts;
- native `pg.Pool`, max 8 connections per worker;
- PostgreSQL 16;
- response cache disabled.

Workers execute the production `reserveDistributedPayment()` path. The orchestrator independently verifies PostgreSQL row counts and duplicate payment hashes after the run.

## Evidence

The artifact `artifacts/operational-readiness-1-load-concurrency-baseline.json` records:

- total attempts and unique payment hashes;
- winner count and worker errors;
- database row and distinct-key counts;
- hot-key exclusion;
- wall-clock duration and attempts/second;
- reservation latency p50/p95/p99/max;
- observed per-worker pool totals and waiters;
- all machine-readable assertions.

Formal GO decision: `GO_OPERATIONAL_LOAD_CONCURRENCY_BASELINE`.

## Scope

This is a CI-hosted reproducible baseline, not a production-capacity claim. A GO proves concurrency safety under the defined workload and establishes measurable performance evidence. It does not claim a specific production RPS/SLO until the deployment topology and production-like environment are benchmarked separately.
