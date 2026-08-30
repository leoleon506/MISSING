import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { resetDemand } from "../src/runtime/discovery.js";
import { VERIFIED_RECIPES } from "../src/runtime/recipes.js";
import { healthPayload, productMcpHandler } from "../src/mcp/http.js";

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
afterAll(async () => productMcpHandler.close());

describe("MISSING Product Delta remote MCP edge", () => {
  it("connects in-process and discovers the Product Alpha/Beta/Gamma tools", async () => {
    const { client, transport } = clientForHandler();
    await client.connect(transport);
    const tools = await client.listTools();
    const names = tools.tools.map(tool => tool.name);
    expect(names).toEqual(expect.arrayContaining([
      "list_verified_capabilities",
      "search_verified_capabilities",
      "resolve_capability",
      "missing_runtime_health",
      "record_missing_capability_demand",
      "missing_demand_snapshot",
    ]));
    await client.close();
  });

  it("searches verified capabilities remotely", async () => {
    const { client, transport } = clientForHandler();
    await client.connect(transport);
    const result = await client.callTool({ name: "search_verified_capabilities", arguments: { query: "locate this IP address" } });
    expect(parsedText(result).matches[0]?.capability).toBe("ip_geolocation_metadata");
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
