import { quoteCapability } from "./charging.js";
import type { ConsumerEntryChannel } from "./consumerTelemetry.js";
import type { RuntimeInput } from "./types.js";

export const PUBLIC_PAID_RESOLUTION_PATH = "/v1/agent/resolve";
export const PUBLIC_ENTRY_CHANNEL_HEADER = "X-MISSING-Entry-Channel";

export function publicPaidResolutionHandoff(
  capability: string,
  input: RuntimeInput,
  entryChannel: ConsumerEntryChannel = "http",
) {
  const quote = quoteCapability(capability);
  if (quote.status !== "quoted") return quote;

  return {
    status: "payment_required" as const,
    rail: "x402" as const,
    endpoint: PUBLIC_PAID_RESOLUTION_PATH,
    method: "POST" as const,
    customer_price_microusd: quote.customer_price_microusd,
    currency: quote.currency,
    request: {
      capability,
      input,
    },
    request_headers: {
      [PUBLIC_ENTRY_CHANNEL_HEADER]: entryChannel,
    },
    instructions: [
      `POST this exact request body to the endpoint with ${PUBLIC_ENTRY_CHANNEL_HEADER}: ${entryChannel} and without PAYMENT-SIGNATURE to receive the current x402 PAYMENT-REQUIRED challenge.`,
      "Sign that challenge with an x402-compatible payer, then retry the same request body with the exact PAYMENT-SIGNATURE header and the same entry-channel header.",
      "Do not generate a second authorization for a payment already associated with a known transaction; retry the exact signature for recovery.",
    ],
  };
}
