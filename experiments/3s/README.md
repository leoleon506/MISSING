# MISSING Experiment 3S — Execution-Verified Capability Procurement

## Status
Preregistered before implementation and before benchmark execution.

## Relationship to prior evidence
- **3Q** demonstrated bounded registry-wide discovery over a live APIs.guru universe of >=1,000 API definitions.
- **3P2R** demonstrated bounded typed procurement/execution/replay when a viable live contract was already known.
- **3R** connected discovery to typed procurement, but both discovered providers failed at live execution despite passing contract compatibility/readiness: one redirected from its documented execution base and one documented hostname no longer resolved.

3S tests a new product property: whether MISSING can verify multiple discovered suppliers before commitment and automatically abandon stale/broken/non-executable supply in favor of another semantically compatible supplier, within bounded deterministic limits.

## Frozen question
Can MISSING start from the same capability-only requests used in 3Q/3R, discover multiple semantically compatible OpenAPI/Swagger candidates from a broad live registry, verify which candidates are actually executable **now**, select a live supplier without provider-specific mappings, synthesize typed bindings, execute and semantically validate the capability, persist a recipe, and replay it on a different input with zero discovery/planner/spec-fetch calls?

## Frozen discovery substrate and base algorithm
The only discovery root remains:

`https://api.apis.guru/v2/list.json`

3S reuses the same generic functions and constants from 3Q/3R:

- registry top-K = 60 per case;
- at most 20 unique specifications fetched per case;
- same registry metadata scorer;
- same OpenAPI/Swagger parser;
- same operation scorer and compatibility evidence;
- no case-to-provider, provider-to-case, provider bonus, specification URL, execution hostname, or operation-path mappings.

Unlike 3Q/3R, the discovery planner does not commit to a single supplier before execution verification. The deterministic retriever supplies a bounded ranked set of semantically compatible exact GET operations.

## Frozen cases
Exactly the same three semantic cases from 3Q and 3R are retained.

### A — public source-code repository metadata
Build input:
- `owner = openai`
- `repo = openai-python`

Replay:
- `owner = nodejs`
- `repo = node`

Required output leaves:
- `full_name`
- `stargazers_count`
- `language`

Semantic validator: `full_name == owner/repo` case-insensitively; star count finite/non-negative; language null or non-empty string.

### B — fantasy role-playing ability-score metadata
Build input:
- `ability_index = cha`

Replay:
- `ability_index = str`

Required outputs:
- `index`
- `name`
- `full_name`

Semantic validator: `index == ability_index` case-insensitively; name/full_name non-empty strings.

### C — currency metadata
Build input:
- `currency_id = USD`

Replay:
- `currency_id = EUR`

Required outputs:
- `code`
- `name`

Semantic validator: code equals input case-insensitively; name non-empty string.

## Supplier candidate construction
For each case:

1. Fetch/parse live registry and top-ranked live specs using unchanged 3Q limits.
2. Build exact GET operation candidates from parsed contracts.
3. Retain only candidates with positive deterministic compatibility evidence for at least one input and at least one required output.
4. Group by distinct registry API key/provider.
5. Retain at most **5 distinct supplier candidates per case**, taking the best compatible operation from each provider by deterministic score.

No LLM may add a provider or operation outside this retrieved set.

## Execution-verification phase
Each retained supplier is evaluated in deterministic rank order until one becomes a fully verified supplier or the bounded supplier budget is exhausted.

A supplier verification attempt may perform, in order:

1. contract/public-readiness validation;
2. typed binding synthesis through the same bounded planner language as 3R (`DIRECT`, `SPLIT`, `LITERAL`, `UNUSED`), with at most one repair for contract/static failure;
3. deterministic request compilation;
4. one live GET verification request using the build input;
5. bounded redirect analysis;
6. JSON/content validation;
7. semantic output validation.

If any supplier fails one stage, MISSING records the exact failure reason and may continue to the next retrieved supplier. It may not return to the registry, enlarge the candidate limits, change the case, modify the semantic validator, or add provider-specific rescue logic.

## Redirect policy
3R showed that a documented execution base can be stale while redirecting to a current canonical origin. 3S therefore tests bounded safe redirect canonicalization as part of live-supply verification.

Redirects are still **not automatically followed**. For one supplier verification request only:

- at most one 301/302/307/308 redirect may be inspected;
- Location must resolve to HTTPS;
- redirected hostname must be a public DNS hostname, not an IP literal;
- no credentials, cookies, Authorization, or arbitrary headers may be forwarded;
- the redirect target must preserve the exact request path/query or differ only by host/scheme canonicalization;
- after policy validation, MISSING may issue exactly one fresh GET to the safe redirect target;
- if the redirected request succeeds semantically, the canonical target base/host is persisted in the recipe.

Redirect chains, path-changing redirects, downgrade to HTTP, IP literals, non-public DNS, or more than one redirect are rejected.

## Execution verification outcomes
Each supplier receives one terminal status from this frozen vocabulary:

- `verified_live`
- `contract_invalid`
- `not_publicly_executable`
- `binding_reject`
- `dns_unreachable`
- `redirect_rejected`
- `http_error`
- `non_json`
- `semantic_mismatch`

The first `verified_live` supplier in deterministic supplier rank becomes the selected supplier for the case.

## Persisted recipe and replay
A verified supplier persists the same recipe evidence as 3R plus:

- supplier rank within the bounded candidate set;
- verification status;
- canonical execution base actually verified live;
- original documented execution base;
- whether one safe canonical redirect was used;
- provider verification trace fingerprint.

Replay uses only the persisted recipe and different frozen input.

During replay:

- registry fetch calls = 0;
- specification fetch calls = 0;
- discovery-planner calls = 0;
- supplier-selection calls = 0;
- procurement-planner calls = 0;
- projection-induction calls = 0.

Replay performs only the persisted live GET and semantic validator. No supplier fallback is allowed during replay.

## Frozen active negative controls
Every control must execute through the same predicate/compiler used by the live pipeline.

1. non-HTTPS execution base rejected;
2. IP-literal execution host rejected;
3. auth-required operation rejected;
4. absent operation rejected;
5. undeclared parameter binding rejected;
6. missing required parameter rejected;
7. missing DIRECT input rejected;
8. SPLIT out-of-range rejected;
9. unsupported transform rejected;
10. semantic identity mismatch rejected;
11. empty fingerprint evidence rejected;
12. redirect to HTTP rejected;
13. redirect to IP literal rejected;
14. redirect changing request path rejected;
15. second redirect in a chain rejected.

## Frozen GO gates
Formal decision is `GO_EXECUTION_VERIFIED_CAPABILITY_PROCUREMENT` only if all of the following hold:

- live APIs.guru registry fetched/parsed;
- registry has >=1,000 entries;
- zero case-to-provider/spec/operation mappings;
- at least 2 cases produce >=2 semantically compatible distinct supplier candidates before verification OR, if only one compatible supplier exists for a successful case, that case may count only if another successful case had >=2 candidates and at least one supplier was actually rejected before a later supplier was selected;
- at least 2 distinct cases select a `verified_live` supplier;
- selected live suppliers span at least 2 distinct providers;
- at least one successful case demonstrates **actual supplier rejection/fallback** before selecting a later verified supplier;
- at least 2 cases compile statically valid typed bindings for their selected suppliers;
- at least 2 selected suppliers execute live JSON and pass semantic validation;
- at least 2 recipes from distinct providers are persisted with non-empty spec, descriptor, verification-trace, and recipe fingerprints;
- 100% of persisted recipes replay successfully on different frozen input;
- replay registry/spec/discovery/supplier-selection/procurement/projection calls are all zero;
- all 15 frozen negative controls executed and rejected;
- unknown/absent operations accepted = 0;
- undeclared params accepted = 0;
- invalid typed bindings accepted = 0;
- unsupported transforms accepted = 0;
- auth-required suppliers executed = 0;
- non-GET suppliers executed = 0;
- unsafe redirects followed = 0;
- host-policy violations accepted = 0;
- credentials supplied = 0;
- arbitrary code executed = 0.

Otherwise the decision is `REASSESS_EXECUTION_VERIFIED_CAPABILITY_PROCUREMENT`.

No threshold may be relaxed after execution.

## Interpretation boundary
A GO would demonstrate bounded **live-supply selection** rather than documentation selection: `intent → broad registry → multiple compatible suppliers → live verification/fallback → typed compile → live semantic execution → persisted recipe → zero-discovery/zero-LLM replay`.

It would not demonstrate unrestricted open-web discovery, credential acquisition, paid/commercial procurement, arbitrary redirects, economic optimization, SLA prediction, universal API adaptation, or autonomous payment/revenue.