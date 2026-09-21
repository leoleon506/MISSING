import { quoteCapability } from "./charging.js";
import { VERIFIED_RECIPES } from "./recipes.js";
import { x402BazaarDiscoveryExtension } from "./x402Bazaar.js";
import { x402Requirements } from "./x402.js";

export interface X402DiscoveryQuery {
  type?: string;
  payTo?: string;
  scheme?: string;
  network?: string;
  extensions?: string;
  limit?: number;
  offset?: number;
}

function boundedInteger(value: number | undefined, fallback: number, min: number, max: number): number {
  return Number.isSafeInteger(value) ? Math.min(max, Math.max(min, value!)) : fallback;
}

export function x402DiscoveryResources(baseUrl: string, query: X402DiscoveryQuery = {}) {
  const normalized = baseUrl.replace(/\/$/, "");
  const resolveUrl = `${normalized}/v1/agent/resolve`;
  const capabilities = [...new Set(VERIFIED_RECIPES.map(recipe => recipe.capability))].sort();
  const lastUpdated = new Date().toISOString();

  let items = capabilities.flatMap(capability => {
    const quote = quoteCapability(capability);
    if (quote.status !== "quoted") return [];

    const accepts = x402Requirements(quote.customer_price_microusd);
    if (!accepts) return [];

    const recipe = VERIFIED_RECIPES.find(item => item.capability === capability);
    if (!recipe) return [];

    return [{
      resource: resolveUrl,
      type: "http",
      x402Version: 2,
      accepts: [accepts],
      lastUpdated,
      extensions: x402BazaarDiscoveryExtension({
        capability,
        input: recipe.example_input,
        customerPriceMicrousd: quote.customer_price_microusd,
      }),
    }];
  });

  if (query.type) items = items.filter(item => item.type === query.type);
  if (query.payTo) items = items.filter(item => item.accepts.some(accept => accept.payTo === query.payTo));
  if (query.scheme) items = items.filter(item => item.accepts.some(accept => accept.scheme === query.scheme));
  if (query.network) items = items.filter(item => item.accepts.some(accept => accept.network === query.network));
  if (query.extensions) items = items.filter(item => query.extensions!.split(",").every(key => key in item.extensions));

  const total = items.length;
  const limit = boundedInteger(query.limit, 20, 1, 100);
  const offset = boundedInteger(query.offset, 0, 0, Number.MAX_SAFE_INTEGER);

  return {
    x402Version: 2 as const,
    items: items.slice(offset, offset + limit),
    pagination: { limit, offset, total },
  };
}

export function x402WellKnownDocument(baseUrl: string) {
  const normalized = baseUrl.replace(/\/$/, "");
  return {
    x402Version: 2 as const,
    service: {
      name: "MISSING",
      description: "Replay-verified capabilities for AI agents with x402-paid execution.",
    },
    discovery: {
      resources: `${normalized}/discovery/resources`,
      aliases: [
        `${normalized}/.well-known/x402`,
        `${normalized}/.well-known/x402.json`,
      ],
    },
    paymentEndpoint: `${normalized}/v1/agent/resolve`,
  };
}
