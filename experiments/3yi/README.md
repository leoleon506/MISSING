# Experiment 3Y-I — End-to-End Integration Recovery

## Status
Engineering integration only; not confirmatory evidence.

Frozen recovery SHA: `6b79298feb6288f843e0c11c04cfbe7cd4a1a794`.

## Purpose
Exercise the known 3Y development cases through the assembled recovery stack before consuming any new 3Z holdouts.

The experiment must not modify retrieval scoring, TOP_K, morphology, DNS guards, or safety rules based on these results.

## Pipeline under test

`capability spec -> frozen R2 retrieval -> existing bounded provider reranker -> safe documentation crawl -> evidence-grounded contract synthesis -> real 3X FIELD interpreter -> first live GET -> semantic validation -> fresh second live GET -> persist recipe -> changed-input replay`

The known 3Y cases are development cases only:
- country_metadata
- pokemon_metadata
- brewery_metadata

## GO gates
All must be true:
1. Frozen recovery SHA is declared.
2. Exactly the three known 3Y development cases are used.
3. Provider candidates originate from the unchanged R2 mechanical frontier.
4. At least 2/3 capabilities manufacture successfully.
5. Successful manufactures use at least two distinct providers.
6. Every persisted recipe passes two fresh build verifications.
7. At least two recipes are persisted.
8. Every persisted recipe succeeds on changed-input replay.
9. Replay success rate is 100%.
10. Replay performs zero catalog/reranker/documentation/synthesis calls.
11. Projection execution uses the real 3X interpreter with bounded FIELD programs.
12. Provenance fingerprints are non-empty.
13. Existing active controls all execute and reject.
14. Safety is derived from a non-empty append-only ledger and no unsafe event is accepted.

Formal GO:
`GO_3Y_I_END_TO_END_INTEGRATION_RECOVERY`

Else:
`REASSESS_3Y_I_END_TO_END_INTEGRATION_RECOVERY`

A GO only establishes that the frozen components compose on already-known development cases. It does not establish blind generalization. Only 3Z may do that, using entirely new holdouts selected after the freeze.
