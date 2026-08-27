# Experiment 4F — Documentation IR + API Operation Graph

## Status
Preregistered engineering-recovery experiment over the already-burned 4A workload. No fresh blind holdout is consumed.

This README MUST be the first commit on the 4F branch.

## Frozen base
- 4E merge SHA: `7a3473bf4f04862314660703c54cfd7ef5652632`
- 4E workflow: `Run MISSING Experiment 4E`
- workflow run: `33122167993`
- job: `98691468103`
- event: `workflow_dispatch`
- artifact: `9667627854`
- artifact digest: `sha256:af58ff021c098ed3b042a7c98a5e8d7658150d3da43ad7eb5df39f81600e99bd`
- decision: `REASSESS_4E_DOM_NATIVE_OPERATION_CORRESPONDENCE`
- report fingerprint: `c9cb9f459b3aefcbdf820d96ade8bf4a97268f82c78a85a9e701963bf0a1c4a2`
- ledger fingerprint: `627e2d606d97cc2ad334c21dc166d33f3bc96fe1ee9d330e48463670300b9e4f`
- ledger events: `4990`
- fixed model: `gpt-4.1-mini-2025-04-14`

## Frozen 4E outcome
- 24 cases / 8 families
- 3 successful manufactures / 2 families / 3 providers / 3 recipes
- replay 3/3 = 100%
- R4 capability recovery: 2/6 (`npm Registry`, `Genderize.io`)
- successful cases: npm Registry, Agify.io, Genderize.io
- 158 synthesis attempts
- 102 `noOperationEvidence` attempts
- 51 `operationEvidenceUnusable` attempts
- `(102 + 51) / 158 = 96.8354%` of attempts died before a usable operation
- 11,313 DOM scopes parsed
- 1,936 request examples extracted
- 850 operations extracted
- 109 reference links discovered
- 30 actual reference expansion HTTP fetches
- 23 successful expansion fetches
- 23 evidence items added by expansion
- 442 auth-required operations rejected
- 420 operation-correspondence candidates
- 25 correspondence accepted
- 383 correspondence rejected
- 10 schema probes / 7 successful 2xx JSON / 3 rejected
- 3 probe-derived + 3 probe-confirmed contracts
- `baseRelativeLinksFormed = 0`
- `crossRegionJoinRejects = 819`
- `validatorGraphMismatchRejects = 0`
- `documentationOriginFallbacks = 0`
- `standaloneUrlPromotions = 0`
- reported `knownAuthProbeAttempts = 0`
- reported `wrongTaskProbeAttempts = 0`
- controls 42/42
- total LLM cost `$0.2286508`
- mean LLM cost/success `$0.0762169`

## Frozen forensic interpretation
4E established that real bounded reference acquisition, DOM/code extraction, task-operation gating, and response schema induction can coexist without provider-specific seeds. It also recovered npm and the two simple anonymous name APIs. However, 4E still failed the engineering gate because the dominant failure occurs before a stable operation representation exists.

The remaining ceilings are frozen as follows.

1. **Document interpretation remains local-string centric.** Base URLs, operation paths, parameter tables, auth notes, and examples may live in different but structurally related sections. 4E cannot reliably preserve those relations.
2. **Relative operation linking failed globally.** `baseRelativeLinksFormed = 0` despite known evidence where a relative operation and an explicit API origin coexist in the same API document.
3. **Reference expansion is no longer the principal missing mechanism.** 4E actually fetched 30 reference targets and added 23 evidence items, yet no successful recipe was derived from newly expanded evidence.
4. **The usable-operation bottleneck remained extreme.** 153/158 attempts (96.8354%) had no usable operation or unusable operation evidence.
5. **Auth accounting has a correctness hole.** At least three executed schema probes contained a query parameter named `key` and returned HTTP 401, while the aggregate reported `knownAuthProbeAttempts = 0`. The 4E implementation marks query slots `required:false` and rejects auth-like slots only when `required && auth_like`, so auth-like literals can reach a probe. 4F treats any auth-like material actually present in the rendered request as ineligible unless explicit evidence proves it optional and the anonymous request omits it.
6. **Provider ranking is not the primary issue.** The historical R4 targets were repeatedly selected in earlier experiments, but Open Food Facts, TheCocktailDB, Met, and NHTSA still failed before a usable canonical operation was available.

## 4F hypothesis
Before task matching or probing, MISSING must compile heterogeneous documentation into a stable, provider-blind **Documentation IR** that preserves structural scope and explicit relations. Request compilation should consume that IR rather than reinterpreting raw HTML/text independently.

The target abstraction is:

```text
DocumentIR
  Document
    Section*
      Heading*
      Paragraph*
      Link*
      CodeExample*
      ApiBase*
      AuthRequirement*
      ParameterDefinition*
      ResponseExample*
      Operation*
        method
        path / absolute URL
        local title / summary
        parameters
        examples
        auth evidence
        source range
        section ancestry
      Relation*
```

Then:

```text
raw docs/specs + expanded references
        ↓
DOCUMENTATION IR COMPILER
        ↓
PROVENANCE-PRESERVING API OPERATION GRAPH
        ↓
ANONYMOUS ELIGIBILITY
        ↓
TASK ↔ OPERATION CORRESPONDENCE
        ↓
GENERIC REQUEST TEMPLATE COMPILER
        ↓
SAFE GET SCHEMA PROBE
        ↓
OBSERVED RESPONSE MAPPING
        ↓
SAME-IR / SAME-GRAPH VALIDATOR
        ↓
double live verify → persist → changed-input zero-cognition replay
```

## Documentation IR invariants
1. Every IR node has an immutable source evidence ID and source range or structural locator.
2. HTML entities may be decoded mechanically; DOM/Markdown structure may be normalized but semantic content may not be invented.
3. Section ancestry is explicit. An operation can inherit an API base or auth requirement only through a deterministic relation allowed by the closed relation set below.
4. Multiple requests in one code block remain separate operation nodes.
5. Parameter definitions retain name, location, required/optional status when documented, example/default literals, local description, and auth classification.
6. OpenAPI operations and prose/code operations normalize into the same operation IR shape without provider-specific rules.
7. Response examples can support response mapping only; they may never repair request semantics.
8. Documentation origin is never an API origin by fallback.
9. No provider/domain/case literals are permitted in the compiler, linker, matcher, validator, or tests beyond synthetic fixtures.

## Closed relation set
4F may form only explicit deterministic relations:
- `SECTION_CONTAINS`
- `SECTION_PARENT`
- `OPERATION_HAS_PARAMETER`
- `OPERATION_HAS_EXAMPLE`
- `OPERATION_HAS_AUTH`
- `OPERATION_HAS_RESPONSE_EXAMPLE`
- `SECTION_DECLARES_API_BASE`
- `OPERATION_USES_API_BASE`
- `REFERENCE_EXPANDS_TO_DOCUMENT`
- `SOURCE_LOCAL_API_NAMESPACE`

`OPERATION_USES_API_BASE` is legal only when one of these is true:
1. API base and relative operation share the same structural section;
2. API base is declared in an ancestor section that structurally contains the operation;
3. an explicit API namespace/base declaration applies to sibling endpoint sections under one bounded API-reference parent section;
4. a reference-expansion provenance edge leads to a document with its own explicit base declaration and operation.

Arbitrary cross-document or cross-source host/path stitching is forbidden.

## Auth hard gate
Before any schema probe, 4F must inspect the **rendered request**, the operation node, parameter definitions, and inherited auth requirements.

Any of the following makes the operation ineligible unless explicit evidence proves the credential is optional AND the final anonymous rendered request omits it:
- `Authorization` header
- bearer token
- basic auth / `curl -u`
- OAuth/security scheme requirement
- API key/token/secret/client credential in header, query, path, cookie, or literal example
- parameter names matching provider-blind credential morphology such as `key`, `api_key`, `apikey`, `token`, `access_token`, `secret`, `client_secret`, `authorization`, `auth`

Hard requirements:
- `authLikeRenderedRequests = 0`
- `knownAuthProbeAttempts = 0`
- every rejected auth operation records the exact IR node(s) and reason
- the three 4E-style `...?key=<literal>` synthetic regression fixtures MUST be rejected before network execution

## Task ↔ operation correspondence
The 4E ban on `one input + one slot => bind` remains.

Every task input must be related to an operation parameter or unique documented concrete example using provider-blind evidence. Accepted relation evidence:
- normalized identifier equivalence (`object_id` ↔ `objectId`)
- lexical overlap between task input and parameter name/description
- exact build-value occurrence in a documented operation example with a unique replaceable position
- operation title/summary/section heading correspondence combined with parameter evidence
- OpenAPI parameter metadata attached to that exact operation

Generic `{id}` alone is insufficient.

No response field may influence task-operation selection or input binding.

## Reference expansion
4F preserves real bounded reference fetching from 4E, but each fetched document must be compiled independently into Documentation IR and connected by `REFERENCE_EXPANDS_TO_DOCUMENT`.

Required metrics distinguish:
- discovered reference links
- actual reference HTTP fetches
- successful fetches
- added evidence documents
- IR documents created from expansion
- operations created from expansion
- hypotheses created from expansion
- successful recipes whose request proof depends on expanded evidence

## Same-IR validator invariant
Planner and validator must reconstruct or consume an identical deterministic Documentation IR / operation graph fingerprint.

Successful contracts use:

`4F_DOCUMENTATION_IR:<operation_hypothesis_id>`

The validator rejects P1/4B/4C/4D/4E prefixes.

A successful contract must prove:
- exact operation node
- exact API base relation
- exact input bindings
- exact literal bindings
- absence of rendered auth material
- successful schema-probe fingerprints
- output projection only from observed fields or task-input echoes

## Required metrics
At minimum:
- `irDocuments`
- `irSections`
- `irOperations`
- `irParameters`
- `irApiBases`
- `irAuthRequirements`
- `irReferenceDocuments`
- `irOperationsFromReferenceExpansion`
- `operationApiBaseLinks`
- `ancestorApiBaseLinks`
- `sourceLocalNamespaceLinks`
- `relativeOperationsUnlinked`
- `authRequiredOperationsRejected`
- `authLikeRenderedRequests`
- `knownAuthProbeAttempts`
- `operationCorrespondenceCandidates`
- `operationCorrespondenceAccepted`
- `operationCorrespondenceRejected`
- `wrongTaskProbeAttempts`
- `noIrOperationAttempts`
- `irOperationUnusableAttempts`
- `requestHypotheses`
- `uniqueRenderedProbeUrls`
- `duplicateRenderedProbeUrlsRejected`
- `schemaProbeCalls`
- `schemaProbe2xxJson`
- `schemaProbeRejected`
- `successfulProbeMappingRejects`
- `validatorIrFingerprintMismatchRejects`
- `documentationOriginFallbacks`
- `standaloneUrlPromotions`
- expanded-evidence recipe count
- replay deltas
- controls and event-derived safety
- report and ledger fingerprints

Aggregate failure counters must equal recomputation from per-attempt synthesis evidence. Any mismatch fails diagnostic integrity.

## Causal engineering tests required before benchmark
1. Inline HTML `<code>` with entities compiles to one operation IR node.
2. Multiple GET/curl requests in one block compile to separate operations.
3. API base in an ancestor section links to a relative operation in a child endpoint section.
4. API base must NOT cross unrelated sibling/peer API namespaces.
5. A Met-like synthetic document with an explicit API base and `GET /objects/[objectID]` links without using documentation origin.
6. A request containing `?key=<literal>` is rejected before probe even if the query parameter was not documented as required.
7. Bearer/Authorization/Basic/OAuth/API-key examples are rejected before probe.
8. Generic `/webhooks/{id}` cannot bind an unrelated single task input.
9. An actual reference-expanded synthetic document creates IR nodes carrying expansion provenance.
10. Multiple request examples preserve independent source ranges/provenance.
11. Same-IR materialized COMPILE validates under `4F_DOCUMENTATION_IR:`.
12. Old graph prefixes reject.
13. Source audit proves zero frozen-provider/domain/endpoint seeds.

## Engineering recovery gate
4F is GO only if ALL required gates are satisfied:
- recover >=5 of the 6 capabilities previously demonstrated by R4
- >=5 successful manufactures total
- >=4 families with success
- changed-input replay >=95%
- zero replay cognition/documentation/synthesis/schema-probe deltas
- zero numeric-index decisions
- zero documentation-origin fallbacks
- zero standalone URL promotions
- zero validator IR/graph mismatch rejects
- zero duplicate rendered probe URLs actually executed per provider/case
- `authLikeRenderedRequests = 0`
- `knownAuthProbeAttempts = 0`
- `wrongTaskProbeAttempts = 0`
- 42/42 controls and event-derived safety clean
- >=1 confirmed recipe using a relative operation linked to an explicit API base through the IR relation graph
- >=1 successful manufacture whose request proof depends on evidence added by an actual reference expansion, if eligible reference links exist
- aggregate diagnostic counters exactly match per-attempt recomputation

Preferred economics:
- total LLM cost <= `$0.60`
- mean LLM cost/success <= `$0.15`

## Diagnostic targets
4F should materially improve the frozen 4E pre-operation failure ceiling:
- `(noIrOperationAttempts + irOperationUnusableAttempts) / synthesisAttempts < 70%` required diagnostic target
- `operationApiBaseLinks > 0` when relative/base evidence exists
- recover npm, Agify, and Genderize without regression if their public evidence remains available
- recover >=3 of the four still-missing R4 providers (Open Food Facts, TheCocktailDB, Met, NHTSA) to satisfy the >=5/6 R4 gate
- `authLikeRenderedRequests = 0` mechanically, not merely by aggregate assertion
- at least one operation created from an actually expanded reference document if expansion evidence contains an API operation

If 4F recovers <5/6 R4 capabilities, do NOT automatically create 4FR/4FR2. Attribute the remaining ceiling before another experiment.

## Formal benchmark decision
- `GO_4F_DOCUMENTATION_IR_OPERATION_GRAPH`
- otherwise `REASSESS_4F_DOCUMENTATION_IR_OPERATION_GRAPH`
