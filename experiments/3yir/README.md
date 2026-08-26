# Experiment 3Y-I-R — Integration Repair

## Status
Engineering repair only. Not confirmatory evidence.

Frozen recovery SHA remains `6b79298feb6288f843e0c11c04cfbe7cd4a1a794`.

## Purpose
Repair the specific 3Y-I integration defect where provider parameter names were incorrectly required to equal MISSING canonical input names, and classify external provider/fixture failures explicitly.

## Constraints
- no retrieval/scoring/TOP_K changes
- no DNS/safety guard changes
- no new blind holdouts
- only previously exposed 3Y/3W/3X cases/providers
- real 3X FIELD interpreter
- two live build verifications per successful recipe
- changed-input replay
- active controls and event-derived safety

## Generic binding rule
Provider parameter names are grounded by the documented provider path/query contract. They may map to a differently named canonical MISSING input, e.g. `{id_or_name} -> $input.pokemon_name`.

## Failure taxonomy
- `SYSTEM_FAILURE`
- `PROVIDER_INELIGIBLE`
- `FIXTURE_STALE`
- `LIVE_PROVIDER_FAILURE`

Formal result:

`GO_3Y_I_R_END_TO_END_INTEGRATION_REPAIR`

Else:

`REASSESS_3Y_I_R_END_TO_END_INTEGRATION_REPAIR`

A GO only closes the known integration defect. It does not count as blind generalization evidence and does not consume 3Z holdouts.
