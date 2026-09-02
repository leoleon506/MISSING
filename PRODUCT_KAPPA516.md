# Product Kappa.5.16 — Strict Chain Finality Policy

## Goal

Close the final x402 hardening gap in the Kappa.5.x line: confirmation depth must be an explicit, valid policy for the exact chain being settled. Invalid or missing configuration must never silently degrade to one confirmation.

## Invariant

**A settlement proof may query chain state only after resolving a valid finality policy for the exact CAIP-2 network. Missing, malformed, zero, negative, non-integer, or uncovered policy fails closed before RPC.**

## Production policy resolution

Precedence:

1. `MISSING_X402_FINALITY_POLICIES` — JSON object keyed by exact network, for example:

   ```json
   {"eip155:84532":5,"eip155:1":12}
   ```

   If this environment variable is present, the complete map must be valid and the requested network must be present. Invalid JSON or an uncovered network does not fall through to another source.

2. `MISSING_X402_MIN_CONFIRMATIONS` — legacy compatibility only. If present, it must be a strict positive integer. `0`, negatives, decimals, empty strings, or non-numeric values are invalid and fail closed.

3. Built-in compatibility policy — currently only `eip155:84532: 1`, preserving the historical Kappa/Base-Sepolia proof behavior while remaining chain-scoped and explicit in code.

All other chains require operator configuration.

## Failure semantics

Configuration failures return settlement proof state `unavailable`, not `failed`. This distinction is intentional:

- new settlement cannot be committed without a valid finality policy;
- the post-settlement Kappa.5.15 monitor does not falsely quarantine a previously valid payment because an operator mistyped configuration;
- no RPC call is made before policy validation succeeds.

## Evidence

`src/experimentKappa516.ts` proves:

- the built-in compatibility policy is scoped only to `eip155:84532`;
- an unconfigured chain fails closed before RPC;
- legacy `0` never falls back to `1`;
- malformed per-chain JSON fails closed before RPC;
- a valid map must contain the exact requested network;
- a valid explicit per-chain policy controls the required confirmation depth used by the exact settlement proof.

Formal decision: `GO_STRICT_CHAIN_FINALITY_POLICY`.

## Kappa.5.x line closure

Kappa.5.16 is the planned final security-hardening milestone for the distributed x402 money core. Subsequent work should move to operational readiness (load, observability, deployment, incident controls) rather than extending the Kappa.5.x security sequence by default.
