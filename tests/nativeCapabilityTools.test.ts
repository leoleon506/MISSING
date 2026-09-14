import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { nativeCapabilityToolDescriptors, nativeCapabilityToolName } from "../src/mcp/nativeCapabilities.js";
import { VERIFIED_RECIPES } from "../src/runtime/recipes.js";

const originalEconomicsJson = process.env.MISSING_ECONOMICS_JSON;
const originalMinMargin = process.env.MISSING_MIN_MARGIN_MICROUSD;
const nativeSource = readFileSync(new URL("../src/mcp/nativeCapabilities.ts", import.meta.url), "utf8");
const adapterSource = readFileSync(new URL("../src/mcp/nativeMcpX402.ts", import.meta.url), "utf8");
const serverSource = readFileSync(new URL("../src/mcp/server.ts", import.meta.url), "utf8");

beforeEach(() => {
  process.env.MISSING_ECONOMICS_JSON = JSON.stringify({
    recipes: {
      "3b3d8e080a59f5f341c4faf6f035b5336343c16af162424854bdb3017f64bfb6": {
        provider_cost_microusd: 0,
        customer_price_microusd: 5000,
      },
    },
  });
  process.env.MISSING_MIN_MARGIN_MICROUSD = "0";
});

afterEach(() => {
  if (originalEconomicsJson === undefined) delete process.env.MISSING_ECONOMICS_JSON;
  else process.env.MISSING_ECONOMICS_JSON = originalEconomicsJson;
  if (originalMinMargin === undefined) delete process.env.MISSING_MIN_MARGIN_MICROUSD;
  else process.env.MISSING_MIN_MARGIN_MICROUSD = originalMinMargin;
});

describe("native capability MCP tools", () => {
  it("exposes every unique replay-verified capability as a direct tool", () => {
    const expected = [...new Set(VERIFIED_RECIPES.map(recipe => recipe.capability))].sort();
    const actual = nativeCapabilityToolDescriptors().map(tool => tool.capability).sort();
    expect(actual).toEqual(expected);
  });

  it("uses capability identifiers as stable native tool names", () => {
    expect(nativeCapabilityToolName("currency_exchange_rate")).toBe("currency_exchange_rate");
    expect(nativeCapabilityToolName("resolve_capability")).toBeNull();
    expect(nativeCapabilityToolName("Bad Tool Name")).toBeNull();
  });

  it("derives typed required input fields from replay-verified example inputs", () => {
    const ip = nativeCapabilityToolDescriptors().find(tool => tool.capability === "ip_geolocation_metadata");
    expect(ip).toBeDefined();
    expect(ip!.inputSchema.safeParse({ ip_address: "1.1.1.1" }).success).toBe(true);
    expect(ip!.inputSchema.safeParse({}).success).toBe(false);

    const exchange = nativeCapabilityToolDescriptors().find(tool => tool.capability === "currency_exchange_rate");
    expect(exchange).toBeDefined();
    expect(exchange!.inputSchema.safeParse({ base_currency: "usd", quote_currency: "eur" }).success).toBe(true);
    expect(exchange!.description).toContain("x402-paid MCP tool");
  });

  it("mounts native tools before meta-tools on the anonymous MCP server", () => {
    const publicStart = serverSource.indexOf("export function createPublicProductServer");
    const publicEnd = serverSource.indexOf("export function createProductServer", publicStart);
    const body = serverSource.slice(publicStart, publicEnd);
    expect(body.indexOf("registerNativeCapabilityTools(server)")).toBeGreaterThanOrEqual(0);
    expect(body.indexOf("registerNativeCapabilityTools(server)")).toBeLessThan(body.indexOf("registerPublicProductTools(server)"));
  });

  it("routes native execution through the MCP adapter and canonical agent payment engine only", () => {
    expect(nativeSource).toContain("handleNativeCapabilityMcpPayment");
    expect(nativeSource).not.toContain("publicPaidResolutionHandoff");
    expect(nativeSource).not.toContain("resolveCapability(");
    expect(nativeSource).not.toContain('from "../runtime/executor.js"');

    expect(adapterSource).toContain("handleAgentPaidResolution");
    expect(adapterSource).not.toContain("resolveCapability(");
    expect(adapterSource).not.toContain("verifyX402Payment(");
    expect(adapterSource).not.toContain("settleX402Payment(");
  });
});
