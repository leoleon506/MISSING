# Product Theta.2 — OpenAPI to Candidate Recipe Compiler

Product Theta.2 connects provider discovery to Theta's verification gate without weakening MISSING's trust boundary.

```text
unresolved demand
      ↓
Theta.1 provider lead
      ↓
OpenAPI document
      ↓
relevant GET operation selection
      ↓
deterministic candidate recipe draft
      ↓
real verification inputs available?
  no ─────> needs_verification_inputs
  yes
   ↓
Theta replay verification
   ↓
verified promotion only if every gate passes
```

## What Theta.2 does

Given an unverified provider lead from Theta.1, the compiler:

1. fetches its OpenAPI/Swagger document;
2. considers GET operations only;
3. scores operations against the unresolved demand intent;
4. chooses the highest-scoring operation deterministically;
5. derives a static HTTPS base URL;
6. converts required path/query parameters into `$input.*` bindings;
7. derives a top-level JSON object projection from the response schema;
8. creates a stable candidate ID;
9. returns a `SupplyCandidate` draft compatible with Product Theta.

## What Theta.2 does not do

Compilation is not verification.

Theta.2 does not:

- call the discovered provider endpoint;
- claim the API actually works;
- invent missing output fields;
- invent replay inputs;
- register a recipe;
- persist supply;
- promote a provider.

Only Product Theta can verify and promote supply after repeated live replay.

## Verification-input boundary

Theta requires at least two independent replay inputs. OpenAPI documents often describe shapes but do not provide two trustworthy real examples.

When fewer than two real inputs are supplied, Theta.2 returns:

`status = needs_verification_inputs`

The compiled candidate remains a draft and cannot pass Theta verification.

When two or more real inputs are supplied, Theta.2 returns:

`status = candidate_ready`

This still means only "ready to verify", not "verified".

## Supported OpenAPI shapes

This milestone intentionally supports a narrow, auditable subset:

- OpenAPI 3.x static HTTPS `servers[0].url`;
- Swagger 2.0 HTTPS `host` + `basePath`;
- GET operations;
- required path parameters;
- required query parameters;
- JSON object response schemas;
- top-level scalar/object-field projection by field name;
- local `$ref` resolution for common response/schema references.

Dynamic server templates, primitive-only responses, non-GET operations, and shapes that cannot be projected deterministically fail closed as `unsupported`.

## MCP tool

`compile_openapi_candidate`

The tool is disabled by default on the public runtime. Enable it only on a trusted compiler worker:

`MISSING_OPENAPI_COMPILER_ENABLED=1`

The tool also rejects spec URLs that are not credential-free public HTTPS hostnames.

## Observability

`/healthz` and `/readyz` expose:

`openapi_compiler_enabled`

The Railway public sandbox should keep this value `false`.

## Scientific boundary

Theta.2 is production code. It does not modify frozen experiments or claim experiment-backed provenance for compiled provider leads.

The compiler produces proposals only. Product Theta remains the sole authority for live replay verification and durable promotion.

## Acceptance criteria

Theta.2 is complete when CI proves that:

1. the most demand-relevant GET operation is selected over unrelated endpoints;
2. path bindings are derived deterministically;
3. top-level response projection is derived deterministically;
4. missing replay inputs produce `needs_verification_inputs` rather than invented data;
5. two supplied replay inputs produce a Theta-compatible `candidate_ready` draft;
6. Swagger 2 HTTPS host/basePath compilation works;
7. unsupported response shapes fail closed;
8. the public runtime keeps OpenAPI compilation disabled by default;
9. Alpha through Theta.1 remain green.
