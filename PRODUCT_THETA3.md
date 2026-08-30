# Product Theta.3 — Evidence-backed Verification Input Harvesting

Product Theta.3 closes the remaining manual gap between an OpenAPI candidate draft and Product Theta replay verification when the API contract itself documents usable request values.

## Goal

Turn explicit request examples already present in the selected OpenAPI operation into two independent replay inputs without inventing data.

Pipeline:

```text
unresolved demand
  -> Theta.1 provider discovery
  -> Theta.2 OpenAPI candidate compilation
  -> Theta.3 documented input harvesting
  -> Theta live replay verification
  -> durable promotion only if every replay passes
```

## Evidence accepted

Theta.3 only accepts values explicitly present in the API contract:

- parameter `example`;
- parameter `examples`;
- schema `example`;
- schema `enum` values;
- schema `default`.

No random values, LLM-generated examples, inferred identifiers, guessed VAT numbers, synthetic UUIDs, or fabricated test data are accepted.

## Independence rule

Theta requires at least two complete and distinct replay inputs.

Theta.3 builds one complete input from the first documented value for every required path/query parameter. It may build a second input only when at least one required parameter has a second distinct documented value.

A single documented value is not duplicated to satisfy the gate.

## Multi-parameter requests

Every required path/query input must have grounded evidence before automatic harvesting can succeed.

Example:

```text
country enum: [FI, SE]
vat_number example: 12345678
```

produces:

```json
[
  { "country": "FI", "vat_number": "12345678" },
  { "country": "SE", "vat_number": "12345678" }
]
```

## Provenance

Compilation returns `verification_input_evidence` describing the exact documented values and their source type. This makes the transition from documentation to replay auditable.

## Caller-supplied inputs

Explicit `verification_inputs` supplied by a trusted caller continue to take priority. Theta.3 harvesting is used only when the caller does not supply that field.

## Trust boundary

Theta.3 does not call provider endpoints, does not decide whether a provider works, does not persist a recipe, and does not promote capabilities.

Only Product Theta can verify a candidate live and promote it after all replay gates pass.

## Fail-closed behavior

If the contract does not contain enough grounded evidence for two complete distinct requests, the compiler remains at:

```text
needs_verification_inputs
```

The pipeline waits for trustworthy input evidence instead of manufacturing it.
