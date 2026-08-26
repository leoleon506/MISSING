# MISSING Experiment 3N — Constraint-Preserving Autonomous Composition

## Purpose

Test whether MISSING can preserve entity identity and user constraints across a manufactured + composed capability chain, rejecting semantically incorrect but technically successful downstream results.

3N directly targets the flaw observed in 3M, where `Costa Rica -> San Jose` was manufactured correctly but unconstrained geocoding returned San Jose, California.

## Frozen intent cases

### Case A — constrained_capital_coordinates

Build input: `{ "country": "Costa Rica" }`
Replay input: `{ "country": "Japan" }`

Intent: `Given a country name, return coordinates for that country's capital city, and prove that the geocoded result belongs to the same country.`

### Case B — ambiguity_control

Build input: `{ "country": "Panama" }`
Replay input: `{ "country": "Mexico" }`

Intent: `Given a country name, return coordinates for its capital while preserving country identity through the downstream lookup.`

## Existing supply

`city_geocode(city)` is considered insufficient for these intents because it accepts only city text and can return a homonymous city in the wrong country.

The system must not accept this supply directly merely because it returns coordinates.

## Approved raw public sources

### `worldbank_countries`

`https://api.worldbank.org/v2/country?format=json&per_page=400`

Used to manufacture `country -> capital` and to obtain country identity metadata.

### `openmeteo_geocode`

`https://geocoding-api.open-meteo.com/v1/search?name={city}&count=10&language=en&format=json`

Returns multiple candidates including city, latitude, longitude, country, and country_code.

No credentials.

## Frozen manufacturing/adaptation DSL

Allowed operations only:

- `SOURCE(source_id, args)`
- `ARRAY_GET(index)`
- `FILTER_EQ(path, ref)`
- `FIRST`
- `SELECT(path)`
- `PROJECT(fields)`
- `TRIM`
- `LOWERCASE`
- `OUTPUT`

References may be only `$input.<field>` or `$step.<field>` from earlier outputs.

No arbitrary constants except contract-declared request parameters such as `count=10`, `language=en`, `format=json` that are owned by approved source contracts and not planner-controlled.

No regex, eval, shell, Python, JavaScript, filesystem, credentials, writes, arbitrary HTTP, planner-defined functions, fuzzy matching, or hidden transforms.

Maximum 12 operations across the manufactured chain.

## Frozen entity-constraint rule

The original `country` constraint becomes a provenance-bearing field and MUST survive the chain.

A final result is valid only if:

1. capital city was derived from the World Bank record matching `$input.country`;
2. geocoding candidate is selected from Open-Meteo results;
3. candidate `country` exactly equals `$input.country` after deterministic `TRIM` only;
4. final latitude/longitude come from that same candidate object;
5. if no candidate satisfies country equality, the run fails rather than accepting another city.

The planner may therefore manufacture an adapter such as `city + country -> constrained geocode result` from the approved Open-Meteo source.

## Frozen network safety gate

Same strengthened policy introduced in 3M:

- HTTPS only;
- reject IP literals;
- resolve DNS A/AAAA before request;
- all resolved addresses must be globally routable public addresses;
- reject private, loopback, link-local, multicast, unspecified, documentation/test, CGNAT, unique-local IPv6, mapped-private and other reserved ranges;
- redirects disabled (`redirect: manual`), any 3xx rejected;
- network evidence persisted.

## Frozen procedure

For each case:

1. Planner receives intent, input contract, existing supply, approved source contracts, entity-constraint rule, and DSL.
2. Planner returns `ROUTE`, `COMPOSE`, `MANUFACTURE`, or `REJECT`.
3. Any plan that uses unconstrained `city_geocode(city)` as final answer is statically rejected.
4. To succeed, planner must manufacture or adapt the chain so that country provenance constrains downstream candidate selection.
5. Static validation checks source ids, refs, operation order, max ops, output contract, and required country-preservation logic.
6. Execute build input.
7. Semantic validator requires final `country === input.country` and numeric latitude/longitude from the same selected candidate.
8. Persist recipe + fingerprints + provenance trace.
9. Replay exact recipe on independent input with zero planner/repair calls.

One bounded repair call is allowed only after static-valid live failure. It may change the DSL recipe but not intent, source catalog, safety policy, entity constraints, or thresholds.

## Negative control

The exact 3M-style unconstrained chain:

`country -> manufactured capital -> city_geocode(city only)`

must be rejected by static validation and never counted as success.

## Preregistered gates

`GO_CONSTRAINT_PRESERVING_AUTONOMOUS_COMPOSITION` iff all are true:

- at least 1 case classified `MANUFACTURE`
- at least 1 statically valid constraint-preserving chain
- at least 1 live build passes end-to-end semantic validation
- Case A final country is exactly `Costa Rica`
- Case A result is not the known wrong San Jose, United States result from 3M
- at least 1 independent replay succeeds
- replay success rate across persisted recipes = 100%
- all successful final outputs satisfy `final.country === input.country`
- unconstrained negative-control chain accepted = 0
- replay planner/repair calls = 0
- source/operation policy violations = 0
- host-policy violations = 0
- redirects followed = 0
- credentials supplied = 0
- arbitrary code generated/executed = 0
- provenance and recipe fingerprints persisted

Otherwise decision is `REASSESS_CONSTRAINT_PRESERVING_AUTONOMOUS_COMPOSITION`.

## Interpretation boundary

A GO would show bounded autonomous manufacturing can preserve an explicit entity constraint through composition and reject a plausible-but-wrong downstream match. It would not prove general entity resolution, fuzzy identity matching, unrestricted multi-hop planning, open-web source discovery, or universal semantic correctness.
