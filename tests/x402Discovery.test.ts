import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { x402DiscoveryResources, x402LlmsText, x402OpenApiDocument, x402WellKnownDocument } from "../src/runtime/x402Discovery.js";

const ECONOMICS = {
  recipes: {
    "3b3d8e080a59f5f341c4faf6f035b5336343c16af162424854bdb3017f64bfb6": {
      provider_cost_microusd: 0,
      customer_price_microusd: 5000,
    },
  },
};

beforeEach(() => {
  vi.stubEnv("MISSING_ECONOMICS_JSON", JSON.stringify(ECONOMICS));
  vi.stubEnv("MISSING_MIN_MARGIN_MICROUSD", "0");
  vi.stubEnv("MISSING_X402_ENABLED", "1");
  vi.stubEnv("MISSING_PRODUCTION_ADMISSION_ENABLED", "0");
  vi.stubEnv("MISSING_X402_NETWORK", "eip155:8453");
  vi.stubEnv("MISSING_X402_ASSET", "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913");
  vi.stubEnv("MISSING_X402_PAY_TO", "0x1111111111111111111111111111111111111111");
  vi.stubEnv("MISSING_X402_FACILITATOR_URL", "https://facilitator.example");
  vi.stubEnv("MISSING_X402_MAX_TIMEOUT_SECONDS", "60");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("x402 public discovery", () => {
  it("publishes spec-shaped v2 resources only for priced and payable capabilities", () => {
    const catalog = x402DiscoveryResources("https://missing.example");

    expect(catalog.x402Version).toBe(2);
    expect(catalog.pagination.total).toBeGreaterThan(0);
    expect(catalog.items.some(item => {
      const bazaar = (item.extensions as any).bazaar;
      return item.resource === "https://missing.example/v1/agent/resolve/ip_geolocation_metadata"
        && item.type === "http"
        && item.method === "POST"
        && item.x402Version === 2
        && item.accepts.some(accept => accept.network === "eip155:8453" && accept.amount === "5000")
        && bazaar?.info?.input?.body?.capability === "ip_geolocation_metadata";
    })).toBe(true);
  });

  it("supports x402 v2 list filters and pagination", () => {
    const matching = x402DiscoveryResources("https://missing.example", {
      type: "http",
      payTo: "0x1111111111111111111111111111111111111111",
      scheme: "exact",
      network: "eip155:8453",
      extensions: "bazaar",
      limit: 1,
      offset: 0,
    });
    expect(matching.items).toHaveLength(1);
    expect(matching.pagination.limit).toBe(1);
    expect(matching.pagination.total).toBeGreaterThan(0);

    const none = x402DiscoveryResources("https://missing.example", { network: "eip155:1" });
    expect(none.items).toHaveLength(0);
    expect(none.pagination.total).toBe(0);
  });

  it("embeds payable resources directly in well-known discovery", () => {
    const manifest = x402WellKnownDocument("https://missing.example/");
    expect(manifest.x402Version).toBe(2);
    expect(manifest.name).toBe("MISSING");
    expect(manifest.discovery.resources).toBe("https://missing.example/discovery/resources");
    expect(manifest.discovery.openapi).toBe("https://missing.example/openapi.json");
    expect(manifest.discovery.llms).toBe("https://missing.example/llms.txt");
    expect(manifest.items.length).toBeGreaterThan(0);
    expect(manifest.resources).toEqual(manifest.items);
    expect(manifest.items.some(item =>
      item.metadata.capability === "ip_geolocation_metadata"
      && item.resource === "https://missing.example/v1/agent/resolve/ip_geolocation_metadata"
      && item.method === "POST"
      && item.accepts[0].network === "eip155:8453"
    )).toBe(true);
  });

  it("publishes OpenAPI and llms discovery surfaces for autonomous agents", () => {
    const openapi = x402OpenApiDocument("https://missing.example");
    expect(openapi.openapi).toBe("3.1.0");
    expect(openapi.paths["/v1/agent/resolve/ip_geolocation_metadata"]).toBeTruthy();
    expect((openapi.paths["/v1/agent/resolve/ip_geolocation_metadata"] as any).post.responses["402"]).toBeTruthy();

    const llms = x402LlmsText("https://missing.example");
    expect(llms).toContain("https://missing.example/.well-known/x402");
    expect(llms).toContain("POST https://missing.example/v1/agent/resolve/ip_geolocation_metadata");
    expect(llms).toContain("PAYMENT-SIGNATURE");
  });
});
