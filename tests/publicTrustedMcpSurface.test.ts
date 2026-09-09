import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const serverSource = readFileSync(new URL("../src/mcp/server.ts", import.meta.url), "utf8");
const productSource = readFileSync(new URL("../src/mcp/product.ts", import.meta.url), "utf8");
const httpSource = readFileSync(new URL("../src/mcp/http.ts", import.meta.url), "utf8");

function functionBody(source: string, name: string): string {
  const start = source.indexOf(`export function ${name}`);
  expect(start, `${name} must exist`).toBeGreaterThanOrEqual(0);
  const next = source.indexOf("\nexport function ", start + 1);
  return source.slice(start, next === -1 ? source.length : next);
}

describe("public/trusted MCP surface boundary", () => {
  it("anonymous HTTP mounts only the public MCP server", () => {
    expect(httpSource).toContain('import { createPublicProductServer } from "./server.js"');
    expect(httpSource).toContain("createMcpHandler(() => createPublicProductServer())");
    expect(httpSource).not.toContain("createMcpHandler(() => createProductServer())");
  });

  it("public MCP server excludes compiler, orchestrator and charging registrars", () => {
    const body = functionBody(serverSource, "createPublicProductServer");
    expect(body).toContain("registerPublicProductTools(server)");
    expect(body).not.toContain("registerProductTools(server)");
    expect(body).not.toContain("registerChargingTools(server)");
    expect(body).not.toContain("registerOpenApiCompilerTool(server)");
    expect(body).not.toContain("registerThetaOrchestratorTool(server)");
  });

  it("public product tools exclude operator telemetry and supply mutation", () => {
    const body = functionBody(productSource, "registerPublicProductTools");
    for (const name of [
      "missing_demand_snapshot",
      "missing_supply_opportunities",
      "discover_supply_candidates",
      "verify_supply_candidate",
      "acquire_verified_supply_candidate",
      "missing_supply_promotion_evidence",
      "missing_agent_rank",
      "missing_economics",
      "missing_prepaid_credits",
      "missing_credit_account",
      "missing_runtime_health",
    ]) {
      expect(body).not.toContain(`server.registerTool(\"${name}\"`);
    }
  });

  it("trusted product tools retain operator-only capabilities", () => {
    const body = functionBody(productSource, "registerTrustedProductTools");
    for (const name of [
      "missing_demand_snapshot",
      "missing_supply_opportunities",
      "discover_supply_candidates",
      "verify_supply_candidate",
      "acquire_verified_supply_candidate",
      "missing_agent_rank",
      "missing_economics",
      "missing_prepaid_credits",
      "missing_runtime_health",
    ]) {
      expect(body).toContain(`server.registerTool(\"${name}\"`);
    }
  });
});
