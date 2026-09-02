# Product Kappa.5.14 — Durable Recovery Protocol Versioning

## Security gap

Rows created by older distributed-payment runtimes can have state semantics that differ from the current recovery state machine. In particular, an older runtime could leave a payment in `reserved` after an external provider effect. A newer runtime must not interpret an unversioned historical `reserved` row as proof that no external effect occurred.

## Invariant

Only active rows created under the current durable recovery protocol may resume external work. Active rows with a missing or unknown recovery protocol version are fenced and quarantined as `ambiguous` before the recovery API returns an executable record.

## Production behavior

- `missing_x402_payments.recovery_protocol_version` is nullable so historical rows remain distinguishable from new rows.
- New reservations persist `CURRENT_DISTRIBUTED_RECOVERY_PROTOCOL_VERSION = 1` atomically with `reserved`.
- Recovery still acquires the normal lease/fence first.
- If the claimed row is legacy (`NULL`) or carries an unknown version, that same owner transitions it to `ambiguous`, records `recovery_protocol_version_untrusted:<version>`, releases the lease, and returns `claimed=false` with no executable record.
- Current-version rows preserve normal takeover behavior.

## Proof

`src/experimentKappa514.ts` uses PostgreSQL 16 and proves:

1. New reservations persist protocol version 1.
2. A legacy active row with `NULL` version is quarantined under fence 2.
3. An unknown version row is quarantined under fence 2.
4. Both quarantines release their lease and return no executable recovery record.
5. Neither untrusted row can reach simulated provider or settlement effects.
6. A current-version row remains recoverable and advances from fence 1 to fence 2.

Formal decision: `GO_DURABLE_RECOVERY_PROTOCOL_VERSIONING`.
