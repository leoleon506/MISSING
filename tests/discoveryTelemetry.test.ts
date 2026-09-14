import { afterEach, describe, expect, it } from "vitest";
import {
  discoveryChannelFromHeaders,
  discoveryClientHash,
  discoveryHashEpoch,
  parseMcpInteractions,
  sanitizeRecentExternalCandidateToolCalls,
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

  it("derives a stable non-secret epoch from the active HMAC secret", () => {
    delete process.env.MISSING_DISCOVERY_TELEMETRY_HMAC_SECRET;
    expect(discoveryHashEpoch()).toBeNull();

    process.env.MISSING_DISCOVERY_TELEMETRY_HMAC_SECRET = "0123456789abcdef0123456789abcdef";
    const first = discoveryHashEpoch();
    const second = discoveryHashEpoch();
    expect(first).toMatch(/^[a-f0-9]{16}$/);
    expect(first).toBe(second);
    expect(first).not.toContain("0123456789abcdef");

    process.env.MISSING_DISCOVERY_TELEMETRY_HMAC_SECRET = "fedcba9876543210fedcba9876543210";
    expect(discoveryHashEpoch()).toMatch(/^[a-f0-9]{16}$/);
    expect(discoveryHashEpoch()).not.toBe(first);
  });

  it("classifies only explicit directory signals and otherwise stays direct or unknown", () => {
    expect(discoveryChannelFromHeaders({ "user-agent": "smithery-scanner/1.0" })).toBe("smithery");
    expect(discoveryChannelFromHeaders({ "user-agent": "Glama MCP Indexer" })).toBe("glama");
    expect(discoveryChannelFromHeaders({ "x-missing-entry-channel": "smithery", "user-agent": "generic" })).toBe("smithery");
    expect(discoveryChannelFromHeaders({ "user-agent": "generic-agent/1.0" })).toBe("direct");
    expect(discoveryChannelFromHeaders({})).toBe("unknown");
  });

  it("sanitizes recent external tool-call history without retaining extra fields", () => {
    const rows = [
      {
        observed_at: "2026-09-13T04:19:04.173Z",
        tool_name: "list_verified_capabilities",
        channel: "direct",
        client_hash_prefix: "0123456789",
        status_code: 200,
        raw_ip: "203.0.113.8",
        arguments: { secret: "must-not-survive" },
      },
      {
        observed_at: "2026-09-13T04:20:04.173Z",
        tool_name: "../../invalid",
        channel: "unknown",
        client_hash_prefix: "abcdef0123",
        status_code: null,
      },
      {
        observed_at: "invalid-date",
        tool_name: "resolve_capability",
        channel: "direct",
        client_hash_prefix: "fedcba9876",
        status_code: 200,
      },
      {
        observed_at: "2026-09-13T04:21:04.173Z",
        tool_name: "resolve_capability",
        channel: "other",
        client_hash_prefix: "fedcba9876",
        status_code: 200,
      },
      {
        observed_at: "2026-09-13T04:22:04.173Z",
        tool_name: "resolve_capability",
        channel: "direct",
        client_hash_prefix: "not-hex",
        status_code: 200,
      },
    ];

    expect(sanitizeRecentExternalCandidateToolCalls(rows)).toEqual([
      {
        observed_at: "2026-09-13T04:19:04.173Z",
        tool_name: "list_verified_capabilities",
        channel: "direct",
        client_hash_prefix: "0123456789",
        status_code: 200,
      },
      {
        observed_at: "2026-09-13T04:20:04.173Z",
        tool_name: "unknown",
        channel: "unknown",
        client_hash_prefix: "abcdef0123",
        status_code: null,
      },
    ]);
  });

  it("caps recent external tool-call history at ten entries", () => {
    const rows = Array.from({ length: 12 }, (_, index) => ({
      observed_at: new Date(Date.UTC(2026, 8, 13, 5, index, 0)).toISOString(),
      tool_name: "list_verified_capabilities",
      channel: "direct",
      client_hash_prefix: index.toString(16).padStart(10, "0"),
      status_code: 200,
    }));

    expect(sanitizeRecentExternalCandidateToolCalls(rows)).toHaveLength(10);
  });
});
