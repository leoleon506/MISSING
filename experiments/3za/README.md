# Experiment 3Z-A — Forensic Integrity Audit

Purpose: **post-hoc integrity audit only**. This experiment does not rerun 3Z, does not perform provider discovery, reranking, documentation crawling, contract synthesis, live API calls, or replay.

It audits the exact original 3Z execution object:

- original SHA: `d7084aa7103739cf163696634af3776cbabcf93b`
- workflow run: `33015231733`
- artifact ID: `9624265594`
- artifact digest: `sha256:6b943b75cafbf91f0c8a5d7971ad1c697073dfe1c86aa753fb574e79d3f7c776`
- original report fingerprint: `ebcc4f829d04d259397d6487aaf0a936c7f964ec67f52f0aa2ffff38ac675591`
- original formal decision: `REASSESS_3Z_BLIND_CONFIRMATORY_END_TO_END_MANUFACTURE`

The original result is never rewritten or relabeled.

## Question

Was the sole failed 3Z gate, `no_case_specific_provider_seeds`, a real provider-seeding violation or a non-causal self-referential instrumentation defect?

## Audit method

The runner reads the original `src/experiment3z.ts`, `src/experiment3zCore.ts`, and `src/experiment3zPlanner.ts` directly from the original Git object using `git show <original-sha>:<path>`.

The audit verifies:

1. holdout core contains no literal HTTP(S) provider URLs before the provider runtime type;
2. holdout case definitions contain no provider/start/base/path/output mapping fields;
3. planner contains no literal provider URLs;
4. runtime `start_url` is assigned only from `s.link`;
5. `s` comes from `resolveSelected(r.selection, broad)`;
6. `broad` comes from unchanged `recoveredBroadRetrieveR2(c, catalog)`;
7. the original seed auditor reads its own source and tests a regex whose forbidden literals occur in that same source, proving self-reference;
8. original preregistered substantive threshold was met: 2 manufactures, 2 providers, 2 recipes, replay 2/2, controls 42/42.

## Non-reexecution guarantee

3Z-A contains no network fetches, OpenAI calls, discovery, provider execution, documentation crawl, contract synthesis, or replay. Git history must be available locally (`fetch-depth: 0`) only so the exact original source can be read.

## Decision

`GO_3Z_A_FORENSIC_INTEGRITY_AUDIT` means:

- the original 3Z formal `REASSESS` remains historically unchanged;
- static forensic evidence supports that the failed seed gate was a self-referential audit defect rather than actual provider seeding;
- the substantive 3Z observation remains 2/3 blind end-to-end manufactures with two distinct providers and 100% recipe replay.

Otherwise:

`REASSESS_3Z_A_FORENSIC_INTEGRITY_AUDIT`
