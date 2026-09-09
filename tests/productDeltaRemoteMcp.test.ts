import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { resetDemand } from "../src/runtime/discovery.js";
import { VERIFIED_RECIPES } from "../src/runtime/recipes.js";
import { healthPayload, productMcpHandler } from "../src/mcp/http.js";

const PAID_CAPABILITY = "canadian_holiday_metadata_by_id";
const PAID_FINGERPRINT = "50ef304cfeb2c67a3b4758e8c7dcc593b7f03de6516f48f12d7455e799075f2a";
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

afterEach(() => resetDemand());
afterAll(async () => {
  if (priorEconomicsJson === undefined) delete process.env.MISSING_ECONOMICS_JSON;
  else process.env.MISSING_ECONOMICS_JSON = priorEconomicsJson;
  await productMcpHandler.close();
});

describe("MISSING Product Delta remote MCP edge", () => {
  it("connects in-process and exposes only the anonymous consumer surface", async () => {
    const { client, transport } = clientForHandler();
    await client.connect(transport);
    const tools = await client.listTools();
    const names = tools.tools.map(tool => tool.name).sort();
    expect(names).toEqual(["list_verified_capabilities", "record_missing_capability_demand", "resolve_capability", "search_verified_capabilities"]);
    for (const trustedOnly of ["missing_runtime_health", "missing_demand_snapshot", "missing_supply_opportunities", "discover_supply_candidates", "verify_supply_candidate", "acquire_verified_supply_candidate", "missing_agent_rank", "missing_economics", "missing_prepaid_credits", "compile_openapi_candidate", "run_supply_acquisition_cycle", "resolve_capability_charged"]) expect(names).not.toContain(trustedOnly);
    await client.close();
  });

  it("searches verified capabilities remotely", async () => {
    const { client, transport } = clientForHandler();
    await client.connect(transport);
    const result = await client.callTool({ name: "search_verified_capabilities", arguments: { query: "locate this IP address" } });
    expect(parsedText(result).matches[0]?.capability).toBe("ip_geolocation_metadata");
    await client.close();
  });

  it("returns an x402 handoff instead of executing a provider", async () => {
    expect(VERIFIED_RECIPES.some(recipe => recipe.recipe_fingerprint === PAID_FINGERPRINT && recipe.capability === PAID_CAPABILITY)).toBe(true);
    const { client, transport } = clientForHandler();
    await client.connect(transport);
    const result = await client.callTool({
      name: "resolve_capability",
      arguments: { capability: PAID_CAPABILITY, input: { holidayId: 1, year: 2027 } },
    });
    const parsed = parsedText(result);
    expect(parsed.status).toBe("payment_required");
    expect(parsed.rail).toBe("x402");
    expect(parsed.endpoint).toBe("/v1/agent/resolve");
    expect(parsed.method).toBe("POST");
    expect(parsed.customer_price_microusd).toBe(5000);
    expect(parsed.request).toEqual({ capability: PAID_CAPABILITY, input: { holidayId: 1, year: 2027 } });
    expect(parsed).not.toHaveProperty("resolution");
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
