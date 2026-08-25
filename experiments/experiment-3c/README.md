# MISSING Experiment 3C — Stratified Primitive Discovery

## Purpose

Retest autonomous OpenAPI primitive discovery after 3B showed severe lexicographic/provider concentration and stale-spec failures.

3C keeps APIs.guru as the discovery source and still uses **no LLM** and **no paid APIs**.

## Frozen sampling algorithm

1. Fetch `https://api.apis.guru/v2/list.json`.
2. Sort all API ids lexicographically.
3. Compute a deterministic stride across the full directory: `stride = floor(total_ids / 300)` with minimum 1.
4. Walk ids at that stride until at most 300 APIs have been considered.
5. Before a second API id with the same root provider/domain is considered, every unseen root provider encountered in the walk gets priority.
6. Fetch at most 150 OpenAPI documents.
7. Consider only HTTPS GET operations with no declared global/operation security.
8. Required parameters are allowed only when example/default/enum values exist.
9. Before contract induction, perform a lightweight live preflight to the constructed URL. Only HTTP 2xx JSON responses continue to contract induction.
10. Induce one scalar export path/type from the documented 2xx JSON schema and validate it against the preflight body.
11. Re-probe every admitted contract once more unchanged.

No API-specific allowlists, provider-specific fixes, or hand-selected endpoints are allowed after preregistration.

## Limits

- max APIs considered: **300**
- max OpenAPI specs fetched: **150**
- max preflights: **40**
- max second probes: **15**
- max admitted contracts: **15**
- request spacing: **150 ms**

## Preregistered gates

`GO_STRATIFIED_PRIMITIVE_DISCOVERY` iff all are true:

- at least **5** contracts admitted
- at least **5 distinct root providers/domains** represented
- preflight HTTP+JSON success rate among constructed candidates >= **50%**
- schema/export match rate among successful preflights >= **70%**
- second-probe validation rate for admitted contracts = **100%**
- no admitted contract declares authentication/security in its OpenAPI operation/global scope
- host-policy violations = **0**
- raw sampling order, provider keys, rejection reasons, induced contracts, preflight results, and second-probe evidence are persisted

Otherwise decision is `REASSESS_STRATIFIED_PRIMITIVE_DISCOVERY`.
