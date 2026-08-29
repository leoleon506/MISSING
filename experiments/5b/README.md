# Experiment 5B — Request-First Response-Grounded Projection + Entity-Coupled Validation

## Status

This file MUST be the first 5B-specific commit. Experiment 5B is a **development experiment** informed by the completed 5A holdout. It does not alter, reinterpret, rerun, or overwrite the formal 5A result.

The 18 cases consumed by 5A are now development evidence. Any improvement on them is not evidence of fresh generalization. A later experiment must use a new preregistered holdout before making a generalization claim.

## Frozen baseline and evidence

Repository baseline for 5B:

- `main` SHA: `03d0ec9fcf50b3ba72f98b99130c301044383a56`
- frozen 4W engine SHA used by 5A: `a0ae7506df5c9be386e8be6a72fce8526aca1e11`
- valid 5A workflow run: `33229957277`
- 5A artifact: `9708309397`
- artifact digest: `sha256:566c7c9193b1f79954010e34a15c0d1b6baf3be9a600987b0f32ca7c68180f39`
- 5A report fingerprint: `ed8de3859f3b738395734e64175ee9f63847f4fd64adafa482c5b0b440be7a7f`
- 5A decision: `REASSESS_5A_BLIND_GENERALIZATION_HOLDOUT`

Formal 5A result:

- 4 / 18 successful manufactures (22.22%)
- 4 successful semantic families
- 4 distinct successful provider hosts
- 4 persisted recipes
- 4 / 4 changed-input replays = 100%
- total LLM cost USD 0.1723284
- mean LLM cost per formal success USD 0.0430821
- median successful latency 50,444 ms
- p90 successful latency 82,087 ms
- 0 auth-like rendered requests
- 0 known-auth probe attempts
- 0 wrong-task probe attempts
- 0 entity-incompatible structural probe attempts
- 0 request-origin drift or confirmed request mutation rejects
- 0 external OpenAPI reference fetches
- 0 validator graph mismatch rejects
- 0 duplicate probe/acquisition/spec network fetches

The four formal 5A successes were:

- `pokemon_name_metadata`
- `english_word_definition_metadata`
- `public_domain_book_metadata`
- `satellite_catalog_metadata`

Post-hoc development diagnosis, which MUST NOT change the formal 5A decision: `public_domain_book_metadata` was accepted with an input-derived `id` while the projected title came from an unrelated search-result entity. Therefore 5B adds a generic entity-coupling requirement. The treatment must reject the generic failure pattern; runtime code MUST NOT contain a special rule for that case, Crossref, Gutenberg, or any provider/domain.

## Development workload

5B reuses the exact frozen 18-case registry and build/replay inputs from `src/experiment5aCore.ts` solely as a development workload.

The 5B runner MUST NOT change any 5A case, family label, task intent, build input, replay input, required output, or original semantic validator.

A 5B success requires both:

1. the existing 5A semantic validator; and
2. the new generic entity-coupling validation described below.

Because this is development data, 5B performance is diagnostic/engineering evidence only. A later fresh holdout is required.

## Hypothesis

5A showed that discovery frequently reached plausible or correct providers, while failures concentrated after provider selection in request/operation choice, response observation, semantic projection, and contract validation.

The primary hypothesis is:

> If MISSING ranks safe executable operations using required-output coverage, permits a fully bound semantically compatible GET request to be probed before the final projection is known, resolves output roles only against fields actually observed in that successful response, requires the projected outputs to belong to the same response entity that is demonstrably tied to the input, and continues to the next bounded operation candidate when a 2xx response is unusable, then it will recover at least the original 5A generalization threshold on the 18-case development workload without weakening safety, replay, cost, or mutation guards.

## Treatment A — Output-aware operation ranking

Operation ranking occurs only after request feasibility and task-operation semantic compatibility pass.

For each required output role, derive provider-blind semantic role tokens from:

- output role name;
- task intent;
- operation response property names;
- response property titles/descriptions;
- enclosing schema titles/descriptions;
- operation response descriptions.

Generic structural tokens such as `id`, `identifier`, `code`, `name`, `value`, `data`, `result`, `response`, `item`, `object`, and `string` MUST NOT alone count as distinctive output support.

The ranking score may reward:

- number of required output roles with documented response support;
- exact/strong output-role support;
- request binding confidence;
- distinctive task-operation anchors;
- request simplicity.

It MUST NOT use:

- provider names or domains;
- benchmark case IDs;
- build/replay values;
- expected answers;
- runtime response values before the probe.

Metrics include at least:

- `outputCoverageCandidates5b`
- `outputRolesDocumented5b`
- `outputRolesUnsupported5b`
- `operationsRankedByOutputCoverage5b`
- `operationsRejectedNoOutputSupport5b`

## Treatment B — Request-first safe probing

A native/request-derived operation may be probed before a complete projection exists only when all of the following are already true:

- GET only;
- same-provider / allowed origin rules unchanged;
- no required auth credential;
- no auth-like required path/query/header/cookie/body slot;
- no request body;
- all required request slots are bound to inputs or a single deterministic documented literal;
- no unresolved required server variable;
- task-operation distinctive semantic gate passes;
- request origin/path/bindings/literals are frozen before execution.

Projection completeness is NOT a prerequisite for the probe.

A successful transport response is evidence only; it is not itself a recipe.

Metrics include:

- `requestFirstEligible5b`
- `requestFirstProbeCalls5b`
- `requestFirstTransport2xx5b`
- `requestFirstStructured2xx5b`
- `requestFirstUnusable2xx5b`
- `requestFirstConfirmedRecipes5b`

## Treatment C — Response-grounded closed-world projection

After a successful structured response, construct a finite candidate set exclusively from paths actually observed in that response.

Candidate metadata may include:

- observed path;
- leaf/property name;
- observed primitive type;
- matched OpenAPI/JSON-schema property name if available;
- schema title/description if available;
- enclosing documented schema name/description if available.

The schema-role resolver MUST NOT receive runtime field values, provider/domain identity, benchmark case ID, expected answer, or replay value.

The resolver may output only:

- a verbatim `observed_path` from the supplied candidate list; or
- `NO_VALID_SOURCE`.

It may not generate a value, literal, URL, provider, path not in the list, transformation code, or new request.

Every accepted mapping is frozen into a response-role witness and must be revalidated on replay without an LLM call.

Metrics include:

- `responseGroundedCandidateFields5b`
- `responseGroundedResolverCalls5b`
- `responseGroundedMappingsAccepted5b`
- `responseGroundedInventedPathRejects5b`
- `responseGroundedValueGenerationRejects5b`
- `responseGroundedConfirmedRecipes5b`
- `responseGroundedReplayUses5b`
- `responseGroundedReplayLlmCalls5b`

## Treatment D — Entity-coupled validation

This treatment prevents an input-derived output from being combined with an arbitrary result entity.

### Input-response witness

For each build input, inspect the successful response only after the request has executed. An input-response witness may be established when an observed primitive field in the response has one of these deterministic relations to the input:

- exact normalized string equality;
- exact numeric equality;
- case-insensitive equality;
- normalized URL/resource identifier containing the complete input identifier;
- composite identifier containing all complete input components when the task itself has multiple identifier/name components.

Substring matching of short/generic tokens is forbidden.

### Entity scope

For a selected projected response field, derive its response entity scope as:

1. the nearest enclosing array-row/object instance containing that selected field; otherwise
2. the singleton response object/root when no repeated row exists.

For every recipe that projects one or more non-input fields, at least one input-response witness relevant to the task must occur inside the same entity scope as those projected fields, or in an ancestor singleton object that uniquely contains that entity and no sibling result rows.

A query-echo/metadata field outside the selected result row does NOT couple an arbitrary first result to the input.

If a required identity output is projected directly from `INPUT`, the entity-coupling witness is mandatory.

The frozen witness records paths and relation types, not benchmark answer values.

Replay MUST verify the same relation using the changed replay input and current replay response before accepting projection output.

Metrics include:

- `entityCouplingCandidates5b`
- `entityCouplingWitnesses5b`
- `entityCouplingValidationSuccesses5b`
- `entityCouplingRejects5b`
- `inputDerivedOutputCouplingRejects5b`
- `crossEntityProjectionRejects5b`
- `entityCouplingReplaySuccesses5b`
- `entityCouplingReplayRejects5b`

## Treatment E — Bounded candidate continuation

4W probed at most the top native operation candidate. 5B may continue to one additional safe operation candidate for the same provider only when the first candidate:

- is non-2xx;
- is non-structured;
- is a semantic error envelope;
- cannot resolve all required output roles from the observed response; or
- fails entity-coupled validation.

Maximum request-first/native operation probes per provider in 5B: **2**.

The second candidate must independently pass all request feasibility, auth, same-provider, semantic-anchor, frozen-request, and mutation guards. It cannot be a mutated form of the first request manufactured after seeing the body.

The global provider-attempt limit remains 8 per case. Documentation depth/pages/bytes remain unchanged from 5A. No third operation probe is allowed.

Metrics include:

- `candidateContinuationEligible5b`
- `candidateContinuationAttempts5b`
- `candidateContinuationSecondProbe5b`
- `candidateContinuationRecoveredRecipes5b`
- `candidateContinuationBudgetRejects5b`

## Treatment F — Inherited recipes are also entity-coupled

The inherited 4S/4W lane still runs first.

An inherited COMPILE result is not automatically accepted by 5B. Before persistence it must pass the generic entity-coupling check using its already observed successful probe proof.

If it fails entity coupling, it is treated as an unusable candidate and the 5B request-first lane may run. This does not mutate the inherited request or projection and does not retroactively change the 5A result.

## Negative controls

Provider-neutral tests MUST reject at least:

1. `id = INPUT(x)` plus `title = first_result.title` when the first result row has no response field tied to `x`;
2. a response-level query echo equal to the input plus an unrelated array-row output;
3. output mapping to an observed path not present in the closed candidate set;
4. resolver-generated literal/value;
5. two response rows where the input echo is in row 0 but selected output is from row 1;
6. a generic `id`/`name` operation with no distinctive task support;
7. a required auth/API-key operation;
8. cross-provider server origin;
9. request origin/path/input/literal mutation after frozen request proof;
10. a third request-first operation probe for the same provider.

No negative control may contain a 5A provider domain, a 5A case ID, or a benchmark expected answer.

## Positive controls

Provider-neutral tests MUST accept at least:

1. singleton response `{name: INPUT, id, height}` with all selected outputs in the singleton entity;
2. array response where `rows[0].key == INPUT` and selected outputs are in `rows[0]`;
3. nested array response where identity and output are in the same row;
4. multi-input composite identity represented by one response field such as `owner/repository`;
5. a fully bound safe GET request with incomplete pre-probe projection;
6. a first 2xx unusable response followed by one independently preregistered/ranked safe second operation that produces a valid entity-coupled response;
7. replay with changed input where the frozen witness path remains valid and relation re-verifies without LLM.

## Runtime prohibitions

No new 5B runtime file may contain:

- a provider domain or endpoint seed for a development case;
- a 5A case-specific conditional;
- build or replay benchmark answer values;
- a special rule for books, DNS, chess, CVEs, packages, countries, IPs, repositories, or any other workload entity family;
- a weakened auth, same-origin, mutation, semantic-grounding, external-reference, replay, or safety gate.

## Frozen development budget

The workload and base budgets remain:

- cases: 18
- provider attempts per case: 8
- documentation pages per provider: 8
- documentation depth: 2
- max document bytes: 4 MiB
- maximum request-first/native operation probes per provider: 2
- model: `gpt-4.1-mini-2025-04-14`
- max total LLM cost: USD 3.00
- max mean LLM cost per strict success: USD 0.15
- max median strict-success latency: 90 seconds
- max p90 strict-success latency: 180 seconds

No replay discovery, reranking, documentation acquisition, synthesis, or schema-role LLM calls are allowed.

## Primary treatment success

5B is GO only if ALL of the following hold on the 18-case development workload:

1. at least **6 / 18 strict entity-coupled manufactures**;
2. at least **6 semantic families** have a strict success;
3. at least **6 distinct successful provider hosts**;
4. every strict success persists a recipe;
5. changed-input replay succeeds for at least 95% of strict recipes;
6. every persisted recipe passes entity-coupled validation at build and replay;
7. at least **2 recipes** are confirmed through the 5B request-first/response-grounded treatment lane rather than merely inherited unchanged;
8. at least **1 persisted recipe** uses a closed-world response-grounded role witness;
9. response-grounded replay performs **0 LLM calls**;
10. no auth-like request is rendered or probed;
11. no known-auth endpoint is probed;
12. no wrong-task/entity-incompatible structural probe is executed;
13. no confirmed request origin/path/input/literal binding is mutated;
14. no external OpenAPI reference is fetched;
15. no invented response path or generated output value is accepted;
16. no cross-entity projection is accepted;
17. `validatorGraphMismatchRejects == 0`;
18. duplicate probe/acquisition/spec network fetch regressions remain zero;
19. request-first probes never exceed 2 for a provider;
20. total and mean LLM cost remain within budget;
21. median and p90 strict-success latency remain within budget;
22. all 18 cases complete reranking and evaluation.

The target `>= 6 / 18` is the original 5A generalization threshold. 5B is not permitted to lower it because the development workload is now known.

## Decision strings

- `GO_5B_REQUEST_FIRST_RESPONSE_GROUNDED_ENTITY_COUPLED`
- `REASSESS_5B_REQUEST_FIRST_RESPONSE_GROUNDED_ENTITY_COUPLED`

## Execution rule

Implementation and CI may run unit/integration controls but MUST NOT run the live 5B benchmark from the PR.

After merge to `main`, run manually:

`Run MISSING Experiment 5B`

A future fresh holdout (5C or later) is required before claiming restored generalization.
