import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { resetDemand } from "../src/runtime/discovery.js";
import { VERIFIED_RECIPES } from "../src/runtime/recipes.js";
import { healthPayload, productMcpHandler } from "../src/mcp/http.js";
import { nativeCapabilityToolName } from "../src/mcp/nativeCapabilities.js";

const PAID_CAPABILITY = "ip_geolocation_metadata";
const PAID_FINGERPRINT = "3b3d8e080a59f5f341c4faf6f035b5336343c16af162424854bdb3017f64bfb6";
const PAID_INPUT = { ip_address: "1.1.1.1" };
const BASE_USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const priorEconomicsJson = process.env.MISSING_ECONOMICS_JSON;

beforeAll(() => {
  process.env.MISSING_ECONOMICS_JSON = JSON.stringify({
    recipes: {
      [PAID_FINGERPRINT]: {
        provider_cost_microusd: 0,
        customer_price_microusd: 5000,
      },
    },
  });
  vi.stubEnv("MISSING_AGENT_PAYMENTS_ENABLED", "1");
  vi.stubEnv("MISSING_X402_ENABLED", "1");
  vi.stubEnv("MISSING_PRODUCTION_ADMISSION_ENABLED", "0");
  vi.stubEnv("MISSING_X402_NETWORK", "eip155:8453");
  vi.stubEnv("MISSING_X402_ASSET", BASE_USDC);
  vi.stubEnv("MISSING_X402_PAY_TO", "0x1111111111111111111111111111111111111111");
  vi.stubEnv("MISSING_X402_FACILITATOR_URL", "https://facilitator.example");
});

function clientForHandler() {
  const client = new Client({ name: "missing-product-delta-test", version: "1.0.0" });
  const transport = new StreamableHTTPClientTransport(new URL("http://missing.test/mcp"), {
    fetch: (url, init) => productMcpHandler.fetch(new Request(url, init)),
  });
  return { client, transport };
}

function parsedText(result: { content?: unknown[] }): any {
  const first = result.content?.[0] as { type?: string; text?: string } | undefined;
  if (!first || first.type !== "text" || typeof first.text !== "string") throw new Error("Expected text MCP result");
  return JSON.parse(first.text);
}

function expectedPublicToolNames() {
  const native = [...new Set(VERIFIED_RECIPES.map(recipe => nativeCapabilityToolName(recipe.capability)).filter((name): name is string => Boolean(name)))];
  return [
    ...native,
    "list_verified_capabilities",
    "record_missing_capability_demand",
    "resolve_capability",
    "search_verified_capabilities",
  ].sort();
}

afterEach(() => resetDemand());
afterAll(async () => {
  if (priorEconomicsJson === undefined) delete process.env.MISSING_ECONOMICS_JSON;
  else process.env.MISSING_ECONOMICS_JSON = priorEconomicsJson;
  vi.unstubAllEnvs();
  await productMcpHandler.close();
});

describe("MISSING Product Delta remote MCP edge", () => {
  it("connects in-process and exposes native capabilities plus only the anonymous consumer surface", async () => {
    const { client, transport } = clientForHandler();
    await client.connect(transport);
    const tools = await client.listTools();
    const names = tools.tools.map(tool => tool.name).sort();

    expect(names).toEqual(expectedPublicToolNames());
    expect(names).toContain(PAID_CAPABILITY);

    for (const trustedOnly of [
      "missing_runtime_health",
      "missing_demand_snapshot",
      "missing_supply_opportunities",
      "discover_supply_candidates",
      "verify_supply_candidate",
      "acquire_verified_supply_candidate",
      "missing_agent_rank",
      "missing_economics",
      "missing_prepaid_credits",
      "compile_openapi_candidate",
      "run_supply_acquisition_cycle",
      "resolve_capability_charged",
    ]) expect(names).not.toContain(trustedOnly);

    await client.close();
  });

  it("searches verified capabilities remotely", async () => {
    const { client, transport } = clientForHandler();
    await client.connect(transport);
    const result = await client.callTool({ name: "search_verified_capabilities", arguments: { query: "locate this IP address" } });
    expect(parsedText(result).matches[0]?.capability).toBe("ip_geolocation_metadata");
    await client.close();
  });

  it("returns a standard MCP x402 PaymentRequired result from a native capability without executing a provider", async () => {
    expect(VERIFIED_RECIPES.some(recipe => recipe.recipe_fingerprint === PAID_FINGERPRINT && recipe.capability === PAID_CAPABILITY)).toBe(true);
    const { client, transport } = clientForHandler();
    await client.connect(transport);

    const result = await client.callTool({ name: PAID_CAPABILITY, arguments: PAID_INPUT });
    const parsed = parsedText(result);

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toEqual(parsed);
    expect(parsed).toMatchObject({
      x402Version: 2,
      resource: {
        url: `mcp://tool/${PAID_CAPABILITY}`,
        mimeType: "application/json",
        serviceName: "MISSING",
      },
      accepts: [{
        scheme: "exact",
        network: "eip155:8453",
        amount: "5000",
        asset: BASE_USDC,
      }],
    });
    expect(parsed).not.toHaveProperty("resolution");
    await client.close();
  });

  it("keeps generic resolve_capability as the canonical HTTP x402 compatibility handoff", async () => {
    const { client, transport } = clientForHandler();
    await client.connect(transport);
    const result = await client.callTool({
      name: "resolve_capability",
      arguments: { capability: PAID_CAPABILITY, input: PAID_INPUT },
    });
    const parsed = parsedText(result);
    expect(parsed.status).toBe("payment_required");
    expect(parsed.rail).toBe("x402");
    expect(parsed.endpoint).toBe("/v1/agent/resolve");
    expect(parsed.method).toBe("POST");
    expect(parsed.customer_price_microusd).toBe(5000);
    expect(parsed.request).toEqual({ capability: PAID_CAPABILITY, input: PAID_INPUT });
    await client.close();
  });

  it("records unknown demand through remote MCP", async () => {
    const { client, transport } = clientForHandler();
    await client.connect(transport);
    const result = await client.callTool({ name: "record_missing_capability_demand", arguments: { intent: "Validate this Finnish VAT number" } });
    expect(parsedText(result).recorded.normalized_intent).toBe("validate this finnish vat number");
    await client.close();
  });

  it("reports safe health metadata without provider calls", () => {
    const health = healthPayload();
    expect(health.status).toBe("ok");
    expect(health.capability_count).toBe(new Set(VERIFIED_RECIPES.map(recipe => recipe.capability)).size);
    expect(health.recipe_count).toBe(VERIFIED_RECIPES.length);
  });
});
