import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const readme=readFileSync("experiments/experiment-3d/README.md","utf8");

describe("Experiment 3D preregistration",()=>{
  it("freezes Official MCP Registry source",()=>{
    expect(readme).toContain("registry.modelcontextprotocol.io/v0.1/servers?version=latest&limit=100");
  });
  it("freezes live MCP discovery gates",()=>{
    expect(readme).toContain("at least **5 live MCP servers** admitted");
    expect(readme).toContain("at least **20 tools** discovered");
    expect(readme).toContain("first-list success rate among attempted eligible remote servers >= **40%**");
    expect(readme).toContain("second fresh-connection persistence rate for admitted servers = **100%**");
  });
  it("forbids tool execution and credentials",()=>{
    expect(readme).toContain("Never call `callTool()`");
    expect(readme).toContain("tool calls executed = **0**");
    expect(readme).toContain("credentials supplied = **0**");
  });
});
