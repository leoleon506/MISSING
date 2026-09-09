import type { RuntimeInput } from "./types.js";

interface PaymentHttpResult {
  status: number;
  headers?: Record<string, string>;
  body: unknown;
}

interface PaymentRequiredLike {
  x402Version: 2;
  error?: string;
  resource?: Record<string, unknown>;
  accepts?: unknown[];
  extensions?: Record<string, unknown>;
  [key: string]: unknown;
}

function isPaymentRequired(value: unknown): value is PaymentRequiredLike {
  return Boolean(value && typeof value === "object" && (value as { x402Version?: unknown }).x402Version === 2);
}

function bodySchema(capability: string) {
  return {
    type: "object",
    properties: {
      capability: { type: "string", const: capability },
      input: { type: "object", additionalProperties: true },
    },
    required: ["capability", "input"],
    additionalProperties: false,
  };
}

/**
 * x402 v2 Bazaar discovery metadata for MISSING's existing paid HTTP resource.
 *
 * This mirrors the JSON shape produced by @x402/extensions/bazaar for a POST JSON
 * endpoint, but deliberately has no dependency on an x402 payment wrapper. MISSING's
 * durable verify/settle/recovery rail remains the sole financial implementation.
 */
export function x402BazaarDiscoveryExtension(args: {
  capability: string;
  input: RuntimeInput;
  customerPriceMicrousd: number;
}) {
  const requestBody = { capability: args.capability, input: args.input };
  return {
    bazaar: {
      info: {
        input: {
          type: "http",
          method: "POST",
          bodyType: "json",
          body: requestBody,
        },
        output: {
          type: "json",
          example: {
            status: "resolved",
            payment: {
              rail: "x402",
              settled: true,
              amount_microusd: args.customerPriceMicrousd,
            },
            resolution: {
              status: "resolved",
              capability: args.capability,
              output: {},
            },
          },
        },
      },
      schema: {
        $schema: "https://json-schema.org/draft/2020-12/schema",
        type: "object",
        properties: {
          input: {
            type: "object",
            properties: {
              type: { type: "string", const: "http" },
              method: { type: "string", enum: ["POST", "PUT", "PATCH"] },
              bodyType: { type: "string", enum: ["json", "form-data", "text"] },
              body: bodySchema(args.capability),
            },
            required: ["type", "method", "bodyType", "body"],
            additionalProperties: false,
          },
          output: {
            type: "object",
            properties: {
              type: { type: "string" },
              example: { type: "object", additionalProperties: true },
            },
            required: ["type"],
          },
        },
        required: ["input"],
      },
    },
  };
}

function priceFromPaymentRequired(required: PaymentRequiredLike): number | null {
  const accept = Array.isArray(required.accepts) ? required.accepts[0] : null;
  if (!accept || typeof accept !== "object") return null;
  const raw = (accept as { amount?: unknown }).amount;
  const value = typeof raw === "string" ? Number(raw) : raw;
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : null;
}

function enrichPaymentRequired(required: PaymentRequiredLike, capability: string, input: RuntimeInput): PaymentRequiredLike {
  const price = priceFromPaymentRequired(required);
  if (price === null) return required;
  return {
    ...required,
    extensions: {
      ...(required.extensions ?? {}),
      ...x402BazaarDiscoveryExtension({ capability, input, customerPriceMicrousd: price }),
    },
  };
}

function decodeRequiredHeader(value: string): PaymentRequiredLike | null {
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as unknown;
    return isPaymentRequired(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function encodeRequiredHeader(value: PaymentRequiredLike): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

/**
 * Enrich only HTTP 402 responses at the public boundary. Non-402 responses and the
 * underlying payment state machine are untouched. Both the JSON body and the
 * PAYMENT-REQUIRED header are enriched so standards-based clients can echo the
 * extension into their x402 v2 PaymentPayload for facilitator-side discovery.
 */
export function enrichX402HttpResultWithBazaar(
  result: PaymentHttpResult,
  request: { capability: string; input: RuntimeInput },
): PaymentHttpResult {
  if (result.status !== 402) return result;

  const body = isPaymentRequired(result.body)
    ? enrichPaymentRequired(result.body, request.capability, request.input)
    : result.body;

  const headers = result.headers ? { ...result.headers } : {};
  const encoded = headers["PAYMENT-REQUIRED"];
  if (encoded) {
    const decoded = decodeRequiredHeader(encoded);
    if (decoded) headers["PAYMENT-REQUIRED"] = encodeRequiredHeader(enrichPaymentRequired(decoded, request.capability, request.input));
  } else if (isPaymentRequired(body)) {
    headers["PAYMENT-REQUIRED"] = encodeRequiredHeader(body);
  }

  return { ...result, headers, body };
}
