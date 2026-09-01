# Product Lambda.1 — POST OpenAPI Compiler

Lambda.1 closes the compile-time gap between autonomous provider discovery and the generalized HTTP runtime introduced in Product Lambda.

## What it adds

- OpenAPI operation selection can inspect both `GET` and `POST`.
- Relevant `GET` operations keep priority so existing autonomous Theta acquisition does not regress.
- When no relevant GET exists, a relevant OpenAPI 3 `POST` can be compiled.
- `application/json` top-level object request bodies are converted deterministically to `body_bindings`.
- Required body properties become `$input.<field>` bindings.
- Documented examples, enum values and defaults can be harvested as evidence-backed candidate inputs.
- POST candidates surface as `needs_safe_verification` even when two grounded inputs are available.

## Safety boundary

Compilation is not verification.

Lambda.1 intentionally does **not** let Theta live-replay a newly discovered POST operation. `verifySupplyCandidate()` still accepts GET only and fails closed for POST. The orchestrator recognizes `needs_safe_verification` and never invokes acquisition for such a candidate.

This prevents discovery from causing unknown side effects such as creating records, sending messages, initiating purchases or mutating provider state.

## Supported POST shape

Lambda.1 currently requires:

- OpenAPI 3 request body
- `application/json`
- top-level object schema
- statically declared properties
- deterministic top-level response object projection
- static HTTPS provider base URL

Nested request-body compilation, multipart/form-data, arbitrary arrays, Swagger 2 body parameters and autonomous credential provisioning remain outside this milestone.

## Next boundary

A future safe-verification layer can promote selected POST candidates only when side effects can be controlled explicitly, for example through provider-declared sandbox/test environments, dry-run/idempotency contracts, or a human-approved verification policy. Until then, POST discovery stops at `needs_safe_verification`.
