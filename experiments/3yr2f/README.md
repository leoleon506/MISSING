# Experiment 3Y-R2F — Freeze Audit

## Status

Freeze audit only. No retrieval algorithm, retrieval parameter, parser, validator, or capability holdout is changed here.

Base SHA: `01f8d859f602a701a4acb069b8003e8e007763e2` (merged 3Y-R2 GO).

## Purpose

Close the remaining methodological gap before freezing the recovery stack for blind 3Z. 3Y-R2 produced `GO_3Y_R2_ENGINEERING_RECOVERY`, but its formal safety gate used a principal ledger with no events while DNS controls used separate ledgers.

## Audit requirements

All must be true:

1. The real Public APIs catalog is fetched through `fetchTextSafeR2`, not a direct `fetch`.
2. The same append-only ledger records safe network fetches, public-DNS evidence, and rejected private-DNS controls.
3. The ledger is non-empty.
4. At least one accepted `public_dns` event is present.
5. At least one rejected `private_hosts` event is present.
6. No unsafe event is accepted and all derived safety counters are zero.
7. The known 3Y development targets remain inside the unchanged R2 frontier; this is a regression guard only, not confirmatory evidence.

Formal result:

`GO_3Y_R2F_FREEZE_AUDIT`

Else:

`REASSESS_3Y_R2F_FREEZE_AUDIT`

A GO authorizes freezing the recovery implementation SHA. Only after that freeze may 3Z select entirely new holdouts and run blind confirmatory end-to-end manufacture.
