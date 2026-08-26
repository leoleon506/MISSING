# Experiment 3Y-R2 — Retrieval and Safety Hardening

## Status

Engineering recovery only. This experiment is not confirmatory evidence because the 3Y cases are already known.

## Purpose

Close the single remaining 3Y-R retrieval gate without provider-specific bonuses, and harden two methodological weaknesses found during review before freezing the implementation for a future blind 3Z.

## Changes under test

1. Generic morphological normalization (`countries -> country`, `breweries -> brewery`, `abilities -> ability`, `currencies -> currency`).
2. Stopword removal and deduplication of repeated query concepts.
3. IDF-weighted bounded retrieval with no provider hostname/name special cases.
4. Public-DNS validation rejecting hostnames that resolve to private, loopback, link-local or other non-public address space.
5. Representative nested YAML OpenAPI fixture rather than only a minimal two-level fixture.
6. Safety gate computed from the append-only event ledger and derived counters; it must not be hard-coded true.

## Frozen interpretation boundary

A `GO_3Y_R2_ENGINEERING_RECOVERY` means only that the known engineering defects exposed by 3Y and 3Y-R have regression coverage and that all three known catalog targets are inside the same bounded retrieval frontier. It does not establish blind end-to-end manufacture.

After a GO, this recovery implementation should be frozen before selecting new 3Z holdouts.

## Gates

All must pass:

- Unicode normalization works.
- Generic morphology works.
- Repeated query concepts are deduplicated.
- REST Countries, PokéAPI and Open Brewery DB are inside the recovered top-120 frontier when present in the catalog.
- Representative YAML OpenAPI parses to a GET operation.
- Private-DNS controls are actively rejected.
- Safety gate is computed from ledger events and derived counters.

Formal strings:

`GO_3Y_R2_ENGINEERING_RECOVERY`

Else:

`REASSESS_3Y_R2_ENGINEERING_RECOVERY`

## Run

```bash
npm test
npm run build
npm run benchmark:3yr2
```

The workflow uploads `results/experiment-3yr2/report.json` as `missing-experiment-3yr2-results`.
