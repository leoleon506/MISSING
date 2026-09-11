import { afterEach, describe, expect, it } from "vitest";
import {
  discoveryChannelFromHeaders,
  discoveryClientHash,
  parseMcpInteractions,
} from "../src/runtime/discoveryTelemetry.js";

const originalSecret = process.env.MISSING_DISCOVERY_TELEMETRY_HMAC_SECRET;

afterEach(() => {
  if (originalSecret === undefined) delete process.env.MISSING_DISCOVERY_TELEMETRY_HMAC_SECRET;
  else process.env.MISSING_DISCOVERY_TELEMETRY_HMAC_SECRET = originalSecret;
});

describe("public discovery telemetry", () => {
  it("parses MCP initialize, list and tool calls without retaining arguments", () => {
    const body = Buffer.from(JSON.stringify([
      { jsonrpc: "2.0", id: 1, method: "initialize", params: { secret: "do-not-store" } },
      { jsonrpc: "2.0", id: 2, method: "tools/list" },
      {
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: {
          name: "search_verified_capabilities",
          arguments: { query: "private payload that must not enter telemetry" },
        },
      },
    ]));

    expect(parseMcpInteractions("POST", body)).toEqual([
      { event_type: "mcp_initialize", tool_name: null },
      { event_type: "mcp_tools_list", tool_name: null },
      { event_type: "mcp_tool_call", tool_name: "search_verified_capabilities" },
    ]);
  });

  it("does not retain invalid tool names or malformed MCP bodies", () => {
    expect(parseMcpInteractions("POST", Buffer.from("not-json"))).toEqual([
      { event_type: "mcp_other", tool_name: null },
    ]);

    const body = Buffer.from(JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name: "../../sensitive" },
    }));
    expect(parseMcpInteractions("POST", body)).toEqual([
      { event_type: "mcp_tool_call", tool_name: null },
    ]);
  });

  it("uses a keyed HMAC so raw client addresses are not stored", () => {
    process.env.MISSING_DISCOVERY_TELEMETRY_HMAC_SECRET = "0123456789abcdef0123456789abcdef";
    const first = discoveryClientHash("203.0.113.8");
    const second = discoveryClientHash("203.0.113.8");
    const other = discoveryClientHash("203.0.113.9");

    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(first).toBe(second);
    expect(first).not.toBe(other);
    expect(first).not.toContain("203.0.113.8");
  });

  it("normalizes IPv4-mapped IPv6 addresses before hashing", () => {
    process.env.MISSING_DISCOVERY_TELEMETRY_HMAC_SECRET = "0123456789abcdef0123456789abcdef";
    expect(discoveryClientHash("::ffff:203.0.113.8")).toBe(discoveryClientHash("203.0.113.8"));
  });

  it("classifies only explicit directory signals and otherwise stays direct or unknown", () => {
    expect(discoveryChannelFromHeaders({ "user-agent": "smithery-scanner/1.0" })).toBe("smithery");
    expect(discoveryChannelFromHeaders({ "user-agent": "Glama MCP Indexer" })).toBe("glama");
    expect(discoveryChannelFromHeaders({ "x-missing-entry-channel": "smithery", "user-agent": "generic" })).toBe("smithery");
    expect(discoveryChannelFromHeaders({ "user-agent": "generic-agent/1.0" })).toBe("direct");
    expect(discoveryChannelFromHeaders({})).toBe("unknown");
  });
});
