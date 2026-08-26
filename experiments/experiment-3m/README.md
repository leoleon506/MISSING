# MISSING Experiment 3M — Autonomous Gap Fill Composition

## Purpose

Test whether MISSING can detect that an intent cannot be satisfied by the existing bounded capability supply, manufacture the missing primitive from approved raw public-data sources using a constrained declarative DSL, validate that primitive, compose it with an existing capability, persist the recipe, and replay it on an independent input with zero LLM calls.

This experiment does **not** assume that the missing primitive already exists as an MCP tool.

## Frozen intent cases

### Case A — country_capital_coordinates

Build input: `{ "country": "Costa Rica" }`

Replay input: `{ "country": "Japan" }`

Intent: `Given a country name, return coordinates for that country's capital city.`

Existing supply exposed to the planner contains only:

- `city_geocode(city) -> latitude, longitude, country, name`

It does **not** contain `country -> capital`.

Approved raw sources available only to the manufacturing planner include:

- World Bank public country metadata endpoint, which returns country records including `name` and `capitalCity`.

The expected missing primitive shape is not disclosed to the planner as a hard-coded recipe; the planner must declare the gap and manufacture a contract from the approved source + DSL.

### Case B — country_capital_name

Build input: `{ "country": "Canada" }`

Replay input: `{ "country": "Brazil" }`

Intent: `Given a country name, return the capital city name using a manufactured missing primitive.`

This second case tests direct reuse of the manufacturing mechanism without the downstream geocoder.

## Frozen manufacturing DSL

The planner may emit only these operations:

- `SOURCE(source_id)`
- `ARRAY_GET(index)`
- `FILTER_EQ(path, $input.<field>)`
- `FIRST`
- `SELECT(path)`
- `TRIM`
- `LOWERCASE`
- `OUTPUT`

No regex, eval, shell, Python, JavaScript, arbitrary HTTP, filesystem, credentials, writes, code generation, loops, joins, or planner-defined functions.

Maximum **8 operations** per manufactured primitive.

## Frozen source contracts

### `worldbank_countries`

- method: GET
- URL: `https://api.worldbank.org/v2/country?format=json&per_page=400`
- no credentials
- response must be JSON
- host must pass the network safety gate

### Existing capability `city_geocode`

- method: GET
- URL template: `https://geocoding-api.open-meteo.com/v1/search?name={city}&count=1&language=en&format=json`
- exports: first result `latitude`, `longitude`, `country`, `name`
- no credentials
- host must pass the network safety gate

## Frozen network safety gate

Before every outbound request:

1. URL protocol must be HTTPS.
2. IP literals are rejected.
3. DNS A/AAAA records are resolved before request.
4. Every resolved address must be globally routable public space.
5. Reject loopback, private, link-local, multicast, unspecified, documentation/test, carrier-grade NAT, unique-local IPv6, IPv4-mapped private IPv6, and other reserved ranges.
6. Redirects are disabled (`redirect: manual`); any 3xx response is rejected.
7. Host-policy evidence is persisted.

This closes the known weak-host-policy issue from Experiments 3D–3L for the HTTP execution surface used here.

## Frozen procedure

For each case:

1. Planner receives intent, input schema, existing supply contracts, approved raw source contracts, and DSL definition.
2. Planner must return `ROUTE`, `COMPOSE`, `MANUFACTURE`, or `REJECT`.
3. If existing supply cannot satisfy the intent, the correct path is `MANUFACTURE`; planner emits:
   - missing primitive id
   - input contract
   - output contract
   - DSL recipe
   - optional composition recipe using existing capability supply
4. Static validator rejects unknown sources/operations, literals not present in the frozen contract, forward references, >8 operations, or any network target outside approved contracts.
5. Execute manufactured primitive on build input.
6. Validate output contract and non-placeholder result.
7. If composition is required, execute existing downstream capability using only manufactured output.
8. Persist primitive contract, DSL recipe, composition recipe, network evidence, results, and fingerprints.
9. Replay exact persisted recipe on independent replay input with **zero planner/repair calls**.

One bounded repair call is allowed only when a recipe passed static validation but failed live execution or output contract validation. Repair cannot change intent, source catalog, DSL, thresholds, or safety policy.

## Preregistered gates

`GO_AUTONOMOUS_GAP_FILL_COMPOSITION` iff all are true:

- at least **1** case is classified `MANUFACTURE`
- at least **1** missing primitive is statically valid
- at least **1** manufactured primitive passes live validation
- Case A produces a functionally valid composed result using the manufactured primitive plus `city_geocode`
- at least **1** persisted manufactured recipe succeeds on its independent replay input
- replay success rate across persisted recipes = **100%**
- replay LLM/planner calls = **0**
- source/operation policy violations = **0**
- host-policy violations = **0**
- redirects followed = **0**
- credentials supplied = **0**
- arbitrary code generated/executed = **0**
- evidence fingerprints persisted

Otherwise decision is `REASSESS_AUTONOMOUS_GAP_FILL_COMPOSITION`.

## Interpretation boundary

A GO would prove bounded autonomous gap detection and manufacturing from a small approved public-source catalog, followed by composition and independent replay. It would **not** prove open-web source discovery, arbitrary API induction, unrestricted code generation, universal capability manufacturing, or production-grade commercial operation.
