# MISSING Experiment 3O — Multi-Family Autonomous Gap Fill

## Purpose

Test whether MISSING can manufacture and reuse typed capabilities across multiple unrelated public-data families instead of succeeding only on one country/capital pattern.

3O tests three frozen families with one shared source catalog. The planner must select the appropriate source and construct a strict typed recipe using the same minimal DSL.

## Frozen source catalog

The planner sees all three sources for every case.

1. `crossref_work`
   - family: scholarly metadata
   - GET `https://api.crossref.org/works/{doi}`
   - input arg: `doi`
   - JSON contains a `message` object with DOI, title, publisher and other metadata.

2. `openmeteo_current`
   - family: weather/environment
   - GET `https://api.open-meteo.com/v1/forecast?latitude={latitude}&longitude={longitude}&current=temperature_2m,weather_code&timezone=UTC`
   - input args: `latitude`, `longitude`
   - JSON contains echoed coordinates plus `current.time`, `current.temperature_2m`, `current.weather_code`.

3. `usgs_feed`
   - family: earthquakes/scientific monitoring
   - GET `https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/{window}.geojson`
   - input arg: `window`, frozen enum `all_day|all_week`
   - JSON contains `features`; first feature is used as the latest feed item for this bounded experiment.

No credentials.

## Frozen cases

### A — scholarly DOI metadata
Build: `{ "doi":"10.1038/nphys1170" }`
Replay: `{ "doi":"10.1126/science.169.3946.635" }`
Intent: return DOI, first title and publisher for the supplied DOI.
Required source: `crossref_work`.
Required output fields: `doi`, `title`, `publisher`.

### B — current weather by coordinates
Build: `{ "latitude":40.7128, "longitude":-74.0060 }`
Replay: `{ "latitude":35.6762, "longitude":139.6503 }`
Intent: return current temperature, weather code and observation time for the supplied coordinates.
Required source: `openmeteo_current`.
Required output fields: `temperature`, `weather_code`, `time`.

### C — latest earthquake feed item
Build: `{ "window":"all_day" }`
Replay: `{ "window":"all_week" }`
Intent: return id, magnitude, place and event time for the first item in the requested official USGS feed window.
Required source: `usgs_feed`.
Required output fields: `id`, `magnitude`, `place`, `time`.

## Canonical typed DSL

Every plan is exactly:

1. `SOURCE`
2. `PROJECT_PATHS`
3. `OUTPUT`

Strict shapes, no additional properties:

- Crossref SOURCE: `{ "op":"SOURCE", "source_id":"crossref_work", "args":{"doi":"$input.doi"} }`
- Weather SOURCE: `{ "op":"SOURCE", "source_id":"openmeteo_current", "args":{"latitude":"$input.latitude", "longitude":"$input.longitude"} }`
- USGS SOURCE: `{ "op":"SOURCE", "source_id":"usgs_feed", "args":{"window":"$input.window"} }`
- PROJECT_PATHS: `{ "op":"PROJECT_PATHS", "fields": { "output_name":"json.path" } }`
- OUTPUT: `{ "op":"OUTPUT" }`

Allowed JSON paths are source-contract bounded. Numeric path segments address arrays, e.g. `message.title.0` or `features.0.properties.mag`.

No regex, eval, shell, Python, JavaScript, filesystem, writes, credentials, arbitrary HTTP, planner-defined functions or additional transforms.

## Planner contract

Strict top-level schema:

- `case_id`
- `decision: MANUFACTURE|REJECT`
- `reason`
- `ops`

Unknown fields rejected. One bounded repair call is allowed after planner-contract/static failure or static-valid live failure. Repair cannot change cases, source catalog, DSL, safety rules or gates.

## Static family/source gate

Each case has a frozen required family and required source. A plan using another source is rejected before network execution.

Three explicit synthetic wrong-source negative controls are also run through the static validator; all must be rejected.

## Semantic validators

A: output DOI must case-insensitively equal input DOI; title and publisher must be non-empty strings.

B: temperature and weather_code must be finite numbers; time must be a non-empty string.

C: id and place must be non-empty strings; magnitude and time must be finite numbers.

## Network safety

Same strengthened outbound HTTP gate as 3M/3N2: HTTPS only; reject IP literals; DNS resolution before request; require public globally routable resolved addresses; reject private/loopback/link-local/reserved ranges; redirects disabled and 3xx rejected; persist network evidence.

## Replay

Persisted recipes replay on the frozen independent input for the same family with zero planner/repair calls.

## Preregistered GO gates

`GO_MULTI_FAMILY_AUTONOMOUS_GAP_FILL` iff all are true:

- >=2 distinct families have MANUFACTURE decisions
- >=2 distinct families have strict typed static-valid plans
- >=2 distinct families have live semantic success
- >=2 distinct families have independent replay success
- replay success rate across persisted recipes = 100%
- wrong-source accepted = 0
- explicit negative controls rejected = 100%
- unknown/alias fields accepted = 0
- replay planner/repair calls = 0
- source/operation/host-policy violations = 0
- redirects followed = 0
- credentials = 0
- arbitrary code = 0
- fingerprints/evidence persisted

Otherwise: `REASSESS_MULTI_FAMILY_AUTONOMOUS_GAP_FILL`.

## Interpretation boundary

A GO would demonstrate bounded typed autonomous capability manufacture and recipe reuse across at least two unrelated families from a small approved source catalog with distractors. It would not prove open-web source discovery, arbitrary API understanding, unrestricted composition, commercial demand, or paid execution.
