# Product Lambda — HTTP Capability Core

Lambda generalizes the verified capability runtime beyond GET-only execution while preserving MISSING's trust boundary.

## Scope

A `VerifiedRecipe` may now execute:

- `GET`
- `POST` with a deterministic top-level JSON body
- declarative non-sensitive request headers
- runtime credential references resolved from environment variables

Existing GET recipes are unchanged. The new fields are optional, so historical supply ledger entries and frozen experiment recipes remain compatible.

## JSON request bodies

POST recipes use `body_bindings`:

```json
{
  "body_bindings": {
    "email": "$input.email",
    "country": "$input.country"
  }
}
```

The executor renders a JSON object from the current runtime input and sends it with `Content-Type: application/json`.

Lambda intentionally supports only deterministic top-level input bindings in this milestone. Nested templates, multipart forms and arbitrary scripting are not supported.

## Credentials

Secrets are never stored in recipes or the supply ledger.

Recipes reference a credential key:

```json
{
  "credential_bindings": [
    {
      "location": "header",
      "name": "Authorization",
      "credential_key": "provider.api_key",
      "prefix": "Bearer "
    }
  ]
}
```

The runtime resolves `provider.api_key` from:

```text
MISSING_CREDENTIAL_PROVIDER_API_KEY
```

Missing credentials fail before the provider network request. Runtime attempts contain no request headers or body, so credential values are not emitted into attempt telemetry.

Sensitive values must not be placed in `static_headers`. Authorization, cookies, API-key/token/secret-style headers and transport-controlled headers are rejected there and must use `credential_bindings` instead.

## Side-effect safety boundary

Lambda expands **execution**, not autonomous mutation discovery.

Theta/OpenAPI acquisition remains GET-only by design:

- POST-only OpenAPI operations are not compiled into automatic acquisition candidates.
- Product Theta does not replay/probe unknown POST operations.
- AgentRank background exploration filters out POST recipes.
- A POST recipe may execute only after it is already present as a replay-verified recipe and an explicit capability request routes to it.

This prevents MISSING from creating resources, sending messages, charging accounts or causing other side effects merely while searching for supply.

## Persistence

The supply ledger accepts replay-verified GET and POST recipes. Credential bindings persist only credential **keys**, never credential values.

## Not included yet

Lambda does not add:

- autonomous verification of unknown POST operations
- OAuth refresh/token acquisition flows
- nested JSON body templates
- multipart/form-data or file upload
- non-JSON response parsing
- arbitrary provider-specific code execution
- provider credential acquisition

Those require separate safety and verification milestones.
