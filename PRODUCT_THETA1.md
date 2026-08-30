# Product Theta.1 — Automatic Provider Discovery

Theta.1 adds the upstream discovery stage that Product Theta intentionally left pluggable.

```text
persistent unresolved demand
        ↓
Theta opportunity ranking
        ↓
structured provider-directory search
        ↓
ranked provider/spec leads
        ↓
(unverified boundary)
        ↓
Theta candidate compilation + replay verification
        ↓
verified promotion only
```

## Purpose

MISSING already knows what agents are asking for and can safely verify/promote a proposed provider recipe. Theta.1 removes the first manual step: finding plausible providers that may satisfy the highest-priority unresolved demand.

Provider discovery is intentionally probabilistic. Discovery results are **leads, not capabilities**. A result cannot execute, enter `VERIFIED_RECIPES`, or claim to satisfy demand until a later candidate has passed Product Theta's deterministic replay gates.

## Initial adapter: APIs.guru OpenAPI Directory

The first adapter queries the public APIs.guru directory (`https://api.apis.guru/v2/list.json`). The directory is useful as a discovery source because entries expose structured API metadata and links to OpenAPI specifications.

Theta.1:

- takes the highest-priority unresolved demand from the durable Zeta ledger;
- tokenizes the intent/capability description;
- searches provider IDs, API titles and descriptions;
- selects the directory's preferred API version when available;
- requires a structured OpenAPI spec URL;
- ranks candidates by query coverage and stronger title/provider-ID matches;
- returns the spec URL and directory metadata for downstream inspection.

The adapter contract is isolated so additional discovery sources can be added later without changing Product Theta's verification boundary.

## Runtime API

`discoverProviderCandidates(opportunity)` searches one supply opportunity.

`discoverTopSupplyCandidates()` automatically takes the top unresolved opportunities from `rankSupplyOpportunities()` and searches provider candidates for each one.

MCP tool:

- `discover_supply_candidates`

The MCP tool is disabled by default on the anonymous public runtime. A trusted discovery worker must explicitly set:

```text
MISSING_PROVIDER_DISCOVERY_ENABLED=1
```

Optional directory override:

```text
MISSING_PROVIDER_DIRECTORY_URL=<catalog URL>
```

This makes testing and future controlled mirrors possible without changing product code.

## Security and trust boundary

Theta.1 does not call discovered provider APIs and does not promote anything.

The anonymous Railway sandbox keeps both:

- `provider_discovery_enabled = false`
- `supply_acquisition_enabled = false`

A future trusted worker can enable provider discovery independently from supply verification/promotion. This prevents arbitrary public users from turning MISSING into a catalog-fetch or outbound-verification proxy.

## Relationship to Product Theta

Theta.1 produces a **ProviderDiscoveryCandidate**, which contains discovery evidence such as provider name, OpenAPI spec URL and relevance score.

It deliberately does not fabricate the richer `SupplyCandidate` required by Product Theta. Turning an OpenAPI operation into a deterministic MISSING recipe requires a separate documentation/spec compilation stage plus verification inputs. That will be the next product step.

The invariant remains:

> Discovery may be broad and probabilistic; executable supply must be deterministic and replay verified.

## Acceptance criteria

Theta.1 is complete when CI proves that:

1. discovery is disabled by default and explicitly opt-in;
2. structured directory entries are ranked against unresolved demand;
3. the preferred API version and its OpenAPI spec URL are selected;
4. unrelated APIs and entries without a spec are excluded;
5. the durable demand ranking automatically drives the discovery queue;
6. directory failures fail closed rather than producing fake candidates;
7. existing Alpha–Theta behavior remains green.
