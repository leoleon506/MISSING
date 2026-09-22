import { quoteCapability } from "./charging.js";
import { VERIFIED_RECIPES } from "./recipes.js";
import type { RuntimeInput } from "./types.js";
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

export interface X402DiscoveryItem {
  resource: string;
  type: "http";
  x402Version: 2;
  serviceName: string;
  method: "POST";
  mimeType: "application/json";
  description: string;
  metadata: {
    capability: string;
    price: {
      mode: "fixed";
      currency: "USD";
      amount: string;
    };
    request: {
      contentType: "application/json";
      example: {
        capability: string;
        input: RuntimeInput;
      };
      schema: Record<string, unknown>;
    };
  };
  accepts: NonNullable<ReturnType<typeof x402Requirements>>[];
  lastUpdated: string;
  extensions: ReturnType<typeof x402BazaarDiscoveryExtension>;
}

function boundedInteger(value: number | undefined, fallback: number, min: number, max: number): number {
  return Number.isSafeInteger(value) ? Math.min(max, Math.max(min, value!)) : fallback;
}

function titleFromCapability(capability: string): string {
  return capability
    .split("_")
    .map(part => part ? `${part[0].toUpperCase()}${part.slice(1)}` : part)
    .join(" ");
}

function usdFromMicrousd(value: number): string {
  return (value / 1_000_000)
    .toFixed(6)
    .replace(/0+$/, "")
    .replace(/\.$/, "");
}

function jsonSchemaForExample(value: unknown): Record<string, unknown> {
  if (typeof value === "string") return { type: "string", example: value };
  if (typeof value === "number") return { type: "number", example: value };
  if (typeof value === "boolean") return { type: "boolean", example: value };
  if (Array.isArray(value)) {
    return {
      type: "array",
      items: value.length ? jsonSchemaForExample(value[0]) : {},
      example: value,
    };
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    return {
      type: "object",
      properties: Object.fromEntries(entries.map(([key, item]) => [key, jsonSchemaForExample(item)])),
      required: entries.map(([key]) => key),
      additionalProperties: false,
      example: value,
    };
  }
  return {};
}

function requestSchema(capability: string, input: RuntimeInput): Record<string, unknown> {
  return {
    type: "object",
    properties: {
      capability: { type: "string", const: capability },
      input: jsonSchemaForExample(input),
    },
    required: ["capability", "input"],
    additionalProperties: false,
  };
}

export function x402DirectResourceUrl(baseUrl: string, capability: string): string {
  return `${baseUrl.replace(/\/$/, "")}/v1/agent/resolve/${encodeURIComponent(capability)}`;
}

export function x402ExampleRequestForCapability(capability: string): { capability: string; input: RuntimeInput } | null {
  const recipe = VERIFIED_RECIPES.find(item => item.capability === capability);
  return recipe ? { capability, input: structuredClone(recipe.example_input) } : null;
}

export function x402DiscoveryItemForCapability(
  baseUrl: string,
  capability: string,
  lastUpdated = new Date().toISOString(),
): X402DiscoveryItem | null {
  const quote = quoteCapability(capability);
  if (quote.status !== "quoted") return null;

  const accepts = x402Requirements(quote.customer_price_microusd);
  if (!accepts) return null;

  const request = x402ExampleRequestForCapability(capability);
  if (!request) return null;

  return {
    resource: x402DirectResourceUrl(baseUrl, capability),
    type: "http",
    x402Version: 2,
    serviceName: `MISSING — ${titleFromCapability(capability)}`,
    method: "POST",
    mimeType: "application/json",
    description: `Execute replay-verified MISSING capability ${capability} through the canonical x402 settlement engine.`,
    metadata: {
      capability,
      price: {
        mode: "fixed",
        currency: "USD",
        amount: usdFromMicrousd(quote.customer_price_microusd),
      },
      request: {
        contentType: "application/json",
        example: request,
        schema: requestSchema(capability, request.input),
      },
    },
    accepts: [accepts],
    lastUpdated,
    extensions: x402BazaarDiscoveryExtension({
      capability,
      input: request.input,
      customerPriceMicrousd: quote.customer_price_microusd,
    }),
  };
}

function allDiscoveryItems(baseUrl: string): X402DiscoveryItem[] {
  const lastUpdated = new Date().toISOString();
  return [...new Set(VERIFIED_RECIPES.map(recipe => recipe.capability))]
    .sort()
    .map(capability => x402DiscoveryItemForCapability(baseUrl, capability, lastUpdated))
    .filter((item): item is X402DiscoveryItem => item !== null);
}

export function x402DiscoveryResources(baseUrl: string, query: X402DiscoveryQuery = {}) {
  let items = allDiscoveryItems(baseUrl);

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
  const items = allDiscoveryItems(normalized);
  const primary = items[0] ?? null;
  const payment = primary?.accepts[0] ?? null;

  return {
    x402Version: 2 as const,
    name: "MISSING",
    description: "Replay-verified capabilities for AI agents with direct x402-paid execution.",
    homepage: normalized,
    primaryResource: primary?.resource ?? `${normalized}/v1/agent/resolve`,
    ...(payment ? {
      scheme: payment.scheme,
      network: payment.network,
      asset: payment.asset,
      payTo: payment.payTo,
      payment: {
        x402: {
          primaryNetwork: payment.network,
          asset: payment.asset,
          assetSymbol: "USDC",
          payTo: payment.payTo,
        },
      },
    } : {}),
    discovery: {
      resources: `${normalized}/discovery/resources`,
      openapi: `${normalized}/openapi.json`,
      llms: `${normalized}/llms.txt`,
      aliases: [
        `${normalized}/.well-known/x402`,
        `${normalized}/.well-known/x402.json`,
      ],
    },
    items,
    resources: items,
  };
}

export function x402OpenApiDocument(baseUrl: string) {
  const normalized = baseUrl.replace(/\/$/, "");
  const items = allDiscoveryItems(normalized);
  const paths = Object.fromEntries(items.map(item => {
    const url = new URL(item.resource);
    return [url.pathname, {
      post: {
        operationId: `resolve_${item.metadata.capability}`,
        summary: item.serviceName,
        description: item.description,
        tags: ["x402", "MISSING"],
        "x-payment-info": {
          x402Version: 2,
          accepts: item.accepts,
        },
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: item.metadata.request.schema,
              example: item.metadata.request.example,
            },
          },
        },
        responses: {
          "200": {
            description: "Capability resolved and x402 payment settled.",
            content: {
              "application/json": {
                schema: { type: "object", additionalProperties: true },
              },
            },
          },
          "402": {
            description: "x402 payment required. Read the PAYMENT-REQUIRED header and retry the identical request with PAYMENT-SIGNATURE.",
            headers: {
              "PAYMENT-REQUIRED": {
                description: "Base64url-encoded x402 v2 PaymentRequired payload.",
                schema: { type: "string" },
              },
            },
          },
          "400": { description: "Invalid capability request body." },
          "404": { description: "Capability is unavailable or not currently payable." },
          "503": { description: "Payment rail or provider execution is temporarily unavailable." },
        },
      },
    }];
  }));

  return {
    openapi: "3.1.0",
    info: {
      title: "MISSING x402 Paid Capabilities",
      version: "0.2.0",
      description: "Direct x402-paid HTTP resources backed by replay-verified MISSING capabilities.",
    },
    servers: [{ url: normalized }],
    paths,
  };
}

export function x402LlmsText(baseUrl: string): string {
  const normalized = baseUrl.replace(/\/$/, "");
  const items = allDiscoveryItems(normalized);
  const lines = [
    "# MISSING",
    "",
    "MISSING provides replay-verified capabilities for AI agents. Discovery is free; direct execution is paid with x402 on the advertised network.",
    "",
    "## Machine discovery",
    `- x402 manifest: ${normalized}/.well-known/x402`,
    `- OpenAPI 3.1: ${normalized}/openapi.json`,
    `- x402 Bazaar list: ${normalized}/discovery/resources`,
    `- MCP: ${normalized}/mcp`,
    `- A2A Agent Card: ${normalized}/.well-known/agent-card.json`,
    "",
    "## Paid resources",
    ...items.map(item => `- POST ${item.resource} — ${item.serviceName} — $${item.metadata.price.amount} USD via x402 (${item.accepts[0].network})`),
    "",
    "Call a paid resource without PAYMENT-SIGNATURE to receive its authoritative HTTP 402 challenge, then retry the identical URL and body with the signed x402 payment payload.",
    "",
  ];
  return lines.join("\n");
}
