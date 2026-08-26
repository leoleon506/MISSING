# MISSING Experiment 3Q — Registry-Wide OpenAPI Source Discovery

## Status
Preregistered before implementation and before benchmark execution.

## Relationship to 3P2R
3P2R certified bounded contract-aware procurement when MISSING was given a frozen three-spec candidate index. 3Q isolates the next upstream uncertainty: **source discovery itself**. It intentionally does not re-test live capability execution or typed request compilation, which are already covered by 3P2R. If 3Q reaches GO, a later experiment may integrate `discovery → procurement → execution → recipe → replay` end-to-end.

## Frozen question
Can MISSING, given only a capability intent, input names, required output leaf names, and one live machine-readable registry of public API definitions, discover a relevant live OpenAPI/Swagger contract and exact GET operation **without any case-to-provider mapping, provider id, provider URL, specification URL, or operation path being prewired into the cases**?

## Frozen discovery substrate
The only remote discovery root supplied to the benchmark is:

`https://api.apis.guru/v2/list.json`

The live APIs.guru directory is treated as a broad bounded discovery universe, not as an approved execution catalog. Candidate provider keys and specification URLs must be obtained from the live registry response during the run.

No case may contain a provider name, registry API key, API hostname, specification URL, execution hostname, or expected operation path.

## Frozen cases

### Case A — public source-code repository metadata
Intent: Given an owner and repository name on a public source-code hosting service, identify a machine-readable API operation that can return the repository's canonical full name, star count, and primary language.

Build input names: `owner`, `repo`.

Required output leaf names: `full_name`, `stargazers_count`, `language`.

### Case B — fantasy role-playing ability-score metadata
Intent: Given a tabletop fantasy role-playing ability-score identifier such as `cha`, identify a machine-readable API operation that can return the canonical short index, abbreviated name, and full display name.

Build input name: `ability_index`.

Required output leaf names: `index`, `name`, `full_name`.

### Case C — currency metadata
Intent: Given a canonical currency identifier such as `usd`, identify a machine-readable API operation that can return canonical currency code and human-readable currency name.

Build input name: `currency_id`.

Required output leaf names: `code`, `name`.

The case texts deliberately describe capabilities rather than vendors.

## Frozen discovery procedure

1. Fetch the live APIs.guru `list.json` over HTTPS with bounded timeout/size, no redirects, no credentials, and public-DNS enforcement.
2. Flatten the live registry to one current/preferred specification record per API key where possible. Candidate URLs must come from fields returned by the live registry.
3. Deterministically score registry metadata against each case and retain at most the top 60 registry records per case.
4. Fetch and parse at most the top 20 unique candidate specifications per case, subject to the same network policy. JSON OpenAPI 3.x and Swagger/OpenAPI 2.0 are eligible. A fetched document that is not OpenAPI/Swagger does not count.
5. Fingerprint each successfully parsed live specification and extract its exact GET operations, path/query parameters, operation text, and response-schema property names.
6. Deterministically score operations against case intent, input names, and required output names. Present at most 24 bounded operation candidates to the planner.
7. The planner may choose only an opaque `candidate_id` from the supplied live candidates or return `REJECT`. It may not emit a URL, hostname, provider id, operation path, code, credentials, or headers.
8. Deterministically reject any selected id not present in the supplied candidate set. A successful discovery requires the selected candidate to be backed by a specification fetched live in that same run, an exact GET operation extracted from that specification, non-empty specification fingerprint evidence, and non-zero deterministic input/output compatibility evidence.
9. Persist a discovery descriptor containing registry API key, live specification URL, specification fingerprint, exact GET operation path, and evidence summary.
10. Freshly revalidate every persisted descriptor by re-fetching its stored specification URL and confirming that the fingerprint still matches and the selected GET operation still exists. Revalidation makes zero registry-discovery calls and zero planner calls.

The registry retrieval algorithm, candidate caps, cases, and GO gates are frozen before benchmark execution.

## Planner contract
The planner receives only the case and the bounded candidates derived from live registry contracts. It returns a strict flat object:

- `case_id`
- `decision` = `DISCOVER` or `REJECT`
- `candidate_id`
- `reason`

At most one repair call is allowed for response-contract failure. A repair cannot change the candidate set or any frozen gate.

## Network and safety policy

- HTTPS only.
- IP literals rejected.
- DNS must resolve only to public addresses.
- Redirects are not followed.
- Bounded timeout and bounded response size.
- No cookies, API keys, Authorization headers, credentials, or arbitrary request headers.
- Discovery fetches only machine-readable registry/specification resources; 3Q does not execute discovered business/API operations.
- No arbitrary code, shell, `eval`, dynamic imports, plugins, or generated JavaScript.

## Frozen active negative controls
All controls must be **executed through the same validation predicates used by the formal gate**, not represented by synthetic `rejected:true` constants.

1. non-HTTPS specification URL is rejected;
2. IP-literal specification URL is rejected;
3. non-OpenAPI JSON cannot become a live contract;
4. selected `candidate_id` absent from the planner's presented candidate set is rejected;
5. selected operation absent from the freshly parsed contract cannot become a descriptor;
6. registry metadata without a successfully fetched live specification cannot count as discovery evidence;
7. empty `spec_fingerprint` cannot count as fingerprint evidence;
8. a non-GET operation cannot become a discovery descriptor.

## Frozen GO gates
Formal decision is `GO_REGISTRY_WIDE_OPENAPI_SOURCE_DISCOVERY` only if all of the following hold:

- the live APIs.guru registry is fetched and parsed successfully;
- the live registry contains at least 1,000 API entries, preventing a tiny hidden-catalog interpretation;
- the frozen cases contain zero provider ids, provider names, API hostnames, specification URLs, or expected operation paths;
- at least 2 distinct cases discover a live OpenAPI/Swagger specification and exact GET operation;
- successful cases span at least 2 distinct registry API keys/providers;
- every successful discovery is backed by a specification fetched live and fingerprinted during the same run;
- every successful discovery has positive deterministic compatibility evidence for at least one input name and at least one required output leaf name;
- at least 2 discovery descriptors are persisted;
- 100% of persisted descriptors pass fresh specification revalidation;
- planner calls during descriptor revalidation = 0;
- live registry discovery calls during descriptor revalidation = 0;
- all eight frozen negative controls are verified as executed and rejected;
- unknown candidate ids accepted = 0;
- unknown operations accepted = 0;
- non-GET operations accepted = 0;
- host-policy violations accepted = 0;
- redirects followed = 0;
- credentials supplied = 0;
- arbitrary code executed = 0;
- fingerprint evidence is non-vacuous: at least 2 persisted descriptors have non-empty live specification fingerprints.

Otherwise the formal decision is `REASSESS_REGISTRY_WIDE_OPENAPI_SOURCE_DISCOVERY`.

No threshold may be relaxed after execution.

## Interpretation boundary
A GO would establish **bounded registry-wide source discovery** over a live directory containing at least 1,000 API entries. It would show that MISSING can move from a capability request to a relevant live machine-readable contract and exact GET operation without a small prewired provider/specification catalog.

It would **not** establish unrestricted open-web discovery, authoritative provider identity, arbitrary API integration, live execution of the newly discovered operation, universal schema adaptation, paid/commercial procurement, or autonomous economic selection. Those remain separate hypotheses.