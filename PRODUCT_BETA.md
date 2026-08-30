# MISSING Product Beta — Runtime Failover

Product Beta turns the Product Alpha resolver into a real multi-provider reliability path.

## First live failover capability

`country_alpha_metadata`

Primary:
- provider: Warnely
- endpoint: `https://www.warnely.com/api/v1/countries/{iso}`
- provenance: replay-verified in Experiments 5B14/5B15

Backup:
- provider: countries.dev
- endpoint: `https://countries.dev/alpha/{code}`
- no API key required
- product-live verification inputs: `JP`, `US`
- documentation: `https://countries.dev/docs/api/alpha`

Both recipes project the same contract:

```json
{
  "country_code": "JP",
  "country_name": "Japan",
  "region": "Asia"
}
```

## Runtime behavior

`resolveCapability()` evaluates registered recipes in order.

1. Attempt the primary recipe.
2. On HTTP, transport, JSON, or projection failure, record the failed attempt.
3. Continue immediately with the next independent verified recipe.
4. Return the first complete projected output.
5. After two consecutive failures, open that recipe's circuit for 60 seconds.
6. While the circuit is open, skip the unhealthy recipe and route directly to the backup.

The response preserves every attempted provider, HTTP status, latency and error so callers can distinguish normal success from rescued success.

## Product contract

MISSING does not fabricate fallback integrations. A provider is included in the runtime only after it has a concrete recipe, independent endpoint and replay/live verification evidence.

Experiments remain historical evidence and regression infrastructure; Product Beta development is driven by operational capabilities and reliability outcomes.
