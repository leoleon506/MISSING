# Experiment 4A-R4 — Response-Grounded Contract Recovery

## Status
Development/recovery only over the already-burned 4A workload. No fresh blind evidence is consumed.

## Frozen parent evidence
- 4A-R3 merge SHA: `c355bd4f57bc1372d263ae2e9c73f7e47d59ebb9`
- 4A-R3 run: `33025835333`
- job: `98366799367`
- artifact: `9628592181`
- artifact digest: `sha256:5a7aa865e01c86fa08a3b250c64d25efceb46347afafafae7866b350a4378023`
- report fingerprint: `f243bde38de59f68317c12fafc6351f4bead5491160502b736ba385a9205354f`
- ledger fingerprint: `230d972621cc9d98012b63dd9e780aea7e511ad6a4f54a1fc19fc547db2fb44d`

## Frozen R3 outcome
- 24 cases / 8 families
- 5 successful manufactures / 5 families / 5 providers
- 5 persisted recipes
- 4/5 changed-input replay = 80%
- 23 live calls
- total LLM cost `$0.4239672`
- mean LLM cost/success `$0.08479344`
- median success latency `14.476s`
- p90 success latency `31.626s`
- 42/42 controls
- safety counters all zero

## Motivation
R3 proved the typed request/projection/binding pipeline can manufacture and replay recipes across multiple independent providers. Remaining failures are now concentrated in response-shape/semantic mismatch and a small number of mechanically normalizable request forms.

Observed generic near-miss classes:
1. documented relative path combined with a base URL that already contains a path;
2. array response fields rejected by text-token grounding despite valid structural evidence;
3. contracts that pass static validation but fail the first live semantic check because the projection does not match the actual JSON response shape;
4. insufficient replay diagnostics for the single failed persisted recipe.

## Allowed generic changes
1. **Relative path canonicalization**: combine a documented base URL path with a documented relative endpoint path into one canonical origin + absolute path. No provider/case table and no endpoint invention.
2. **Array-aware structural grounding**: accept numeric array indices structurally while still requiring non-numeric field tokens/evidence grounding.
3. **One response-grounded repair after first live failure**:
   - only when the first live request returns successful JSON;
   - preserve provider, origin, HTTP GET, path template, path/query bindings and cited documentation evidence;
   - provide only a bounded structural summary of the returned JSON plus the original contract/projection and semantic failure reason;
   - permit changes only to the projection program;
   - validate the repaired projection through the existing 3X DSL validator and semantic validator;
   - require a fresh second live call and the normal confirmation verification before persistence.
4. Record bounded diagnostics/fingerprint for failed replay responses without adding cognitive calls during replay.

## Forbidden
- provider-, domain-, endpoint- or case-specific rules/maps
- hand-authored recipes or projections
- changing the exact 24 cases, inputs or semantic validators
- provider-specific ordering
- changing R2 retrieval/reranker breadth
- weakening HTTPS/GET/DNS/private-host/credential/authorization controls
- using response-grounded repair to mutate host, URL, path, query parameters or bindings
- consuming new blind holdouts

## Isolation
Retrieval, provider selection, documentation acquisition, standard spec probing, typed bindings, 3X executor, semantic validators, safety controls and original 4A thresholds remain frozen unless explicitly listed above.

## Formal gates
Same original 4A breadth/economics gates:
- >=12/24 successful manufactures
- >=6/8 successful families
- >=8 distinct provider hosts
- double live verification for all persisted recipes
- >=95% changed-input replay
- replay catalog/reranker/docs/synthesis deltas all zero
- 42/42 controls
- event-derived safety clean
- median success latency <=90s
- p90 success latency <=180s
- mean LLM cost/success <=$0.15
- total LLM cost <=$3.00

Formal decision:
- `GO_4A_R4_RESPONSE_GROUNDED_RECOVERY`
- otherwise `REASSESS_4A_R4_RESPONSE_GROUNDED_RECOVERY`

A GO is engineering recovery evidence only. Fresh blind breadth validation is required afterward.
