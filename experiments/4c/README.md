# Experiment 4C — Typed Request Evidence Acquisition

## Status
Development/recovery experiment over the already-burned 4A workload. No fresh blind holdout is consumed.

## Frozen parent evidence
- 4B merge SHA: `818ec4d7dc0f47f39ff09444f422ddb6c7761dd8`
- 4B workflow run: `33101875065`
- job: `98621420722`
- artifact: `9659898049`
- artifact digest: `sha256:2cc26fdfab7f4a940e7e8eded829217324cb35a05ecd00b74cfdabc95ad210a4`
- formal decision: `REASSESS_4B_PROVENANCE_REQUEST_GRAPH`
- report fingerprint: `104c1634877257e04b33b2a80fddefa533cf9b414828d8b19a13fd6e358556e2`
- ledger fingerprint: `4f6733144f15bb17d61a43de952ae301f852b20d7608fc8ff797aea1539bb055`
- ledger events: `6057`

This README is the **first commit on the 4C branch**.

## Frozen 4B outcome
- 24 cases / 8 families
- 0 persisted manufactures because every 4B COMPILE was rejected by an inherited P1 validator wiring defect
- 177 provider synthesis attempts
- 88 zero-request-inventory attempts (49.7%)
- 89 non-zero-request-inventory attempts
- 2,437 request-graph nodes / 2,448 edges
- 135 proven API-origin candidates
- 538 proven request-template candidates
- 219 schema probes
- 36 successful 2xx JSON probes
- 183 rejected probes
- 42/42 controls
- `documentationOriginFallbacks = 0`
- total LLM cost `$0.2344032`

## Frozen forensic interpretation
4B improved request coverage materially versus P1 (zero inventory dropped from 74.0% to 49.7%, and successful 2xx JSON probes rose from 11 to 36), but it exposed two independent issues:

1. **Integration defect**: 4B generated valid `4B_PROVENANCE_REQUEST:<id>` COMPILE contracts, but `validate4ap1()` reconstructed P1 request hypotheses and accepted only `P1_REQUEST:<id>`, producing `p1_request_hypothesis_not_documented`.
2. **Architectural defect**: request provenance alone is insufficient. 4B treated arbitrary absolute HTTPS URLs found in documentation as request evidence, so navigation/redirect/search URLs could outrank the actual API operation. Conversely some providers still had no usable request evidence in the acquired corpus.

Ignoring only the validator wiring defect, 4B still recovered only the same two historical R4 capabilities as P1 (TheCocktailDB and Genderize), far below the preregistered >=5/6 recovery gate. Therefore 4C is **not** a 4BR/4BR2 retry.

## 4C hypothesis
MISSING should manufacture probe requests only from **typed request evidence** whose syntax itself proves that the URL/path is being used as an HTTP request operation, not merely mentioned in a document.

Accepted evidence classes are provider-blind and syntax-driven:
- OpenAPI/Swagger GET operation + server/base relation;
- explicit HTTP request line (`GET https://...` or `GET /path` with proven API base in the same typed block);
- `curl` command with GET/default GET and one absolute HTTPS request URL;
- `fetch("https://...")` / `fetch('https://...')` with GET/default GET;
- `axios.get("https://...")`;
- explicit labels such as `Endpoint:`, `Request URL:`, `API URL:`, or `Base URL:` only when mechanically joined to the same operation block;
- inherited structured endpoint examples only when their evidence type is explicit and their API origin/path relation is preserved.

Arbitrary standalone `https://...` mentions are **not request evidence**.

## Architecture

```text
provider docs/spec corpus
        ↓
TYPED REQUEST EVIDENCE EXTRACTOR
        ├─ OpenAPI GET operations
        ├─ HTTP GET request lines
        ├─ curl commands
        ├─ fetch()/axios.get()
        └─ explicit endpoint/request blocks
        ↓
stable typed evidence IDs
        ↓
API origin + operation path + slots
        ↓
strict input binding / auth filtering
        ↓
canonical rendered-request dedup
        ↓
P1 safe anonymous GET schema probe
        ↓
observed response schema
        ↓
stable-ID output mapping
        ↓
4C validator against the SAME typed request graph
        ↓
2 independent live verifications
        ↓
persist recipe
        ↓
changed-input zero-cognition replay
```

## 1. Same-graph validation invariant
The validator must reconstruct `buildTypedRequestGraph4C(evidence, case_id)` and verify the exact selected request hypothesis from the `4C_TYPED_REQUEST:<id>` contract reason.

It must never reconstruct P1 or 4B request inventories when validating a 4C contract.

A causal integration test must cover:
`typed request → successful probe proof → materialized COMPILE → 4C static validation accepts`.

## 2. Typed evidence only
No regex or parser may promote an arbitrary absolute URL simply because it appears in documentation.

Every executable request hypothesis must carry a `request_evidence_type` from a closed enum and typed evidence IDs/source ranges sufficient to reproduce why the text is a request operation.

## 3. Documentation origin is not API origin
Unchanged from 4B. Relative paths require an explicitly proven API base relation from the same typed request/spec block. Documentation page origin is never an execution fallback.

## 4. Request semantics before probing
Navigation, redirect, login, docs, asset and generic outbound-link URLs are rejected unless the typed evidence syntax itself establishes them as the actual API request operation.

For labeled examples and code samples, the parser must isolate the request URL argument rather than all URLs in surrounding markup.

## 5. Acquisition diagnostic
4C must distinguish:
- `no_typed_request_evidence`: acquisition/corpus gap;
- `typed_evidence_unusable`: request evidence exists but cannot safely bind all inputs;
- `typed_probe_failed`: safe request was formed but failed live probe;
- `typed_probe_success_mapping_reject`: live JSON observed but outputs cannot be grounded.

This attribution is required so a future experiment does not conflate acquisition, request compilation and semantic mapping.

## 6. Safety / budgets
Unchanged:
- anonymous HTTPS GET only;
- no credentials/auth headers;
- public DNS/private-host checks;
- redirect guards;
- max 8 provider attempts/case;
- max 3 unique rendered schema probes/provider;
- fixed model `gpt-4.1-mini-2025-04-14`;
- no provider/domain/case recovery seeds;
- no numeric-index decisions;
- two post-manufacture live verifications;
- changed-input zero-cognition replay;
- 42 controls.

## Required attribution metrics
At least:
- `typedEvidenceItems`
- counts by evidence type
- `typedRequestHypotheses`
- `noTypedRequestEvidenceAttempts`
- `typedEvidenceUnusableAttempts`
- `uniqueRenderedProbeUrls`
- `duplicateRenderedProbeUrlsRejected`
- inherited schema-probe metrics
- `typedProbeSuccessMappingRejects`
- `validatorGraphMismatchRejects`
- `documentationOriginFallbacks`
- replay deltas
- report/ledger fingerprints.

## Engineering recovery gate
4C is an engineering-recovery success only if all are true:
- recover **>=5 of the 6 capabilities previously demonstrated by R4**;
- >=5 successful manufactures total;
- >=4 families with success;
- changed-input replay >=95%;
- zero replay cognition/documentation/synthesis/schema-probe deltas;
- zero numeric-index decisions;
- zero documentation-origin fallback;
- zero arbitrary standalone-URL request promotions;
- zero validator graph mismatch rejects;
- zero duplicate rendered probe URLs executed per provider/case;
- zero required-auth probes;
- 42/42 controls and event-derived safety clean;
- >=1 confirmed recipe from a typed request example whose API origin differs from the documentation origin;
- total LLM cost <= `$0.60` preferred;
- mean LLM cost/success <= `$0.15` preferred.

Diagnostic targets:
- zero request candidates sourced only from untyped standalone absolute URLs;
- preserve or improve 4B's <=50% no-request-evidence rate, while increasing the fraction of probes that are semantically relevant.

If 4C recovers <5/6 R4 capabilities, **do not automatically create 4CR/4CR2**. Diagnose whether the remaining ceiling is acquisition, provider ranking, task/request correspondence, or response semantics before another experiment.

## Formal benchmark decision
The generated benchmark uses the original 4A formal gates plus 4C integrity gates. Decision string:
- `GO_4C_TYPED_REQUEST_EVIDENCE_ACQUISITION`
- otherwise `REASSESS_4C_TYPED_REQUEST_EVIDENCE_ACQUISITION`.
