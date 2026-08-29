# Experiment 5A — Pre-Case Harness Hotfix 001

## Failed run

- Workflow: `Run MISSING Experiment 5A`
- Run: `33227977986`
- Main SHA: `b633d7ba1f12f554be8e298ee0480168d18e22c5`
- Result: workflow failure before any holdout case evaluation completed

## Failure

The 5A runner temporarily replaced `src/experiment4aCore.ts` with the frozen 5A case registry and then used a dynamic import of `experiment4w.js`.

`experiment4w.ts` generates `.generated-experiment4w.ts` and imports it. The generated benchmark invokes its asynchronous `main()` without top-level awaiting that invocation. Therefore the module import can resolve at the first asynchronous yield while the benchmark continues running in the background.

The 5A parent runner incorrectly treated resolution of the module import as completion of the frozen 4W benchmark and immediately attempted to read:

`results/experiment-4w/report.json`

The file did not yet exist, producing:

`ENOENT: no such file or directory, open '.../results/experiment-4w/report.json'`

The 5A execution step lasted only a fraction of a second before the read failure. The generated 4W `main()` yields first on creation of its output directory and only afterward begins catalog acquisition and subsequently enters the holdout case loop. The parent failed while that asynchronous work had not completed. No 5A result, case evidence, recipe, replay result or artifact was produced.

This is classified as a **pre-case harness implementation failure**, not a 5A REASSESS and not a consumed holdout result, under the preregistered rule allowing harness/build hotfixes before a holdout case is attempted.

## Hotfix

The runner will no longer import the frozen 4W benchmark in-process. It will:

1. perform the same frozen-engine integrity check;
2. temporarily substitute only the 5A case registry/evaluator file;
3. launch `src/experiment4w.ts` in a separate Node process with the existing `tsx` loader;
4. inherit stdout/stderr;
5. **await child-process exit** before restoring the original registry or reading `results/experiment-4w/report.json`;
6. treat non-zero child exit as a harness/engine execution failure;
7. restore the original core file in `finally`.

## Frozen scientific content

This hotfix does **not** modify:

- `experiments/5a/README.md`;
- `experiments/5a/ERRATA.md`;
- any of the 18 holdout cases;
- any build or replay input;
- any semantic validator;
- any GO/REASSESS threshold;
- any safety gate;
- any 4W compiler, planner, binder, reranker, acquisition, probe, projection, validation, schema-witness or replay implementation;
- any package dependency or provider catalog.

A fresh workflow dispatch is required after this hotfix is merged. The failed run must not be rerun because it points to the old main SHA.
