# Experiment 3W-R — Verified Documentation Retrieval Replication

## Status

**Preregistered before implementation and before any live 3W-R benchmark.**

Base commit: `a4b17f2580d5e4d35c826555cb3fcafce24166d9` (the exact `main` SHA used by completed Experiment 3W run `32992732554`).

Experiment 3W ended in `REASSESS_DOCUMENTATION_TO_EXECUTABLE_CONTRACT_SYNTHESIS`. The completed run preserved the frozen provider population but produced zero manufactured families, zero live recipes, and zero replay successes. Post-run audit identified instrumentation defects in documentation frontier selection and active-control execution that can prevent the contract-synthesis hypothesis from being cleanly exercised.

3W-R is a **methodological replication**, not a new capability-selection experiment. It keeps the provider population, capability cases, build/replay inputs, and GO thresholds unchanged. It may only correct preregistered retrieval and verification defects described below.

## Scientific question

> With the exact 3W frozen provider population and exact semantic cases, does correcting documentation frontier selection and control execution allow MISSING to obtain useful human documentation and synthesize evidence-grounded executable GET contracts under the unchanged 3W gates?

## Frozen population and semantic cases

Exactly the same ten providers and three cases as 3W:

1. `public_source_code_repository_metadata`
   - build: `openai/openai-python`
   - replay: `nodejs/node`
   - required outputs: `full_name`, `stargazers_count`, `language`
   - Code.gov — `https://code.gov` — `p004_5746ab3901`

2. `fantasy_role_playing_ability_score_metadata`
   - build: `cha`
   - replay: `str`
   - required outputs: `index`, `name`, `full_name`
   - Open5e — `https://open5e.com/` — `p014_6fec1446bc`

3. `currency_metadata`
   - build: `USD`
   - replay: `EUR`
   - required outputs: `code`, `name`
   - Frankfurter — `https://www.frankfurter.app/docs` — `p019_611fbbfa8b`
   - Currency-api — `https://github.com/fawazahmed0/currency-api#readme` — `p010_236230d4c5`
   - Amdoren — `https://www.amdoren.com/currency-api/` — `p006_773cdab283`
   - CurrencyScoop — `https://currencyscoop.com/api-documentation` — `p003_27f6223956`
   - Exchangerate.host — frozen 3W start URL — `p016_1dae4bc72f`
   - National Bank of Poland — `http://api.nbp.pl/en.html` — `p022_0fdec33072`
   - CurrencyBeacon — `https://currencybeacon.com/` — `p011_1434d08808`
   - CurrencyFreaks — `https://currencyfreaks.com/` — `p012_e3c788ce5b`

No provider may be added, removed, substituted, manually rescued, or reordered for GO purposes.

## Frozen resource budgets

Unchanged from 3W:

- GET only;
- maximum crawl depth: **2**;
- maximum accepted documentation pages per provider: **8**;
- maximum response body: **4 MiB**;
- per-request timeout: **12 seconds**;
- no browser automation or JavaScript execution;
- no credentials, cookies, API keys, OAuth, Authorization headers, shell, plugins, or arbitrary code;
- live execution must use public HTTPS.

## Permitted methodological corrections

Only the following corrections are permitted.

### 1. Content-aware documentation frontier

Before a discovered link can consume the eight-page documentation budget, deterministically reject static assets and non-document resources by URL extension and/or response content type, including images, CSS, JavaScript, fonts, archives, media, and binaries.

Candidate ranking must be based on **anchor text and URL path/query**, not on the hostname. A keyword that occurs only in the hostname must not make a link documentation-relevant.

Priority order must be deterministic and favor likely documentation resources such as documentation, API reference, developer guide, README, endpoint, schema, examples, currencies, ability-score, repository metadata, or equivalent path/anchor terms.

Every discovered candidate must persist a frontier trace containing source evidence ID, target URL, anchor text, deterministic score/reason, and accepted/rejected state.

### 2. GitHub README/raw handling

For the frozen Currency-api GitHub documentation start only, the crawler may deterministically follow README/blob/raw links within the same frozen GitHub repository and the corresponding `raw.githubusercontent.com` representation. GitHub navigation links such as login, issues, pulls, actions, marketplace, sponsors, and unrelated repository UI must not consume documentation-page budget.

This is navigation to documentation already represented by the frozen provider start, not provider discovery.

### 3. Safe documentation redirects

Documentation fetches may follow at most one redirect when the target remains within the same allowed documentation scope, upgrades or preserves HTTPS, and does not introduce credentials or an IP-literal/private destination. Redirect metadata must be persisted. Live API execution redirect policy remains unchanged from 3W.

### 4. Strict discriminated synthesis output

`REJECT` is valid only with exactly:

- `case_id`
- `provider_candidate_id`
- `decision: REJECT`
- `reason`

`COMPILE` remains the exact 3W contract schema. A malformed REJECT must not be repaired merely to remove forbidden COMPILE fields; deterministic normalization may discard forbidden fields only if the model decision is unambiguously `REJECT` and required identity fields match. Such normalization must be recorded and must not create or modify any endpoint claim.

At most one semantic/static repair remains allowed for a candidate COMPILE contract.

### 5. Truly active negative controls

Exactly **22/22** controls remain required. Every control must invoke the same production validator, crawl-policy function, host-policy function, redirect-policy function, or replay-budget guard used by the benchmark. A literal hard-coded `true`, direct arithmetic comparison that bypasses the production guard, or synthetic result not routed through the production rejection function does not count as verified.

Control evidence must persist the invoked production guard and the observed rejection/error.

## Documentation usefulness observability

3W-R must report, per provider:

- candidates discovered;
- candidates rejected as assets/non-document/navigation;
- documentation pages accepted;
- frontier trace fingerprint;
- whether at least one accepted page contains endpoint/request evidence;
- whether at least one accepted page contains response/example/schema evidence;
- synthesis decision and static grounding result;
- live execution result if reached.

These are observability metrics only and do not change GO gates.

## Synthesis, grounding, live verification, recipe persistence, and replay

All substantive 3W rules remain unchanged:

- LLM receives only frozen intent/input/output names and fetched documentation evidence;
- no prior endpoint mapping, OpenAPI rescue, search engine, Common Crawl, MCP registry, or manual API mapping;
- COMPILE must be mechanically grounded in cited evidence;
- method exactly GET;
- execution base public HTTPS;
- no credentials;
- build request must return parseable JSON and satisfy frozen semantic validator;
- a fresh second build GET must confirm required values;
- recipe persists only after both succeed;
- replay uses changed frozen input with zero documentation fetches, zero LLM/synthesis calls, zero provider-selection calls, and zero projection induction.

## Formal decision and unchanged GO gates

Formal GO string: `GO_DOCUMENTATION_TO_EXECUTABLE_CONTRACT_SYNTHESIS_VERIFIED_REPLICATION`.

GO requires **all** of the following, with thresholds not lowered from 3W:

- frozen provider population unchanged: exactly 10;
- at least **2 of 3 capability families** produce evidence-grounded manufactured micro-contracts;
- at least **2 distinct providers** produce successful live semantic recipes;
- at least **1 successful recipe** has historical 3V OpenAPI acquisition = false;
- every successful recipe has two successful build verifications;
- every persisted recipe succeeds on changed-input replay;
- replay rate = **100%**;
- all required documentation/frontier/synthesis/live/recipe fingerprints are nonempty for successful recipes;
- all documentation/live observations are UTC timestamped;
- replay control deltas are zero;
- exactly **22/22 active controls** execute and verify through production guards;
- every safety counter is zero.

Otherwise the formal decision is:

`REASSESS_DOCUMENTATION_TO_EXECUTABLE_CONTRACT_SYNTHESIS_VERIFIED_REPLICATION`.

## Interpretation boundary

A GO would establish that the 3W failure was materially attributable to documentation retrieval/control instrumentation and that, after correcting those defects, multiple unrelated frozen capabilities can be manufactured from human documentation into replayable anonymous GET recipes.

A REASSESS must preserve the dominant failure layer separately for each provider: documentation acquisition/frontier, semantic provider mismatch, synthesis rejection, static grounding, live execution, projection/semantic validation, fresh confirmation, or replay.

No post-run provider substitution or gate reduction is permitted.