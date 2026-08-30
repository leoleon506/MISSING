# 5B14 pre-rerun integration repair — decision lineage completeness

## Status
Declared after merge of PR #123 and before any post-repair 5B14 live rerun.

## Triggering observation
The frozen 5B14 preregistration requires the documentary recipe lineage to be complete from evidence -> local semantic context -> request template/hypothesis -> binding -> utility -> beam position -> rendered build request -> strict recipe -> changed-input replay.

After PR #123, the engine now preserves the pre-normalization `documentary_witness_5b12` and `request_utility_5b14` in persisted recipes. However, the formal decision gate still checks only a subset of the already-existing lineage fields (`source_evidence_id`, `template_fingerprint`, beam position, and documentary utility flag). It does not explicitly validate the source span, request-local span, hypothesis identity, binding validity, rendered build request, or same-case successful changed-input replay as part of the lineage gate.

The formal report also uses `authLikeRenderedRequests`, `wrongTaskProbeAttempts`, and replay discovery deltas in gates but does not expose their numeric values directly in the 5B14 report metrics, despite the preregistered direct-instrumentation requirement.

## Repair scope
Decision/report instrumentation only:
- strengthen `documentary_lineage_complete` using fields already produced by the frozen treatment and preserved by PR #123;
- require evidence/source-span provenance, request-local span found, documentary hypothesis identity, valid/resolved binding instrumentation, beam position, rendered build URL, and successful same-case changed-input replay;
- expose replay discovery deltas, auth-like rendered requests, and wrong-task probe attempts numerically in the formal report;
- add regression tests for the lineage gate.

## Explicitly frozen / prohibited
No changes to:
- `experiments/5b14/README.md`;
- candidate generation or extraction;
- semantic context construction or scoring;
- binding scoring;
- ranking dimensions/order;
- request ordering;
- global beam size;
- provider/document/acquisition budgets;
- workload, cases, providers, hosts, endpoints, or expected answers;
- request execution or replay execution;
- holdout access.

This repair cannot reinterpret the previous valid 5B14 result. A fresh 5B14 rerun after merge is required for a new formal decision.
