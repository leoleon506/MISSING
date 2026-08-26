# MISSING Experiment 3R — Autonomous Discovery-to-Execution

## Status
Preregistered before implementation and before benchmark execution.

## Relationship to prior evidence
- **3Q** established bounded registry-wide discovery: from a capability-only case, MISSING could search a live APIs.guru universe of >=1,000 APIs, fetch live OpenAPI/Swagger contracts, select an exact GET operation, persist a descriptor, and revalidate it without planner or registry calls.
- **3P2R** established bounded contract-aware procurement/execution from known live contracts: typed bindings, live execution, semantic validation, persisted recipes, and different-input replay with zero planner/source-procurement calls.

3R tests whether those two independently demonstrated mechanisms can be connected in one fresh run.

## Frozen question
Can MISSING start only from a capability request, autonomously discover a relevant provider and live machine-readable contract from a broad registry, select an exact public GET operation, synthesize bounded typed parameter bindings, execute the newly discovered API live, semantically validate the response, persist a reusable recipe, and replay it on a different input with **zero registry discovery, zero specification fetches, and zero planner calls**?

## Frozen discovery substrate and algorithm
The only remote discovery root is unchanged from 3Q:

`https://api.apis.guru/v2/list.json`

3R must reuse the same frozen 3Q discovery constants and deterministic ranking functions:

- registry top-K = 60 per case;
- at most 20 unique live specifications fetched per case;
- at most 24 operation candidates shown to the discovery planner;
- same registry metadata scorer;
- same live contract parser;
- same operation scorer/candidate diversification;
- same strict discovery planner contract: choose an opaque `candidate_id` or `REJECT`;
- no case-to-provider, provider-to-case, specification URL, API hostname, operation path, or provider bonus may be introduced.

The discovery phase may not be changed after execution to rescue a failed case.

## Frozen cases
The **same three capability cases from 3Q** are retained. 3R does not keep only the two cases that succeeded in 3Q.

### Case A — public source-code repository metadata
Intent: Given an owner and repository name on a public source-code hosting service, return the repository's canonical full name, star count, and primary language.

Build input:
- `owner = openai`
- `repo = openai-python`

Replay input:
- `owner = nodejs`
- `repo = node`

Required output leaves:
- `full_name`
- `stargazers_count`
- `language`

Semantic validator:
- `full_name` equals `owner/repo` case-insensitively;
- `stargazers_count` is finite and non-negative;
- `language` is null or a non-empty string.

### Case B — fantasy role-playing ability-score metadata
Intent: Given a tabletop fantasy role-playing ability-score identifier such as `cha`, return the canonical short index, abbreviated name, and full display name.

Build input:
- `ability_index = cha`

Replay input:
- `ability_index = str`

Required output leaves:
- `index`
- `name`
- `full_name`

Semantic validator:
- `index` equals `ability_index` case-insensitively;
- `name` and `full_name` are non-empty strings.

### Case C — currency metadata
Intent: Given a canonical currency identifier such as `USD`, return canonical currency code and human-readable currency name.

Build input:
- `currency_id = USD`

Replay input:
- `currency_id = EUR`

Required output leaves:
- `code`
- `name`

Semantic validator:
- `code` equals `currency_id` case-insensitively;
- `name` is a non-empty string.

## Public execution readiness
After discovery selects an exact candidate, MISSING must inspect the same live specification that produced the candidate and derive execution readiness deterministically.

A selected operation is executable only if all of the following are true:

- method is exactly GET;
- an HTTPS execution base URL can be derived from OpenAPI `servers` or Swagger 2 `schemes + host + basePath`;
- execution hostname is a public DNS hostname, not an IP literal;
- effective OpenAPI/Swagger security is absent, empty, or contains an anonymous alternative represented by an empty security requirement object;
- all required executable parameters are in `path` or `query`;
- no required cookie/header/body/form parameter exists;
- no credentials, cookies, Authorization headers, API keys, arbitrary headers, or request body are supplied.

A discovery that is relevant but auth-required is recorded as not executable; MISSING may not silently substitute another provider after a live-execution failure.

## Typed binding compiler
For a discovered ready operation, a separate strict procurement planner receives only:

- the frozen case;
- the selected opaque `candidate_id`;
- the selected operation's declared path/query parameters and schemas.

It returns a flat typed binding program with at most six slots.

Allowed binding kinds are unchanged from 3P2R:

- `DIRECT`: one complete `$input.<field>` value;
- `SPLIT`: split one `$input.<field>` on one bounded literal delimiter and select one bounded zero-based index;
- `LITERAL`: one primitive literal for a declared parameter only;
- `UNUSED`: empty slot.

No concatenation, regex rewriting, arithmetic, templates, URLs, generated code, shell, eval, plugins, dynamic imports, or arbitrary transform language is allowed.

Before execution, deterministic static validation must verify:

- selected operation still exists in the fetched contract;
- every bound parameter is declared by that exact operation/path;
- all required path/query parameters are supplied;
- every referenced input exists;
- transform shape is valid;
- transformed values satisfy declared primitive OpenAPI schema constraints where representable;
- compiled request remains on the contract-derived execution hostname.

At most one procurement-planner repair call is allowed for planner-contract or static-validation failure. No repair or provider substitution is allowed after live execution failure.

## Live execution and output induction
- GET only.
- HTTPS only.
- public DNS only.
- no redirects followed.
- bounded timeout and response size.
- JSON response required.

After a successful live JSON response, MISSING deterministically searches response object nodes for the frozen required output leaves and chooses a projection that satisfies the frozen semantic validator for the build input. The planner does not emit JSON paths.

The exact projection is persisted into the recipe. Replay may **not** re-induce output paths.

## Persisted recipe
A successful recipe must persist at least:

- case id;
- registry API key/provider descriptor;
- live specification URL and specification fingerprint;
- contract-derived execution base URL and allowed hostname;
- exact GET operation path;
- typed parameter bindings and the relevant declared parameter schemas;
- deterministic output projection paths;
- discovery descriptor fingerprint;
- recipe fingerprint.

## Replay
Each persisted recipe is replayed on the frozen different input.

Replay must use only the persisted recipe. During replay:

- registry fetch calls = 0;
- specification fetch calls = 0;
- discovery planner calls = 0;
- procurement planner calls = 0;
- output projection induction calls = 0.

Replay still performs the live GET request and the same semantic validator.

## Frozen active negative controls
Every control must be executed through the same predicate/compiler used by the formal pipeline; no synthetic constant `rejected:true` counts.

1. non-HTTPS execution base is rejected;
2. IP-literal execution host is rejected;
3. auth-required operation is rejected as not publicly executable;
4. operation absent from the selected live contract is rejected;
5. undeclared bound parameter is rejected;
6. missing required path/query parameter is rejected;
7. `DIRECT` binding to a missing input field is rejected;
8. `SPLIT` with out-of-range index is rejected;
9. unsupported transform kind is rejected;
10. semantic output whose identity does not match the input is rejected;
11. recipe with empty specification or recipe fingerprint does not count as fingerprint evidence.

## Frozen GO gates
Formal decision is `GO_AUTONOMOUS_DISCOVERY_TO_EXECUTION` only if all of the following hold in the fresh run:

- live APIs.guru registry fetched and parsed successfully;
- live registry contains at least 1,000 API entries;
- zero case-to-provider/specification/operation mappings exist in frozen cases;
- at least 2 distinct cases discover a live OpenAPI/Swagger contract and exact GET operation;
- at least 2 distinct discovered registry API keys/providers reach public execution readiness;
- at least 2 distinct cases compile statically valid typed binding programs;
- at least 2 distinct providers execute live JSON successfully and pass frozen semantic validation;
- at least 2 recipes from distinct providers are persisted with non-empty specification, discovery-descriptor, and recipe fingerprints;
- 100% of persisted recipes replay successfully on the different frozen inputs;
- registry discovery calls during replay = 0;
- specification fetch calls during replay = 0;
- discovery planner calls during replay = 0;
- procurement planner calls during replay = 0;
- output projection induction calls during replay = 0;
- all 11 frozen negative controls are verified as executed and rejected;
- unknown/absent operations accepted = 0;
- undeclared parameters accepted = 0;
- invalid typed bindings accepted = 0;
- unsupported transforms accepted = 0;
- auth-required operations executed = 0;
- non-GET operations executed = 0;
- host-policy violations accepted = 0;
- redirects followed = 0;
- credentials supplied = 0;
- arbitrary code executed = 0.

Otherwise the formal decision is `REASSESS_AUTONOMOUS_DISCOVERY_TO_EXECUTION`.

No threshold may be relaxed after execution.

## Interpretation boundary
A GO would demonstrate an end-to-end bounded cycle:

`capability intent → registry-wide discovery → live contract acquisition → exact operation selection → public-readiness gate → typed binding synthesis → live execution → semantic validation → persisted recipe → different-input zero-discovery/zero-LLM replay`.

It would still **not** demonstrate unrestricted open-web discovery, arbitrary websites without machine-readable contracts, universal API adaptation, paid/commercial procurement, credential acquisition, economic provider selection, or autonomous payment/revenue.