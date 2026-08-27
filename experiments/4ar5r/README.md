# Experiment 4A-R5R — Evidence Alignment Recovery

## Status
Development/recovery only over the already-burned 4A workload. No fresh blind evidence is consumed.

## Frozen parent evidence
- 4A-R5 merge SHA: `17497b056f633c6d4bc2cef59ea9ba733981a703`
- 4A-R5 run: `33030100703`
- job: `98380400831`
- artifact: `9630749593`
- artifact digest: `sha256:40cbdb4c4bf325126eb8cebbb6ea7f7c20204ca3df6b425fcfd8905105a6a00b`
- report fingerprint: `08f39d2c652a220d750cee4339f6ae4d2045fff0587b89c33a6f536792c70e48`
- ledger fingerprint: `88d623ed7f96d81477b4dc684c06071231b699359c9b6458e9af515d262eb6f0`

## Frozen R5 outcome
- 24 cases / 8 families
- 2 successful manufactures / 2 families / 2 providers
- 2 persisted recipes
- 1/2 changed-input replay = 50%
- 15 live calls
- 196 LLM calls
- 2,420 documentation fetches
- 1,468 spec probes
- total LLM cost `$1.137346`
- mean LLM cost/success `$0.568673`
- median success latency `57.925s`
- p90 success latency `66.138s`
- 42/42 controls
- safety clean

## R5 diagnosis frozen before R5R
R5 correctly ranked multiple providers that had succeeded in prior recovery runs, but then lost them at the evidence/contract boundary. Three generic defects are isolated:

1. **OpenAPI server-path alignment**
   A verified OpenAPI server URL may contain a path prefix while an operation path is absolute. The executable URL must preserve both documented components without inventing or dropping path segments.

2. **Verified evidence-origin grounding**
   A cited evidence item's verified `resolved_url` is itself cryptographic/runtime evidence of its exact HTTPS origin. The legacy validator only recognizes a base URL when the same string appears inside body text, creating false `undocumented_base_url` rejects even when the cited evidence was fetched from that exact origin.

3. **Evidence packet monopolization**
   R5 allowed evidence packets up to 52,000 chars and generic same-domain navigation/prose could consume the budget before provider-specific verified API evidence. This increased cost/latency and buried useful evidence.

## Allowed generic changes
1. **Mechanical OpenAPI server + operation composition**
   - preserve the verified OpenAPI server origin and path prefix;
   - combine it with a documented operation path deterministically;
   - reject traversal, query/fragment mutation, non-HTTPS and cross-origin composition;
   - no provider/case tables.
2. **Resolved-URL origin grounding**
   - a COMPILE base URL may be grounded by either literal cited evidence text OR exact HTTPS origin of a cited evidence item's verified `resolved_url`;
   - all existing provider ownership, same-domain, DNS/private-host, HTTPS and evidence-id checks remain active;
   - no arbitrary child/subdomain inference.
3. **Compact diversified evidence packet**
   - reduce planner-visible packet budget materially below R5;
   - reserve deterministic quotas for verified specs, API docs/structured docs and provider prose;
   - deduplicate near-identical text/windows;
   - prioritize evidence carrying required output fields and input names;
   - generic navigation/legal pages cannot monopolize the packet.
4. **Attribution instrumentation**
   - persist grounding source (`text_literal` or `resolved_url_origin`);
   - persist OpenAPI composition proof when used;
   - persist evidence-class quotas, dropped-item counts and compact packet fingerprint.

## Frozen unchanged components
- exact 24 cases / 8 families
- R2 top-120 catalog frontier
- R5 deterministic provider scoring and ordering
- maximum 8 provider attempts per case
- crawl depth, total max bytes and safety controls
- typed request/binding IR
- 3X projection DSL/executor
- semantic validators
- no response-grounded live repair
- double-live verification
- changed-input zero-cognition replay
- 42 controls
- original 4A gates

## Forbidden
- provider-, domain-, endpoint- or case-specific rules/maps
- curated providers or hand-authored recipes
- external search-engine discovery
- expanding top-120 or provider attempts
- changing semantic validators
- relaxing HTTPS, same-domain, DNS/private-host, credential/header or replay safety
- response-body repair
- fresh blind holdouts

## Formal gates
Same original 4A gates:
- >=12/24 successful manufactures
- >=6/8 successful families
- >=8 distinct provider hosts
- double live verification for all persisted recipes
- >=95% changed-input replay
- replay catalog/reranker/docs/synthesis deltas all zero
- 42/42 controls
- event-derived safety clean
- median success latency <=90s
- p90 success latency <=180s
- mean LLM cost/success <=$0.15
- total LLM cost <=$3.00

Formal decision:
- `GO_4A_R5R_EVIDENCE_ALIGNMENT_RECOVERY`
- otherwise `REASSESS_4A_R5R_EVIDENCE_ALIGNMENT_RECOVERY`

A GO is engineering recovery evidence only. Fresh blind breadth validation is still required afterward.
