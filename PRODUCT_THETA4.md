# Product Theta.4 — End-to-End Demand-to-Supply Orchestrator

Theta.4 composes the already-separated MISSING product stages into one auditable trusted-worker cycle.

## Pipeline

1. Rank unresolved durable demand and select the highest-priority opportunity.
2. Discover structured provider leads using Theta.1.
3. Try leads in deterministic rank order.
4. Compile the demand-relevant OpenAPI GET operation using Theta.2.
5. Reuse Theta.3 evidence-backed verification-input harvesting.
6. Skip leads that are unsupported or still lack two independent replay inputs.
7. For a Theta-ready candidate, run live replay verification and durable promotion using Product Theta.
8. Continue to the next provider after a rejection.
9. Return a terminal result plus a stage-by-stage trace.

## Terminal outcomes

- `promoted`: a provider passed live replay gates and the verified recipe is registered (or was already registered).
- `rejected`: discovered/compilable candidates were tried but none passed the verification/promotion boundary.
- `needs_evidence`: at least one relevant provider could be compiled but no candidate had two evidence-backed replay inputs.
- `no_candidates`: no unresolved demand exists, discovery returned no provider leads, or the directory could not produce candidates.

## MCP

Trusted workers get one composition tool:

`run_supply_acquisition_cycle`

The tool is disabled by default. Enable it only on an isolated trusted worker:

`MISSING_THETA_ORCHESTRATOR_ENABLED=1`

The existing stage-level controls remain separate. A production trusted worker is expected to enable the upstream/downstream stages it deliberately operates, while the anonymous Railway sandbox keeps all acquisition controls disabled.

## Trust boundary

Theta.4 adds orchestration, not authority. It cannot bypass:

- demand ranking;
- provider discovery evidence;
- deterministic OpenAPI compilation;
- evidence-backed verification-input rules;
- Theta live replay verification;
- durable verified-recipe promotion.

No failed or unverified candidate is published as executable supply.

## Observability

`/healthz` and `/readyz` expose:

`theta_orchestrator_enabled`

The orchestrator returns an ordered `trace` with opportunity selection, discovery, compilation, and verify/promote outcomes so an acquisition cycle can be audited after the fact.
