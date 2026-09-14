import { describe, expect, it } from "vitest";
import {
  MCP_X402_PAYMENT_META_KEY,
  MCP_X402_PAYMENT_RESPONSE_META_KEY,
  agentPaymentResultToMcp,
  mcpPaymentPayload,
  mcpPaymentSignature,
  nativeMcpToolResourceUrl,
} from "../src/mcp/nativeMcpX402.js";

const paymentPayload = {
  x402Version: 2,
  resource: {
    url: "mcp://tool/ip_geolocation_metadata",
    description: "Execute MISSING capability ip_geolocation_metadata",
    mimeType: "application/json",
  },
  accepted: {
    scheme: "exact",
    network: "eip155:8453",
    amount: "5000",
    asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    payTo: "0x1111111111111111111111111111111111111111",
    maxTimeoutSeconds: 60,
    extra: { name: "USD Coin", version: "2" },
  },
  payload: {
    signature: "0xabc",
    authorization: {
      from: "0x2222222222222222222222222222222222222222",
      to: "0x1111111111111111111111111111111111111111",
      value: "5000",
      validAfter: "1",
      validBefore: "2",
      nonce: "0x01",
    },
  },
};

function firstText(result: { content: Array<{ type: string } & Record<string, unknown>> }): string {
  const first = result.content[0];
  if (!first || first.type !== "text" || typeof first.text !== "string") throw new Error("Expected text MCP content");
  return first.text;
}

describe("native MCP x402 transport adapter", () => {
  it("extracts the standard MCP payment metadata and encodes it for the canonical engine", () => {
    const extra = { _meta: { [MCP_X402_PAYMENT_META_KEY]: paymentPayload } };
    expect(mcpPaymentPayload(extra)).toEqual(paymentPayload);

    const signature = mcpPaymentSignature(extra);
    expect(signature).not.toBeNull();
    expect(JSON.parse(Buffer.from(signature!, "base64url").toString("utf8"))).toEqual(paymentPayload);
  });

  it("rejects absent or malformed MCP payment metadata", () => {
    expect(mcpPaymentPayload(undefined)).toBeNull();
    expect(mcpPaymentPayload({ _meta: { [MCP_X402_PAYMENT_META_KEY]: { x402Version: 2 } } })).toBeNull();
    expect(mcpPaymentSignature({ _meta: {} })).toBeNull();
  });

  it("uses the standard mcp tool resource URL", () => {
    expect(nativeMcpToolResourceUrl("currency_exchange_rate")).toBe("mcp://tool/currency_exchange_rate");
  });

  it("converts a canonical 402 into the x402 MCP PaymentRequired result format", () => {
    const paymentRequired = {
      x402Version: 2,
      error: "PAYMENT-SIGNATURE header is required",
      resource: {
        url: "mcp://tool/ip_geolocation_metadata",
        description: "Execute MISSING capability ip_geolocation_metadata",
        mimeType: "application/json",
        serviceName: "MISSING",
        tags: ["agents", "capabilities"],
      },
      accepts: [paymentPayload.accepted],
      extensions: {},
    };

    const result = agentPaymentResultToMcp({
      status: 402,
      headers: { "PAYMENT-REQUIRED": "unused-in-mcp" },
      body: paymentRequired,
    });

    expect(result.resultType).toBe("complete");
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({
      x402Version: 2,
      error: "Payment required to access this tool",
      resource: { url: "mcp://tool/ip_geolocation_metadata" },
      accepts: [{ amount: "5000" }],
    });
    expect(JSON.parse(firstText(result))).toEqual(result.structuredContent);
  });

  it("converts a canonical settlement response into MCP payment-response metadata", () => {
    const settlement = {
      success: true,
      transaction: "0x1234",
      network: "eip155:8453",
    };
    const paymentResponse = Buffer.from(JSON.stringify(settlement), "utf8").toString("base64url");
    const body = { status: "resolved", resolution: { status: "resolved", output: { ok: true } } };

    const result = agentPaymentResultToMcp({
      status: 200,
      headers: { "PAYMENT-RESPONSE": paymentResponse },
      body,
    });

    expect(result.resultType).toBe("complete");
    expect(result.isError).toBeUndefined();
    expect(result.structuredContent).toEqual(body);
    expect(result._meta?.[MCP_X402_PAYMENT_RESPONSE_META_KEY]).toEqual(settlement);
  });

  it("fails closed for non-success canonical outcomes", () => {
    const result = agentPaymentResultToMcp({ status: 503, body: { error: "agent_payment_rail_not_ready" } });
    expect(result.resultType).toBe("complete");
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toEqual({ error: "agent_payment_rail_not_ready" });
  });
});
