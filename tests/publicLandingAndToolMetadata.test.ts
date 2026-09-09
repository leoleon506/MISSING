import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { publicLandingHtml } from "../src/mcp/publicLanding.js";

describe("public launch surface", () => {
  it("renders a product landing with MCP, A2A, and x402 endpoints", () => {
    const html = publicLandingHtml("https://missing.example");
    expect(html).toContain("MISSING — Capability Fallback Network for AI Agents");
    expect(html).toContain("https://missing.example/mcp");
    expect(html).toContain("https://missing.example/.well-known/agent-card.json");
    expect(html).toContain("https://missing.example/v1/agent/resolve");
    expect(html).toContain("search_verified_capabilities");
    expect(html).toContain("record_missing_capability_demand");
    expect(html).toContain("resolve_capability");
    expect(html).toContain("https://smithery.ai/servers/leo-leon506/missing");
  });

  it("does not expose sensitive runtime configuration on the landing", () => {
    const html = publicLandingHtml("https://missing.example");
    for (const forbidden of [
      "MISSING_POSTGRES_URL",
      "MISSING_CONTROL_PLANE_TOKEN",
      "PAYER_PRIVATE_KEY",
      "PAYMENT-SIGNATURE values",
    ]) expect(html).not.toContain(forbidden);
  });

  it("keeps agent-facing descriptions and parameter guidance on every public MCP tool", () => {
    const source = readFileSync(new URL("../src/mcp/product.ts", import.meta.url), "utf8");
    for (const tool of [
      "list_verified_capabilities",
      "search_verified_capabilities",
      "record_missing_capability_demand",
      "resolve_capability",
    ]) {
      const index = source.indexOf(`server.registerTool(\"${tool}\"`);
      expect(index).toBeGreaterThan(-1);
      const block = source.slice(index, index + 3500);
      expect(block).toContain("title:");
      expect(block).toContain("description:");
      expect(block).toContain("annotations:");
    }
    expect(source).toContain("query: z.string().min(2).describe(");
    expect(source).toContain("limit: z.number().int().min(1).max(20).optional().describe(");
    expect(source).toContain("intent: z.string().min(2).describe(");
    expect(source).toContain("capability: z.string().min(1).describe(");
    expect(source).toContain("input: z.record(z.string(), z.unknown()).describe(");
  });
});
