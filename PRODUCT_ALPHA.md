# MISSING Product Alpha

MISSING is moving from experiment-first development to a product runtime.

This alpha exposes a small set of capabilities backed only by recipes that survived the 5B14 changed-input replay and remained healthy in 5B15. It intentionally refuses capabilities whose recipe is not currently trusted rather than inventing a request.

## Product path

`capability request -> trusted recipe registry -> live provider execution -> output projection -> runtime health`

The runtime includes:

- a registry of replay-verified recipes;
- deterministic input binding and URL rendering;
- live HTTP execution;
- required-output projection;
- per-attempt telemetry;
- a basic circuit breaker after repeated provider failures;
- explicit `unavailable` when no trusted recipe exists.

## Current product capabilities

- `country_alpha_metadata` via Warnely
- `pokemon_name_metadata` via Pokéapi
- `chess_player_metadata` via Chess.com
- `television_show_metadata` via TVMaze
- `satellite_catalog_metadata` via OrbitalWiki
- `ip_geolocation_metadata` via ipwhois

`english_word_definition_metadata` is deliberately excluded because its Free Dictionary recipe failed the 5B15 resilience replay.

## Use

```sh
npm ci
npm run build
npm test

npm run missing -- list
npm run missing -- resolve ip_geolocation_metadata '{"ip_address":"1.1.1.1"}'
npm run missing -- resolve pokemon_name_metadata '{"pokemon_name":"bulbasaur"}'
```

A successful resolution returns the provider, immutable recipe fingerprint, projected output, HTTP status, latency, URL, and attempt trace.

## What this alpha is not

It does not yet perform open-web provider discovery in the request path. Discovery/learning remains an offline capability-acquisition pipeline until it can reliably manufacture verified alternatives. The runtime never promotes an unverified request into production automatically.

## Next product milestones

1. expose `resolve_capability` through the MCP server so an external agent can call the runtime directly;
2. persist health and recipe state instead of keeping it process-local;
3. add multiple verified recipes per capability so the runtime can perform actual failover;
4. move acquisition into a background/offline onboarding pipeline that only publishes recipes after verification;
5. meter successful executions and rescue events for commercial testing.

Experiments remain available as evidence and regression tests, but they are no longer the primary delivery unit.
