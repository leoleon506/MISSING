# 5B14 integration repair — lineage persistence only

## Status
Declared after the first valid 5B14 run and before repair implementation.

## Triggering observation
Valid 5B14 run `33282122118` on merged `main` SHA `165806557cd599eaa2b33fd4dd844c6a529a9d5d` produced 7 strict successes across 6 families with 7/7 changed-input replay. The new media success used a documentary request candidate and replayed successfully, while the formal report still marked documentary recipe/replay/new-family/lineage gates false.

Inspection of the run artifact shows the successful planner `parsed_json` contains both `documentary_witness_5b12` and `request_utility_5b14`, but the engine recipe persisted neither because contract validation normalizes the contract before recipe construction.

## Repair scope
This repair may only preserve already-produced planner instrumentation across normalization into the persisted recipe:
- preserve `documentary_witness_5b12` from the selected planner output;
- preserve `request_utility_5b14` from the selected planner output;
- add regression tests proving both fields survive into generated engine recipe construction.

## Explicitly frozen / prohibited
No changes to:
- 5B14 preregistration;
- candidate generation;
- semantic utility formula or evidence context;
- binding score;
- ranking dimensions or order;
- request ordering;
- shared global beam size 2;
- acquisition/provider/document budgets;
- provider, case, family, host, endpoint, query-key, or expected-answer rules;
- build or replay inputs;
- validation semantics;
- request execution;
- replay execution;
- holdout access.

The previous 5B14 decision remains `REASSESS_5B14_SYMMETRIC_REQUEST_LOCAL_OPERATION_COMPATIBILITY`. This repair does not retroactively change that decision. A fresh 5B14 rerun after merge is required for any new formal decision.
