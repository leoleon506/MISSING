# Experiment 4A-P1 — Active Schema Induction

## Status
Development/recovery only over the already-burned 4A workload. No fresh blind holdouts are consumed.

## Frozen parent evidence
- 4A-R7 merge SHA: `c152a2370ec3640f85e54f435980208f934baef8`
- 4A-R7 run: `33077407071`
- job: `98535133147`
- artifact: `9650003904`
- artifact digest: `sha256:c2406e85e2cba0a5b909266b788d6125260ea8e3d41159d4cf76083bb004a8a9`
- report fingerprint: `7245bbeffce545eefa33b0b8e54cac46c0749fa37ff4e7b4d4ceeb82655dbeb8`
- ledger fingerprint: `4951327d1aeea30fae590350c1fbd762d07952364733297d07246c1800d805b4`
- ledger events: `5180`

## Frozen R7 outcome
- 24 cases / 8 families
- 2 successful manufactures / 1 successful family
- 2 distinct providers / 2 recipes
- 2/2 changed-input replay = 100%
- median success latency 51.990s / p90 59.575s
- total LLM cost `$0.3311588`
- mean LLM cost/success `$0.1655794`
- 69 LLM calls
- 2,406 doc fetches / 1,461 spec probes
- 163 synthesis attempts / 0 repairs / 17 live calls
- 42/42 controls; event-derived safety clean

## Frozen diagnosis before P1
R7 removed numeric-index corruption and prevented mechanically impossible requests from reaching live execution, but breadth stayed at 2/24 and only 1/6 R4-demonstrated capabilities was recovered.

Observed frozen failure classes:
1. Provider discovery/ranking was usually not the dominant problem: npm Registry, Open Food Facts, TheCocktailDB, Genderize, Metropolitan Museum, and NHTSA remained high-ranked candidates.
2. R7 inherited request/response inventory from the R6R documentation compiler. Many real APIs exposed enough documentation to identify a safe request but not enough local documentation to prove all response fields.
3. 118/163 synthesis attempts had no mechanically feasible operation under documentation-only response proof.
4. The documentation-only architecture therefore discarded potentially valid safe requests before observing what they actually returned.
5. R7 stable IDs and input-influence checks worked and must remain.
6. R7 still allowed semantically weak request-slot candidates when lexical overlap was zero; P1 must tighten request hypothesis generation rather than loosen it.

## P1 hypothesis
For anonymous HTTPS GET APIs, public documentation should be required to prove the **request**, while a bounded, safety-checked observation of the real build-input response may serve as evidence for the **response schema**.

A safe request hypothesis that is sufficiently grounded to execute, but lacks documented response proof, can be probed once. If the probe returns successful JSON, the observed JSON structure becomes immutable evidence for response-field selection. The resulting recipe must then pass an independent confirmation live call and unchanged-input semantic validation, followed by the existing changed-input zero-cognition replay.

This is not live-response repair. The probe is a preregistered evidence-acquisition stage that occurs before a recipe exists.

## P1 architecture

```
public documentation/spec
        ↓
documented request hypothesis
        ↓
request feasibility + safety gate
        ↓
SAFE PROBE GET using frozen build input
        ↓
observed JSON evidence + schema fingerprint
        ↓
stable-ID response field inventory
        ↓
semantic mapping / deterministic fast path
        ↓
contract validation
        ↓
independent confirmation live call
        ↓
semantic validation
        ↓
persist recipe
        ↓
changed-input zero-cognition replay
```

## 1. Request proof remains documentation-only
A probe may execute only when documentation/spec evidence proves:
- exact HTTPS origin;
- exact GET path/template;
- exact documented path/query parameter names;
- exact documented literals if used;
- exact binding of every frozen task input to a documented request slot;
- no required credential/authentication parameter;
- no private/local/link-local IP destination;
- no credential-bearing URL;
- no unsafe redirect or cross-origin mutation under existing guards.

The probe may **not** invent URLs, paths, parameter names, literals, headers, credentials, or authentication state.

## 2. Tight request-input correspondence
P1 may not fall back from zero lexical/structural input overlap to arbitrary request parameters.

An input slot is eligible only when at least one generic, provider-blind signal exists:
- normalized token overlap between task input name and documented parameter name;
- exact documented placeholder/example relation mechanically linking the build input value to that parameter;
- a single non-auth variable request slot in an otherwise fixed documented operation when the task has exactly one input.

No provider-, case-, domain-, or workload-specific synonym map is allowed.

This specifically prevents mappings such as `vin -> make`, `registration -> domain`, or `object_id -> tags` merely because those are the only available slots.

## 3. Probe budget and isolation
- At most **one probe per request hypothesis**.
- At most **3 probe hypotheses per provider attempt**.
- At most **8 provider attempts per case**, unchanged.
- Probe uses only the frozen build input.
- Probe is anonymous HTTPS GET only.
- Probe uses the existing fetch timeout/byte caps and DNS/redirect/private-host guards.
- Probe response is not a recipe verification call.
- Probe bodies are never used to modify the request hypothesis.
- A failed probe cannot trigger request repair, URL mutation, parameter mutation, alternate literals, or credential addition.

## 4. Probe success requirements
A response may become schema evidence only if:
- HTTP status is 2xx;
- final URL remains within the allowed request scope;
- content parses as JSON;
- body respects frozen byte limits;
- parsed JSON is non-null and structurally enumerable;
- the response is not an obvious authentication/configuration/error envelope according to generic status/error signals when the task requires substantive outputs.

Persist the exact response-body fingerprint and structural schema fingerprint. The probe body itself may be persisted in the experiment artifact for audit but never in a persisted replay recipe.

## 5. Observed response schema induction
From successful probe JSON, deterministically enumerate exact response paths up to the existing safe structural depth/field caps.

Each observed field receives a stable ID derived from:
- request hypothesis ID;
- exact response path;
- probe response fingerprint.

The LLM cannot author a response path; it may only choose supplied stable field IDs.

## 6. Build-value relation as evidence, not as semantic truth
P1 may record generic relations between the frozen build input and observed JSON values, such as:
- exact scalar equality;
- normalized string equality;
- exact numeric equality;
- array containment of an exact scalar.

These relations may strengthen candidate ranking for echo/identifier fields but may not by themselves prove unrelated semantic meaning.

No case-specific value table or provider-specific resolver is allowed.

## 7. Semantic mapping after observation
First use deterministic lexical/camel/snake/kebab matching over observed field paths.

If ambiguity remains, at most one temperature-0 structured LLM call may select:
- one exact request hypothesis ID from the probed successful finite set;
- exact stable response field IDs;
- exact `TASK_INPUT:<name>` echoes where allowed.

The LLM cannot author request facts or response paths and cannot emit numeric indices.

## 8. Post-mapping verification
Before confirmation live:
- selected request hypothesis must be exactly one that was probed successfully;
- all task inputs must influence the request;
- all required request parameters must remain bound;
- every selected response field must have been observed in that exact probe;
- required outputs must be covered exactly once;
- the same response field cannot satisfy semantically distinct required outputs;
- no authentication/private-host/scope safety invariant may have changed.

## 9. Independent confirmation live call
After response mapping, execute the same documented request again with the same frozen build input as an **independent confirmation**.

The confirmation succeeds only if:
- request compiles identically from the same documented facts;
- response is successful JSON;
- selected response paths still exist;
- projected output passes unchanged 4A semantic validation.

The probe itself never counts toward double-live verification. Existing runner verification may provide the second confirmation call if already frozen to two independent live verifications after contract manufacture; otherwise P1 must preserve at least two post-mapping successful live observations before recipe persistence.

## 10. Replay remains zero cognition
Persist only the final documented request recipe and exact stable projection paths after successful confirmation. Do not persist the probe body.

Changed-input replay remains exactly zero cognition:
- no catalog fetch;
- no reranking;
- no documentation fetch;
- no schema probe;
- no synthesis call.

## 11. Probe attribution
Persist for every probe:
- case/provider IDs;
- request hypothesis ID/fingerprint;
- exact documented evidence IDs/source URLs;
- compiled request fingerprint with secrets impossible by construction;
- HTTP status/content type/final URL;
- response body fingerprint;
- induced schema fingerprint;
- observed response path count;
- generic build-value relations;
- probe disposition/reject reason;
- confirmation disposition;
- replay disposition.

Add experiment metrics:
- `schemaProbeCalls`;
- `schemaProbe2xxJson`;
- `schemaProbeRejected`;
- `schemaProbeBytes`;
- `probeDerivedContracts`;
- `probeConfirmedContracts`.

## 12. Formal safety distinction
Documentation/spec evidence is authoritative for the **request surface**.
Observed safe-probe JSON is authoritative only for the **response shape of that exact documented request**.

A response can never authorize a new request mutation.

## Engineering recovery gate
P1 must recover at least **5 of the 6 capabilities demonstrated successful by R4** on the same burned 4A workload, without embedding those providers/cases/endpoints in implementation.

Additional diagnostic requirements:
- >=5 successful manufactures overall;
- >=4 successful families;
- >=95% changed-input replay;
- zero replay cognition deltas;
- zero numeric-index decisions by construction;
- zero request mutation from probe responses;
- zero probe/live calls without complete input influence;
- zero probes with required auth parameters;
- 42/42 controls and event-derived safety clean;
- at least one successful recipe whose response projection was induced from observed JSON rather than documentation response proof;
- total LLM cost <= `$0.60` preferred;
- mean LLM cost/success <= `$0.15` preferred.

Failure to recover >=5/6 R4-demonstrated capabilities is evidence against continuing incremental documentation/probe variants; do not automatically proceed to P1R/P1R2.

## Frozen unchanged
- exact 24 cases / 8 families and frozen build/replay values
- R2 top-120 provider frontier
- R5 deterministic provider reranker/order
- max 8 provider attempts per case
- existing documentation crawl depth/byte limits
- anonymous HTTPS GET only
- existing DNS/private-host/redirect/cross-domain/credential/header safety controls
- 4A semantic validators
- 3X projection execution semantics
- post-manufacture live verification discipline
- changed-input zero-cognition replay
- 42 controls
- original 4A formal gates
- fixed model `gpt-4.1-mini-2025-04-14`
- no credential/header synthesis

## Forbidden
- provider/domain/case/endpoint-specific maps or regexes
- curated providers or hand-authored recipes
- workload-specific synonym maps
- search-engine/API-directory expansion
- expanding R2 top-120 or max-8 provider attempts
- fresh blind holdouts
- weakening semantic/safety/replay gates
- using probe response content to mutate request URL/path/query/headers
- retries that alter the request after a failed probe
- credentials, API keys, auth headers, cookies, POST/PUT/PATCH/DELETE
- LLM-authored URLs/paths/parameter names/literals/response paths
- LLM numeric indices
- treating non-2xx, non-JSON, auth/error responses as schema proof

## Original formal 4A gates
Remain authoritative:
- >=12/24 successful manufactures
- >=6/8 successful families
- >=8 distinct provider hosts
- all persisted recipes verified by the frozen live discipline
- >=95% changed-input replay
- zero replay cognition deltas
- 42/42 controls
- event-derived safety clean
- median success latency <=90s
- p90 success latency <=180s
- mean LLM cost/success <=$0.15
- total LLM cost <=$3.00

Formal decision:
- `GO_4A_P1_ACTIVE_SCHEMA_INDUCTION`
- otherwise `REASSESS_4A_P1_ACTIVE_SCHEMA_INDUCTION`

A formal GO remains engineering-recovery evidence only. Fresh blind breadth validation is still required afterward.
