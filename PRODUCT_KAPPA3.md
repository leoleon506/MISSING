# Product Kappa.3 — Autonomous Agent Payments

Kappa.3 adds an agent-native payment path to MISSING. A caller does not need a prepaid MISSING account before requesting a capability.

## Product flow

1. Agent POSTs `{ capability, input }` to `/v1/agent/resolve`.
2. MISSING quotes the capability using explicit Kappa economics.
3. If no payment authorization is present, MISSING responds `402 Payment Required` with an x402 v2 `PAYMENT-REQUIRED` header.
4. The agent signs/authorizes the exact x402 payment and retries with `PAYMENT-SIGNATURE`.
5. MISSING asks the configured facilitator to verify the authorization without settling it.
6. Only after verification does MISSING execute the replay-verified provider capability.
7. If provider execution fails, MISSING does not settle the agent payment and recognizes no customer revenue.
8. If provider execution succeeds, MISSING asks the facilitator to settle the payment.
9. Only after successful settlement does MISSING record customer revenue, provider cost and gross margin and return the provider result with `PAYMENT-RESPONSE`.

This ordering intentionally follows the x402 authorization flow: verify -> resource -> settle -> respond.

## Why x402 first

MISSING capabilities are expected to have prices such as USD 0.003–0.01. With USDC using six decimal atomic units, Kappa's integer micro-USD price maps directly to the x402 `amount` field for a USD-denominated stablecoin rail.

Stripe remains useful for larger machine payments and future MPP integration, but a Stripe fiat charge is not the primary rail for sub-cent MISSING calls because Stripe charge amounts are denominated in the currency's smallest fiat unit and normal minimum-charge constraints still apply.

## Configuration

Kappa.3 is disabled by default.

Required to expose the paid endpoint:

- `MISSING_AGENT_PAYMENTS_ENABLED=1`
- `MISSING_X402_ENABLED=1`
- `MISSING_X402_NETWORK=<CAIP-2 network, e.g. eip155:84532>`
- `MISSING_X402_ASSET=<token contract / supported asset>`
- `MISSING_X402_PAY_TO=<merchant wallet>`
- `MISSING_X402_FACILITATOR_URL=<facilitator base URL>`

Optional:

- `MISSING_X402_FACILITATOR_BEARER=<facilitator bearer token>`
- `MISSING_X402_MAX_TIMEOUT_SECONDS=60`
- `MISSING_X402_LEDGER=<explicit JSONL path>`

When the economics ledger is under `/data`, the default x402 ledger is `/data/x402.jsonl`.

## HTTP surface

`POST /v1/agent/resolve`

Request body:

```json
{
  "capability": "country_alpha_metadata",
  "input": { "country_code": "NZ" }
}
```

Unpaid response:

- HTTP 402
- `PAYMENT-REQUIRED: <base64url x402 PaymentRequired>`
- JSON body mirrors the PaymentRequired object

Paid retry:

- same JSON body
- `PAYMENT-SIGNATURE: <base64url x402 PaymentPayload>`

Successful response:

- HTTP 200
- `PAYMENT-RESPONSE: <base64url settlement response>`
- JSON contains payment settlement metadata plus the normal MISSING resolution

## Accounting semantics

A 402 challenge is not revenue.

A successful facilitator `/verify` is not revenue.

Provider execution success by itself is not revenue.

Revenue is recognized only after facilitator settlement succeeds.

For a 5000 micro-USD customer price and a 1000 micro-USD provider cost:

- customer revenue: 5000 micro-USD
- provider cost: 1000 micro-USD
- MISSING gross margin: 4000 micro-USD

The durable x402 ledger stores only settlement/accounting metadata. It does not persist user input, prompts, provider output, payment signatures, or provider URLs. The payment signature is represented only by a SHA-256 hash.

## Current limitations

- v1 supports one configured x402 exact-payment offer at a time.
- The configured asset is treated as the settlement asset for the USD-denominated Kappa quote. Stablecoin depeg/FX risk is not modeled yet.
- Facilitator authentication is bearer-token based when configured; CDP JWT generation is outside this milestone.
- The current JSONL settlement ledger is single-instance/sandbox durability, not distributed atomic financial storage.
- A provider may incur cost even if settlement later fails. Provider-attempt cost accounting remains a separate Kappa hardening item.
- Response replay after a settled payment does not persist the capability output; a lost successful HTTP response cannot currently be reconstructed from the financial ledger.
- MPP/Stripe and x402 MCP/A2A transport signaling are future extensions; this milestone establishes the autonomous HTTP payment path first.
