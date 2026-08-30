# Product Theta.9 — Blocked Supply Queue & Backoff

Theta.9 prevents the trusted acquisition worker from retrying the same provider-setup blocker on every cycle.

## Production trigger

The real Finnish VAT acquisition cycle found one relevant provider (`VAT API`) and correctly returned `needs_provider_setup`. Without a durable backoff, every worker run would select the same top demand again and make no progress on lower-ranked unresolved demand.

## Behavior

When Theta finishes a cycle in `needs_provider_setup`:

1. the blocker is appended to a durable JSONL ledger;
2. the record preserves normalized intent, provider, reason, required credentials, missing-response-schema signal, attempt number, and retry timestamp;
3. the current cycle still returns `needs_provider_setup` so the operator can see what happened;
4. subsequent cycles skip that intent while the block is active;
5. the orchestrator continues with the next ranked unresolved demand;
6. after `retry_after`, the intent becomes eligible again.

## Persistence

`MISSING_SUPPLY_BLOCK_LEDGER` can override the path.

Otherwise the ledger is colocated with the demand ledger. On the existing Railway deployment this resolves to:

`/data/supply-blocks.jsonl`

The format is append-only and malformed historical lines are ignored rather than making the runtime unavailable.

## Backoff

`MISSING_SUPPLY_BLOCK_BACKOFF_MS` controls the base duration.

Default: 86,400,000 ms (24 hours).

Repeated provider-setup blockers use exponential backoff:

- attempt 1: 1x base
- attempt 2: 2x base
- attempt 3: 4x base
- ...
- capped at 30 days

## Trust boundary

Theta.9 does not acquire credentials, infer undocumented provider behavior, weaken verification, or mark blocked supply as verified. It only schedules when an unresolved demand may be reconsidered.

## Why this matters

The acquisition worker can now make forward progress through a queue of unresolved demand instead of becoming trapped behind one provider that requires external setup.
