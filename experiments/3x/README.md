# Experiment 3X — Evidence-Grounded Semantic Projection Compiler

## Status
Preregistered before implementation.

## Base
Exact base SHA: `2084e236707f9f118e3c92636009469c535bd40d` (merged 3W-R).

## Scientific question
Given frozen provider/documentation evidence already collected by 3W-R, and with discovery, crawling, provider selection, endpoint search, and projection induction disabled during compilation, can MISSING compile a bounded, non-Turing-complete semantic projection program that adapts provider-native response shapes into the canonical `currency_metadata` capability, safely verify it live twice, persist a recipe, and replay a changed input with zero LLM/documentation/projection-induction calls?

This experiment isolates semantic projection/manufacture. It does **not** test provider discovery or documentation acquisition.

## Frozen evidence source
Evidence is frozen from 3W-R run `32995250087`, artifact `9616242779`, digest `sha256:dcffd7f1dffd6d316bdee195ef2c889fbaac7360d6f2d66e824ac6c80d145e07`.

No new documentation crawling or provider discovery is allowed during the benchmark.

## Frozen benchmark cases
Exactly four cases are used: two positive manufacture cases and two negative controls.

### Positive P1 — National Bank of Poland
Provider candidate: `p022_0fdec33072`.
Capability: `currency_metadata`.
Build input: `{ "currency_id": "USD" }`.
Replay input: `{ "currency_id": "EUR" }`.
Required canonical outputs: `code`, `name`.

Frozen endpoint contract evidence:
- Documentation evidence `p022_0fdec33072-e01` states `{code}` is a three-letter currency code and documents `https://api.nbp.pl/api/exchangerates/rates/{table}/{code}/`.
- Same evidence states `Currency` means currency name and `Code` means currency code.
- Live example evidence `p022_0fdec33072-e07` returned JSON with fields `currency` and `code`.

Frozen request template:
- method: GET
- base: `https://api.nbp.pl`
- path: `/api/exchangerates/rates/a/{code}/`
- binding: `code <- $input.currency_id`
- no headers, credentials, query parameters, browser, JS, shell, or arbitrary code.

A valid semantic projection may map canonical `name` from provider field `currency` when grounded by the frozen documentation.

### Positive P2 — CurrencyFreaks supported currencies
Provider candidate: `p012_e3c788ce5b`.
Capability: `currency_metadata`.
Build input: `{ "currency_id": "USD" }`.
Replay input: `{ "currency_id": "EUR" }`.
Required canonical outputs: `code`, `name`.

Frozen endpoint contract evidence:
- Documentation evidence `p012_e3c788ce5b-e03` documents anonymous GET `https://api.currencyfreaks.com/v2.0/supported-currencies`.
- The documented JSON response contains `supportedCurrenciesMap` keyed by currency code, with entries containing `currencyCode` and `currencyName`.

Frozen request template:
- method: GET
- exact URL: `https://api.currencyfreaks.com/v2.0/supported-currencies`
- no path/query binding required for the HTTP request.
- selection of the requested currency occurs only in the projection program.

A valid semantic projection may use the input value as a map key under `supportedCurrenciesMap` and map `currencyCode -> code`, `currencyName -> name`.

### Negative N1 — Open5e
Provider candidate: `p014_6fec1446bc`.
Frozen evidence does not document an ability-score endpoint or the required `index`, `name`, `full_name` output contract. It must remain REJECT.

### Negative N2 — CurrencyBeacon
Provider candidate: `p011_1434d08808`.
Frozen documentation evidence explicitly requires `api_key` or Authorization bearer credentials for API requests. It must remain REJECT and no credential-bearing request may be sent.

## Bounded semantic projection DSL
The compiler may output only the following expression forms:

- `FIELD(path)` — deterministic dotted-object/array path lookup.
- `INPUT(name)` — reads a named benchmark input.
- `LOOKUP(map_path, key_expr, value_path)` — deterministic object lookup by a runtime input-derived key, then optional relative field path.
- `FIND(array_path, where_path, equals_expr, value_path)` — deterministic first-match selection from a bounded JSON array using equality, then optional relative field path.

A canonical output program is a map from each required canonical output name to exactly one DSL expression.

No JavaScript, Python, regular-expression execution, shell, eval, arbitrary functions, loops, network calls, filesystem calls, dynamic code, arithmetic transforms, joins, or user-defined expressions are permitted.

Limits:
- max expression depth: 4
- max path segments: 12
- max FIND scanned items: 500
- max program outputs: exactly the required canonical outputs for the case
- input names must exist in the frozen case
- provider response field/path tokens used by FIELD/LOOKUP/FIND must be grounded in frozen evidence
- LOOKUP/FIND key/equality expressions may only be INPUT or literal strings that are visibly grounded in frozen evidence

## Compiler
The LLM receives only:
- the frozen case schema/input names/required outputs,
- provider identity,
- frozen request template,
- bounded evidence excerpts/IDs,
- the DSL schema and safety constraints.

It may return only `COMPILE` or `REJECT`.

Maximum one initial call and one repair per positive case. Negative cases get one call and no repair unless the response is syntactically invalid.

`REJECT` contains only: `case_id`, `provider_candidate_id`, `decision`, `reason`.

`COMPILE` contains only: `case_id`, `provider_candidate_id`, `decision`, `outputs`, `evidence_ids`, `reason`.

## Mechanical grounding gate
Before any live execution, the benchmark must mechanically reject programs with:
- wrong case/provider,
- unknown/cross-provider/empty evidence,
- unsupported DSL operator,
- unknown input,
- ungrounded provider field/path token,
- excessive expression depth/path length,
- FIND over non-array evidence shape when a frozen example is available,
- missing/extra canonical outputs,
- credentials/auth/header/network/code constructs,
- arbitrary literal URLs or endpoint changes.

The projection compiler cannot modify the frozen request template.

## Live verification
For a valid positive COMPILE:
1. Compile the frozen request template with build input.
2. Perform anonymous HTTPS GET only.
3. Parse JSON.
4. Execute the stored bounded projection program.
5. Apply the existing semantic validator for `currency_metadata`: projected `code` must equal input `currency_id` case-insensitively and `name` must be a non-empty string.
6. Perform a fresh second GET and repeat projection/semantic validation.
7. Both projected canonical outputs must match between the two build verifications.
8. Persist a recipe only after both verifications succeed.

No execution redirect is allowed.

## Replay
Replay uses input `{ "currency_id": "EUR" }` for every persisted positive recipe.

Replay must use only the persisted request template + projection program. It must perform zero:
- documentation fetches,
- provider selection calls,
- LLM/compiler calls,
- repairs,
- projection induction calls.

Replay performs one fresh anonymous HTTPS GET and deterministic projection + semantic validation.

## Active negative controls
Exactly 24 controls must invoke the same production guards/interpreter used by the live benchmark:
1. wrong case id
2. wrong provider id
3. empty evidence ids
4. unknown evidence id
5. cross-provider evidence
6. missing required canonical output
7. extra canonical output
8. unsupported DSL operator
9. unknown input name
10. FIELD ungrounded path
11. LOOKUP ungrounded map path
12. LOOKUP ungrounded value path
13. FIND ungrounded array path
14. FIND ungrounded where path
15. FIND ungrounded value path
16. expression depth exceeded
17. path segment limit exceeded
18. FIND scan bound exceeded
19. arbitrary URL field
20. authorization/header field
21. executable code/script field
22. credential-bearing request template
23. non-HTTPS request template
24. replay external-call delta nonzero

Synthetic control payloads are acceptable only when they call the exact same validator/interpreter/request guard functions as live benchmark paths. Each control record must include `guard`/production function evidence.

## Safety counters
Safety counters are derived from actual events, not constants. GO requires zero accepted/sent events for credentials, authorization headers, non-GET requests, non-HTTPS execution, IP/private hosts, endpoint mutation, arbitrary code, ungrounded projection fields, and replay external calls.

## Formal decision
GO string: `GO_EVIDENCE_GROUNDED_SEMANTIC_PROJECTION_COMPILER`

Else: `REASSESS_EVIDENCE_GROUNDED_SEMANTIC_PROJECTION_COMPILER`

## Frozen GO gates
All must be true:
1. frozen evidence provenance matches 3W-R run/artifact/digest above;
2. exactly 2 positive and 2 negative cases;
3. both positive cases produce mechanically valid COMPILE programs;
4. NBP positive performs a non-identity semantic alias (`currency -> name`) grounded in evidence;
5. CurrencyFreaks positive performs an input-keyed collection/map selection, not a hard-coded USD/EUR answer;
6. both positive providers pass first live build verification;
7. both positive providers pass fresh second build verification;
8. exactly 2 persisted recipes from 2 distinct providers;
9. both changed-input EUR replays succeed;
10. replay rate = 100%;
11. replay external-call deltas are all zero for docs/provider selection/LLM/repair/projection induction;
12. both negative cases are REJECT;
13. all recipe/evidence/program/body/trace fingerprints are non-empty;
14. all live observations are timestamped;
15. exactly 24/24 active controls execute and verify rejection through production guards;
16. all safety counters are zero.

No gate may be weakened after the preregistration commit.

## Interpretation
A GO demonstrates bounded semantic normalization/manufacture for two heterogeneous provider response shapes under frozen evidence. It does not demonstrate open-world provider discovery, arbitrary schema transformation, or general API synthesis.

A REASSESS must be diagnosed by layer: compiler semantics, grounding validator, DSL expressiveness, live supplier behavior, or replay.