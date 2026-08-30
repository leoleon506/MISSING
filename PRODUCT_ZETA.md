# Product Zeta — Persistent Demand Intelligence

Product Zeta turns unresolved agent requests into durable product intelligence.

## Product flow

`unknown agent intent -> durable demand event -> aggregated demand snapshot -> ranked capability opportunity`

## What changed

- Unknown capability demand is appended to a JSONL ledger.
- The in-memory demand index reconstructs itself from the ledger after restart.
- Demand observations retain:
  - normalized intent;
  - optional proposed capability identifier;
  - observation count;
  - first and last seen timestamps;
  - source counts such as `mcp` and `a2a`;
  - up to five representative raw examples.
- `missing_demand_snapshot` now returns both detailed demand rows and an aggregate summary.
- A2A and MCP demand are tagged separately.
- `/healthz` reports whether demand persistence is enabled without exposing the ledger path.

## Storage

By default, a non-test product runtime writes to:

`.missing/demand.jsonl`

Override it with:

```bash
MISSING_DEMAND_LEDGER=/var/lib/missing/demand.jsonl npm run missing:serve
```

The ledger is append-only JSONL. Each line is one immutable observation event. Aggregate state is derived from those events, which keeps the raw demand history auditable and makes a later migration to SQLite/Postgres/object storage straightforward.

During automated tests persistence is disabled unless a test explicitly configures a temporary ledger.

## Why JSONL first

Zeta deliberately avoids adding a database dependency. The immediate requirement is durable, inspectable evidence of demand rather than multi-node transactional storage. A later deployment milestone can move this interface behind a durable shared database without changing the MCP or A2A product contracts.

## Deliberate exclusions

Product Zeta does not add:

- automatic provider acquisition;
- billing or accounts;
- external analytics vendors;
- multi-node locking/coordination;
- retention policies;
- PII enrichment;
- public deployment.

## Scientific isolation

The Product Zeta ledger is product telemetry only. Historical experiments, preregistrations, frozen workloads, holdouts, evidence bundles, and prior experiment decisions remain unchanged.
