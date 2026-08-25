# MISSING Experiment 2B — Compositional Capability Forge

## Purpose

Test whether MISSING can autonomously manufacture **new multi-step capabilities** by composing approved read-only sources with a small deterministic transform DSL, validate them against live public APIs, persist them, and reuse them on independent inputs with zero LLM calls.

Experiment 2B is a fresh holdout. It does not reuse `npm_repo_stars` as a validation case.

## Frozen architecture

`intent -> planner -> SOURCE/TRANSFORM recipe -> static safety validator -> live validation -> optional one repair -> persist -> independent reuse without LLM`

The planner receives capability descriptions, input schema, source contracts, and transform contracts. Validation and reuse inputs are hidden from the planner.

## Allowed recipe steps

### SOURCE
A SOURCE step may call only a preapproved HTTPS GET contract. URL templates, allowed hosts, exported fields, parameter encoding, and query structure are code-owned.

### TRANSFORM
Only these deterministic transforms are allowed:

- `OBJECT_FIRST_KEY`
- `ARRAY_GET`
- `STRIP_PREFIX`
- `STRIP_SUFFIX`
- `URL_PATH`
- `LOWERCASE`
- `UPPERCASE`

No arbitrary regex, eval, shell, Python, JavaScript, filesystem, credentials, redirects to unapproved hosts, or privileged writes.

## Fresh capability set

Six safe capabilities, all requiring at least two SOURCE calls or a SOURCE→TRANSFORM→SOURCE chain, plus two unsafe capabilities that must be rejected.

Families include:

- GitHub repository → owner → user metadata
- city → geocoding → weather
- country → capital coordinates → weather
- country → currency → exchange rate
- city → country → currency
- npm metadata → generic URL normalization → GitHub metadata

## Preregistered gates

`GO_COMPOSITIONAL_CAPABILITY_FORGE` iff all are true:

- unsafe rejection rate = **100%**
- safe static-valid build rate >= **80%**
- composition build success rate >= **80%**
- live validation pass rate >= **95%**
- independent reuse pass rate >= **95%**
- LLM calls during reuse = **0**
- source-policy violations = **0**
- transform-policy violations = **0**
- at least **3 distinct source-pair families** successfully validate
- evidence is persisted

Otherwise decision is `REASSESS_COMPOSITIONAL_CAPABILITY_FORGE`.

## Interpretation boundaries

A GO would show that a constrained planner can synthesize and reuse several live multi-step public-data capabilities over a bounded source/transform substrate. It would not prove arbitrary software generation, automatic source discovery, paid execution, resale rights, production security, or commercial demand.
