# Product Theta.6 — Discovery Relevance Hardening

Theta.6 hardens the automatic demand-to-supply path after the first production worker run exposed false-positive provider discovery for the demand `Validate this Finnish VAT number`.

## Production finding

The original Theta.1 scorer used substring matching. That allowed the token `vat` to match unrelated text such as `reservation` and `private`, causing irrelevant APIs such as Azure Reservation to enter the compilation queue.

## Changes

- Provider discovery now matches normalized whole tokens rather than arbitrary substrings.
- `vat` no longer matches `reservation`, `private`, or other containing words.
- OpenAPI GET-operation scoring uses whole-token overlap as well.
- The compiler now fails closed with `missing: ["relevant_get_operation"]` when the best GET operation has zero semantic overlap with the unresolved demand.
- No verification or promotion boundary is relaxed.

## Expected behavior

For Finnish VAT demand, unrelated reservation/private APIs are filtered before promotion can ever be attempted. If APIs.guru contains no genuinely relevant provider, Theta.4 should terminate safely with `no_candidates` or `rejected` rather than fabricating supply.
