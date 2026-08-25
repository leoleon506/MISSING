# MISSING Experiment 3B — Autonomous Primitive Discovery & Contract Induction

## Purpose

Test whether MISSING can discover previously-unloaded public API primitives from a machine-readable directory, induce an executable read-only contract from OpenAPI, and verify that contract live before admitting it to the Capability Graph.

3B uses **no LLM** and **no paid APIs**.

## Frozen discovery source

APIs.guru directory API:

- `https://api.apis.guru/v2/list.json`

The directory is treated only as a source of candidate OpenAPI definitions. MISSING must still validate the actual upstream API live.

## Frozen selection algorithm

1. Fetch `list.json`.
2. Sort API ids lexicographically.
3. Inspect at most the first **250** APIs.
4. For each preferred version, fetch the advertised OpenAPI document.
5. Consider only HTTPS `GET` operations with no declared operation/global security requirement.
6. Required path/query parameters are allowed only when OpenAPI provides an `example`, `default`, or first `enum` value.
7. Select the first documented JSON 2xx response schema with at least one scalar leaf (`string`, `number`, `integer`, `boolean`).
8. Build the request from the OpenAPI server/base URL, path, and documented parameter examples.
9. Probe the live API. Admit the candidate only when the request succeeds with JSON and the induced export path exists with the documented type.
10. Re-probe every admitted contract once more. The second probe must still satisfy the induced contract without modifying it.

No API-specific allowlist, provider-specific repair, or hand-selected endpoint may be introduced after preregistration.

## Limits

- max APIs inspected: **250**
- max OpenAPI documents fetched: **120**
- max live candidate probes: **30**
- max admitted contracts retained: **10**
- request spacing: **150 ms**

## Preregistered gates

`GO_AUTONOMOUS_PRIMITIVE_DISCOVERY` iff all are true:

- at least **5** contracts are autonomously admitted
- admitted contracts span at least **4 distinct API providers/ids**
- first-probe contract success rate among executable candidates >= **60%**
- second-probe validation rate for admitted contracts = **100%**
- every admitted contract has an induced scalar export path and type
- zero admitted contracts declare authentication/security in the inspected OpenAPI operation
- host-policy violations = **0**
- raw discovery evidence, OpenAPI source URLs, induced contracts, probe results, and rejection reasons are persisted

Otherwise decision is `REASSESS_AUTONOMOUS_PRIMITIVE_DISCOVERY`.

## Interpretation boundary

A GO would prove machine-readable discovery and induction from OpenAPI plus live verification. It would not prove discovery from arbitrary prose documentation, MCP/A2A registries, paid execution, licensing/resale rights, or commercial demand.
