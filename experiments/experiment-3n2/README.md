# MISSING Experiment 3N2 — Typed Constraint Composition

## Purpose

Test the same semantic hypothesis as 3N — preserving the original country identity through a manufactured country→capital→geocode chain — while removing the planner/DSL serialization ambiguity that prevented any 3N live execution.

3N2 is not a relaxed rerun. It uses fresh countries and a canonical typed JSON contract. Unknown or aliased fields are rejected.

## Frozen cases

1. `typed_capital_coordinates_a`
   - build: `{ "country": "Argentina" }`
   - replay: `{ "country": "France" }`
2. `typed_capital_coordinates_b`
   - build: `{ "country": "Australia" }`
   - replay: `{ "country": "India" }`

Intent for both: `Given a country name, return coordinates for that country's capital and prove the selected geocoder candidate belongs to the same original country.`

## Approved sources

- `worldbank_countries`: `https://api.worldbank.org/v2/country?format=json&per_page=400`
- `openmeteo_geocode`: `https://geocoding-api.open-meteo.com/v1/search?name={city}&count=10&language=en&format=json`

No credentials.

## Canonical typed DSL

Every operation MUST match exactly one strict shape; additional properties are forbidden.

- `SOURCE`: `{ "op":"SOURCE", "source_id":"worldbank_countries" }`
- `SOURCE geocode`: `{ "op":"SOURCE", "source_id":"openmeteo_geocode", "args":{"city":"$capital"} }`
- `ARRAY_GET`: `{ "op":"ARRAY_GET", "index":1 }`
- `FILTER_EQ`: `{ "op":"FILTER_EQ", "path":"name|country", "ref":"$input.country" }`
- `FIRST`: `{ "op":"FIRST" }`
- `SELECT`: `{ "op":"SELECT", "path":"capitalCity", "save_as":"$capital" }`
- `PROJECT`: `{ "op":"PROJECT", "fields":["latitude","longitude","country","name"] }`
- `OUTPUT`: `{ "op":"OUTPUT" }`

No aliases such as `field`, `value`, `city`, `as`, or `ref` for `save_as`. No unknown properties.

## Frozen semantic chain requirements

A valid plan must:

1. read World Bank countries;
2. take response index 1;
3. `FILTER_EQ(path="name", ref="$input.country")`;
4. `FIRST`;
5. `SELECT(path="capitalCity", save_as="$capital")`;
6. call Open-Meteo with `args.city="$capital"`;
7. filter geocoder results with `FILTER_EQ(path="country", ref="$input.country")` before `FIRST`;
8. project latitude, longitude, country, name from the same selected candidate;
9. output only when final `country === input.country`.

The exact operation sequence is not disclosed as executable code to the planner, but the typed operation contracts and semantic requirements are provided.

## Strict planner contract

Planner response itself is strictly validated:

- `case_id`
- `decision: MANUFACTURE|REJECT`
- `reason`
- `ops`

Unknown top-level fields are rejected. Every op is parsed through a strict discriminated union. Invalid serialization is a planner contract failure and is not live-executed.

One bounded repair call is allowed only for a planner contract/static-validity failure or a static-valid live failure. Repair receives the exact generic error categories but cannot change cases, sources, DSL, safety policy, or thresholds.

## Network safety

Same strengthened gate as 3M/3N: HTTPS only, reject IP literals, resolve DNS, require globally routable addresses, reject private/loopback/link-local/reserved ranges, disable redirects, persist evidence.

## Independent replay

Persisted recipes replay on the different frozen country with zero planner/repair calls.

## Preregistered GO gates

`GO_TYPED_CONSTRAINT_COMPOSITION` iff all are true:

- >=1 MANUFACTURE decision
- >=1 strict typed plan
- >=1 live semantic success
- >=1 independent replay success
- replay success rate across persisted recipes = 100%
- every successful build/replay has `final.country === input.country`
- unknown/alias planner fields accepted = 0
- unconstrained country filter omissions accepted = 0
- replay planner/repair calls = 0
- source/operation/host-policy violations = 0
- redirects followed = 0
- credentials = 0
- arbitrary code = 0
- fingerprints/evidence persisted

Otherwise: `REASSESS_TYPED_CONSTRAINT_COMPOSITION`.

## Interpretation boundary

A GO proves bounded typed autonomous manufacturing/composition with explicit entity-constraint preservation on fresh country inputs. It does not prove general entity resolution, fuzzy matching, open-web manufacturing, or unrestricted multi-hop planning.
