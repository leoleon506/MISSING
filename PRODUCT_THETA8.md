# Product Theta.8 — Provider Readiness Diagnostics

Theta.8 distinguishes a relevant provider that is not yet automatable from a provider that is simply irrelevant or invalid.

## Why this exists

The first production acquisition loop eventually isolated one relevant provider for the Finnish VAT demand: `VAT API`. Its OpenAPI contract exposed two concrete blockers:

- a required API-key credential;
- no documented success-response schema that MISSING can project deterministically.

Previously this collapsed into a generic `rejected` outcome. That loses valuable supply intelligence.

## New compiler outcome

`compileOpenApiLead()` can now return:

```text
needs_provider_setup
```

alongside structured diagnostics:

```json
{
  "provider_readiness": {
    "credentials_required": ["apikey"],
    "response_schema_missing": true
  },
  "missing": ["credential:apikey", "response_schema"]
}
```

## Detection

Theta.8 detects credential requirements from:

- required OpenAPI/Swagger header parameters;
- OpenAPI/Swagger security requirements.

It also detects when the selected success response has no documented schema.

## Orchestrator behavior

Theta.4 now propagates a terminal product state:

```text
needs_provider_setup
```

when a relevant provider exists but cannot safely enter automatic replay verification.

This is different from:

- `rejected` — a candidate was structurally or operationally rejected;
- `needs_evidence` — a compilable provider lacks two grounded replay inputs;
- `no_candidates` — discovery found no relevant provider;
- `promoted` — live verification passed and the recipe was registered.

## Trust boundary

Theta.8 does **not**:

- fetch or invent credentials;
- accept secrets from anonymous callers;
- infer undocumented response schemas;
- bypass Theta replay verification;
- promote a provider that has not passed existing gates.

It only makes the blocking reason explicit so future provider acquisition work can target the right missing prerequisite.
