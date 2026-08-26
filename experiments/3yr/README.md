# Experiment 3Y-R — Engineering Recovery After Blind E2E Failure

## Status

Engineering recovery only. This experiment is **not confirmatory evidence** and cannot establish blind generalization because the three 3Y holdouts are now known.

Base SHA: `75c97f9677a0bfa57343d47a9767731be88cc788` (merged Experiment 3Y).

## Purpose

Repair the concrete engineering defects exposed by 3Y without weakening the frozen 3Y claim. The repaired mechanisms can later be frozen and evaluated on entirely new holdouts in 3Z.

## Recovery targets

1. Unicode-aware semantic retrieval with generic-token suppression and IDF-weighted scoring.
2. OpenAPI acquisition from both JSON and YAML.
3. Manual redirect handling with HTTPS, credential, IP-literal, and registrable-domain validation on every redirect.
4. Reuse of the bounded 3X projection interpreter (`FIELD`, `INPUT`, `LOOKUP`, `FIND`) rather than the simplified 3Y path-only projection engine.
5. Capability-specific semantic validators rather than the inherited `currency` validator marker for all cases.
6. Safety counters derived from an append-only event ledger rather than literal zero constants.
7. Persisted diagnostic evidence for retrieval ranks, parser behavior, guard rejection, projection execution, and safety events.

## Important interpretation boundary

A `GO_3Y_R_ENGINEERING_RECOVERY` means only that the known 3Y engineering failure modes have executable corrections and regression coverage. It does **not** mean that MISSING has passed blind end-to-end manufacture.

The next confirmatory experiment must use previously unseen capabilities/providers after this recovery implementation is frozen.

## Recovery gates

All must be true:

- `PokéAPI` Unicode normalization is correct;
- the known 3Y semantic targets, when present in the public catalog, are inside the bounded recovered retrieval frontier;
- JSON OpenAPI parsing works;
- YAML OpenAPI parsing works;
- unsafe redirect controls are actively rejected;
- a projection executes through the 3X interpreter;
- country, Pokémon, and brewery cases have distinct validator identities;
- safety counters are derived from ledger events.

Formal recovery string:

`GO_3Y_R_ENGINEERING_RECOVERY`

Else:

`REASSESS_3Y_R_ENGINEERING_RECOVERY`

## Run

```bash
npm test
npm run build
npm run benchmark:3yr
```

The benchmark writes `results/experiment-3yr/report.json` and the GitHub Actions workflow uploads it as `missing-experiment-3yr-results`.
