import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { x402DiscoveryResources, x402WellKnownDocument } from "../src/runtime/x402Discovery.js";

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
      return item.resource === "https://missing.example/v1/agent/resolve"
        && item.type === "http"
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

  it("publishes well-known aliases that point agents to canonical discovery and payment endpoints", () => {
    expect(x402WellKnownDocument("https://missing.example/")).toEqual({
      x402Version: 2,
      service: {
        name: "MISSING",
        description: "Replay-verified capabilities for AI agents with x402-paid execution.",
      },
      discovery: {
        resources: "https://missing.example/discovery/resources",
        aliases: [
          "https://missing.example/.well-known/x402",
          "https://missing.example/.well-known/x402.json",
        ],
      },
      paymentEndpoint: "https://missing.example/v1/agent/resolve",
    });
  });
});
