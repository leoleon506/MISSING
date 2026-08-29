# Experiment 5B9 — Verified Selected-Provider Acquisition Recovery

## Status

This file MUST be the first 5B9-specific commit.

5B9 is a development experiment informed by completed 5B8 evidence. It does not alter, rerun, reinterpret, or overwrite the formal decisions of 5A through 5B8. The 18-case workload remains consumed development evidence. A later fresh unseen holdout is still mandatory before any new generalization claim.

## Frozen development baseline

- `main` SHA: `0abd49ebb2e4c081e1f92f0fb178b49091c7499e`
- valid 5B8 workflow run: `33267807315`
- 5B8 artifact: `9719255490`
- 5B8 artifact digest: `sha256:0498fbaa6653b331524d156f2bef45c0ab8f4bf205de4fa9166abd32010dede5`
- 5B8 report fingerprint: `70b93318a985ed5fb5f63733533d53e71215d94134842f22bb48c681c95a09cc`
- 5B8 engine fingerprint: `96fbda1fe36c5d75c462b5d906717ef4f077caf2f97451d249930fafd93a073b`
- 5B8 decision: `REASSESS_5B8_ROLE_SEGMENTED_TYPED_OPERATION_TRANSFER`
- workload fingerprint: `47d4e330ac9d88f6ee0485eb9628f7af669f39b6a606cea90b175fb941aad431`

Formal 5B8 development result:

- 6 / 18 strict successes
- 5 semantic families with success
- 6 distinct successful provider hosts
- 6 persisted recipes
- 6 / 6 changed-input replays = 100%
- 47 query hypotheses audited by 5B8
- 47 rejected pre-beam
- 0 strict query-origin recipes
- 49 exact-operation transfer candidates
- 27 exact-operation transfers accepted
- 12 transfer-driven decision changes
- 0 accepted output→entity contamination
- all inherited safety/determinism/cost gates remained clean

The remaining bottleneck observed in 5B8 was frequently upstream of query synthesis: a semantically promising selected provider reached acquisition, but acquisition yielded no executable operation inventory or was rejected before useful HTTPS documentation could be explored.

## Post-hoc development diagnosis from 5B8

Because 5B8 is development evidence, failed provider/acquisition traces may be inspected to design 5B9. They MUST NOT change the formal 5B8 verdict.

Generic failure patterns observed:

1. selected provider catalog/start URL uses `http://` even though the same host may expose a valid HTTPS surface;
2. selected documentation URL returns a shell, error page, SPA bootstrap, anti-bot response, or otherwise zero executable operations;
3. the fetched page contains bounded same-provider links to canonical docs, API references, machine-readable specs, or exact documentation descendants that were not promoted early enough within the existing acquisition budget;
4. acquisition budget is consumed on low-utility same-provider pages before a structured operation surface is reached;
5. provider selection itself may be correct, but synthesis sees zero request hypotheses because no executable documentation surface survived acquisition.

5B9 targets **selected-provider acquisition recovery only**. It does not change provider ranking, query semantics, response validation, or strict acceptance.

## Primary hypothesis

> If a deterministically selected provider that yields no executable operation surface receives a bounded, provider-scoped acquisition recovery using verified HTTPS canonicalization and operation-oriented same-provider links already exposed by acquired evidence, while staying within the frozen documentation budget, then at least one previously unsuccessful semantic family will obtain a strict replayable recipe without weakening semantic, safety, determinism, provider-scope, or cost constraints.

## Treatment A — Recovery eligibility

Recovery may activate only after deterministic provider selection and ordinary acquisition for that provider when the provider is **acquisition-starved**.

A provider is acquisition-starved when all of the following hold:

- it was selected by the frozen deterministic provider ordering;
- ordinary acquisition completed or terminated;
- no executable GET request hypothesis survived from its acquired evidence, OR the operation inventory contains zero executable GET operations relevant enough to enter the existing request graph;
- no strict recipe has already been confirmed for that provider/case;
- the provider still has unused slots within the existing frozen documentation-page budget.

Recovery MUST NOT activate simply because a probed operation failed semantically. It targets missing executable surface, not failed response semantics.

Metrics include:

- `selectedProviderAcquisitionStarved5b9`
- `selectedProviderRecoveryActivated5b9`
- `selectedProviderRecoverySkippedBudgetExhausted5b9`
- `selectedProviderRecoverySkippedExecutableSurfacePresent5b9`

## Treatment B — Verified HTTP→HTTPS canonicalization

When the selected provider's start/documentation URL uses plain HTTP, 5B9 may synthesize the same URL with only the scheme upgraded to HTTPS.

The candidate HTTPS URL is eligible only if:

1. hostname is byte-identical after normalization;
2. port is unchanged or the HTTP default port is removed for HTTPS;
3. path, query keys and query values are unchanged;
4. no userinfo exists;
5. no IP-literal host transformation occurs;
6. provider/domain scope is unchanged;
7. the candidate passes all existing safe-document-fetch guards;
8. the HTTPS fetch succeeds under existing response/status/content constraints.

No alternate host, subdomain guess, path guess, or provider-specific rewrite is allowed.

Metrics include:

- `httpsUpgradeCandidates5b9`
- `httpsUpgradeFetches5b9`
- `httpsUpgradeAccepted5b9`
- `httpsUpgradeRejectedScope5b9`
- `httpsUpgradeRecoveredOperations5b9`

## Treatment C — Bounded same-provider recovery link extraction

From already-acquired evidence belonging to the selected provider, 5B9 may extract candidate documentation links only from explicit local URL/href/src/link text already present in that evidence.

Eligible links must satisfy ALL of:

- HTTP(S) absolute or resolvable relative URL;
- same provider scope under the existing provider-scope function;
- HTTPS after canonicalization rules;
- read-only documentation/spec intent;
- no auth-like credentials/query keys;
- no mutation-oriented path/action;
- no fragment-only target;
- not already fetched in the acquisition trace;
- within existing max depth and max document bytes;
- within the existing total documentation pages/provider budget.

No web search, DNS search, sitemap crawling, robots crawling, guessed common paths, provider-specific path table, or external-domain traversal is allowed.

## Treatment D — Operation-oriented recovery-link utility

Eligible same-provider recovery links are ranked deterministically by provider-blind documentation-surface evidence visible in their local anchor/context and URL shape.

Positive evidence classes may include generic terms such as:

- api
- docs / documentation / reference
- developer
- openapi / swagger / schema / spec
- json / yaml / yml
- rest
- endpoints / methods / operations
- machine-readable

Negative evidence classes include generic navigation/noise such as:

- login / signup / account
- pricing / careers / blog / news
- images / css / js bundles
- privacy / terms / legal
- marketing/homepage-only navigation
- download binaries/archive assets unrelated to API specs

Provider names, benchmark entities, expected answers, known endpoints, and case IDs MUST NOT contribute ranking utility.

Deterministic tie-breaker: normalized URL fingerprint.

Metrics include:

- `recoveryLinkCandidates5b9`
- `recoveryLinkAccepted5b9`
- `recoveryLinkRejectedScope5b9`
- `recoveryLinkRejectedNoise5b9`
- `recoveryLinkAlreadyFetched5b9`
- `recoveryLinkOrderingFingerprintCount5b9`
- `recoveryLinkOrderingNondeterminismRejects5b9`

## Treatment E — Zero-operation trigger and bounded fetch loop

Recovery executes only while the selected provider remains acquisition-starved.

For each remaining documentation-page slot:

1. construct the deterministic recovery candidate queue from already-acquired selected-provider evidence;
2. include an eligible verified HTTPS upgrade candidate if applicable;
3. choose the highest-ranked not-yet-fetched candidate;
4. fetch it through the existing safe documentation fetch path;
5. add resulting evidence to the same selected-provider evidence graph;
6. rerun the existing operation inventory/request-hypothesis extraction only for determining whether executable surface now exists;
7. stop recovery immediately once executable surface exists or budget is exhausted.

Recovery does NOT probe API operations itself. It only acquires documentation evidence.

Metrics include:

- `recoveryFetchAttempts5b9`
- `recoveryFetchSuccesses5b9`
- `recoveryFetchFailures5b9`
- `recoveryStoppedOnExecutableSurface5b9`
- `recoveryStoppedOnBudget5b9`
- `recoveryExecutableOperationsAdded5b9`
- `recoveryRequestHypothesesAdded5b9`

## Treatment F — Acquisition budget remains frozen

5B9 MUST NOT increase the existing per-provider documentation budget.

Frozen limits remain:

- provider attempts/case: 8
- documentation pages/provider: 8 total, ordinary + recovery combined
- documentation depth: 2
- maximum document bytes: 4 MiB
- maximum unique executable requests/provider: 2

If ordinary acquisition already consumed all 8 pages, recovery performs zero fetches.

The final report must prove:

- `maxDocumentationFetchesPerProvider5b9 <= 8`
- `maxRecoveryPlusOrdinaryDepth5b9 <= 2`

## Treatment G — Same-provider lineage

Every recovery fetch must persist a lineage witness containing:

- case ID
- provider candidate ID
- source evidence ID(s)
- source body fingerprint(s)
- candidate URL fingerprint
- normalized origin/host fingerprint
- recovery reason (`https_upgrade` or `explicit_same_provider_link`)
- local anchor/context fingerprint for link-based recovery
- scope-check result
- deterministic recovery utility tuple
- recovery ordering fingerprint
- fetch result/status/content-type
- resulting evidence ID/body fingerprint
- operation inventory count before/after
- request hypothesis count before/after
- budget slot index
- lineage fingerprint

A strict recipe attributed to 5B9 must persist the recovery lineage that first made its executable request surface available.

## Treatment H — Recovery attribution

A recipe is a **5B9 recovery recipe** only when:

1. its selected provider activated 5B9 recovery;
2. the final executable request hypothesis depends on evidence first acquired by a 5B9 recovery fetch OR the provider became executable only after the verified HTTPS-upgrade acquisition;
3. all inherited strict semantic/response/replay gates pass;
4. changed-input replay succeeds without rerunning recovery/discovery/acquisition.

Metrics include:

- `recoveryStrictRecipes5b9`
- `recoveryChangedInputReplaySuccesses5b9`
- `recoveryNewFamilyRecipes5b9`

## Treatment I — Replay remains frozen

Replay uses only the persisted recipe/request from the build run.

During replay:

- zero provider reranking;
- zero provider discovery;
- zero documentation acquisition;
- zero recovery link extraction;
- zero HTTPS canonicalization fetches;
- zero query recompilation;
- zero semantic-gate reruns;
- zero LLM calls attributable to 5B9.

Recovery is build-time acquisition only.

## Treatment J — Preserve all prior semantic gates

5B9 does not weaken or bypass:

- 5B2 semantic identity and exact-vs-containment hardening;
- 5B3 deterministic provider ordering and fixed two-request beam;
- 5B4 structured collection compiler;
- 5B5 exact operation alignment and section-local evidence;
- 5B6 query-oriented compiler and zero example-value matching;
- 5B8 role-segmented task semantics, parameter-type conflict checks, exact-operation transfer, and complete ACCEPT/REJECT audits;
- same-provider scope;
- auth-like request guards;
- request mutation/origin-drift guards;
- external-reference restrictions;
- response grounding and closed-world output-role resolution;
- changed-input replay validation.

## Negative controls

Provider-neutral tests MUST demonstrate:

1. an HTTP start URL may produce only its exact HTTPS scheme-upgraded candidate;
2. HTTP→HTTPS upgrade cannot change host/path/query;
3. alternate subdomain guessing is forbidden;
4. an explicit external-domain docs link is rejected;
5. auth/login/account links are rejected;
6. mutation-oriented links are rejected;
7. JS/CSS/image/marketing links are deprioritized or rejected;
8. a same-provider explicit OpenAPI/reference link is eligible;
9. already-fetched links are not fetched again;
10. recovery does not run when executable request surface already exists;
11. recovery does not run after page budget exhaustion;
12. ordinary + recovery fetch count never exceeds 8/provider;
13. recovery stops immediately after executable surface appears;
14. no provider name, case ID, benchmark value, or expected answer appears in runtime recovery rules;
15. replay performs zero recovery/acquisition work.

## Positive controls

Provider-neutral tests MUST demonstrate:

1. exact scheme-only HTTPS upgrade is accepted for an HTTP documentation URL;
2. same-provider explicit `openapi`, `swagger`, `reference`, or `api docs` links outrank generic navigation links;
3. bounded same-provider recovery can turn zero operation inventory into executable GET inventory;
4. deterministic candidate ordering/fingerprints are byte-identical for identical evidence;
5. a recovery-derived operation can enter the unchanged existing request graph;
6. a confirmed recovery recipe persists complete acquisition lineage;
7. changed-input replay uses the persisted request without rerunning recovery.

## Runtime prohibitions

No 5B9 runtime file may contain:

- a development provider domain or endpoint seed;
- a 5A–5B8 case ID conditional;
- benchmark build/replay values or expected answers;
- remembered provider success/failure tables;
- provider-specific path guesses;
- hardcoded common endpoints such as provider-specific `/api/...` paths;
- external search-engine calls;
- sitemap/robots expansion;
- guessed subdomains;
- relaxed provider-scope/auth/mutation guards;
- extra request-probe budget;
- extra documentation-page budget.

## Frozen budget

- cases: 18
- provider attempts/case: 8
- documentation pages/provider: 8 total ordinary + recovery
- documentation depth: 2
- maximum document bytes: 4 MiB
- maximum unique executable requests/provider: 2
- stochastic provider reranker calls: 0
- existing response-role resolver model: `gpt-4.1-mini-2025-04-14`
- total LLM cost <= USD 3.00
- mean LLM cost/strict success <= USD 0.15
- median strict-success latency <= 90 seconds
- p90 strict-success latency <= 180 seconds

## Primary 5B9 GO criteria

5B9 is GO only if ALL inherited semantic/safety/cost gates remain true and ALL of the following hold:

1. >= **6 / 18 strict successes**;
2. >= **6 semantic families** with strict success;
3. >= **6 distinct successful provider hosts**;
4. replay >= **95%**;
5. >=1 acquisition-starved selected provider activates recovery;
6. >=1 verified HTTPS-upgrade or explicit same-provider recovery fetch succeeds;
7. >=1 recovery fetch increases executable operation inventory or request-hypothesis count;
8. >=1 recovery-derived hypothesis enters the unchanged max-two request beam;
9. >=1 strict recipe is attributable to 5B9 recovery;
10. >=1 such recipe succeeds changed-input replay;
11. >=1 such recipe belongs to a semantic family with no strict success in 5B8;
12. recovery-link ordering nondeterminism rejects = 0;
13. recovery lineage is complete for every strict 5B9 recovery recipe;
14. ordinary + recovery documentation fetches <=8/provider;
15. ordinary + recovery depth <=2;
16. replay recovery/acquisition deltas = 0;
17. 5B8 output→entity contamination accepted = 0;
18. 5B8 parameter-type example-value uses = 0;
19. 5B8 query semantic-gate/transfer nondeterminism rejects = 0;
20. 5B6 query example-value matching = 0;
21. 5B6 query compiler nondeterminism rejects = 0;
22. stochastic provider reranker calls = 0;
23. max 2 unique executable requests/provider;
24. all auth, wrong-task, mutation, origin-drift, external-ref, validator and duplicate-fetch gates remain clean;
25. cost and latency budgets remain satisfied;
26. all 18 development cases complete deterministic provider ordering, acquisition/recovery, synthesis, evaluation and reporting.

Thresholds are not lowered. A 5B9 GO remains development evidence only.

## Decision strings

- `GO_5B9_VERIFIED_SELECTED_PROVIDER_ACQUISITION_RECOVERY`
- `REASSESS_5B9_VERIFIED_SELECTED_PROVIDER_ACQUISITION_RECOVERY`

## Execution rule

CI may run unit/integration/generated-source controls only.

Do **not** run the live 5B9 benchmark from the PR branch.

After merge to `main`, manually dispatch:

`Run MISSING Experiment 5B9`

If 5B9 meets the preregistered development GO criteria, freeze the engine and proceed to a fresh unseen holdout rather than tuning these 18 cases further.