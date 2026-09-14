import type { CallToolResult } from "@modelcontextprotocol/server";
import { handleAgentPaidResolution, type AgentPaymentHttpResult } from "../runtime/agentPayments.js";
import { observeDurableConsumerPayment } from "../runtime/consumerTelemetry.js";
import type { RuntimeInput } from "../runtime/types.js";

export const MCP_X402_PAYMENT_META_KEY = "x402/payment";
export const MCP_X402_PAYMENT_RESPONSE_META_KEY = "x402/payment-response";

export type NativeMcpX402Result = CallToolResult;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPaymentPayload(value: unknown): value is Record<string, unknown> {
  return isRecord(value) && "x402Version" in value && "payload" in value;
}

function isPaymentRequired(value: unknown): value is Record<string, unknown> {
  return isRecord(value)
    && value.x402Version === 2
    && Array.isArray(value.accepts)
    && isRecord(value.resource);
}

export function nativeMcpToolResourceUrl(toolName: string): string {
  return `mcp://tool/${toolName}`;
}

/**
 * x402 MCP clients transmit a PaymentPayload in tools/call params._meta["x402/payment"].
 * The canonical MISSING financial engine consumes the identical payload encoded in
 * PAYMENT-SIGNATURE, so this adapter only changes transport representation.
 */
export function mcpPaymentPayload(extra: unknown): Record<string, unknown> | null {
  if (!isRecord(extra)) return null;
  const meta = extra._meta;
  if (!isRecord(meta)) return null;
  const payment = meta[MCP_X402_PAYMENT_META_KEY];
  return isPaymentPayload(payment) ? payment : null;
}

export function mcpPaymentSignature(extra: unknown): string | null {
  const payment = mcpPaymentPayload(extra);
  return payment ? Buffer.from(JSON.stringify(payment), "utf8").toString("base64url") : null;
}

export function decodePaymentResponseHeader(value: string | undefined): Record<string, unknown> | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function textResult(value: unknown, isError = false): NativeMcpX402Result {
  return {
    resultType: "complete",
    content: [{ type: "text", text: JSON.stringify(value) }],
    ...(isError ? { isError: true } : {}),
  };
}

/**
 * Convert the canonical HTTP-shaped financial result into the x402 MCP transport.
 * No verification, execution, settlement, recovery, or margin logic lives here.
 */
export function agentPaymentResultToMcp(result: AgentPaymentHttpResult): NativeMcpX402Result {
  if (result.status === 402 && isPaymentRequired(result.body)) {
    const paymentRequired = {
      ...result.body,
      error: typeof result.body.error === "string" && result.body.error !== "PAYMENT-SIGNATURE header is required"
        ? result.body.error
        : "Payment required to access this tool",
    };
    return {
      resultType: "complete",
      isError: true,
      structuredContent: paymentRequired,
      content: [{ type: "text", text: JSON.stringify(paymentRequired) }],
    };
  }

  if (result.status >= 200 && result.status < 300) {
    const response = textResult(result.body);
    if (isRecord(result.body)) response.structuredContent = result.body;
    const settlement = decodePaymentResponseHeader(result.headers?.["PAYMENT-RESPONSE"] ?? result.headers?.["payment-response"]);
    if (settlement) response._meta = { [MCP_X402_PAYMENT_RESPONSE_META_KEY]: settlement };
    return response;
  }

  const response = textResult(result.body, true);
  if (isRecord(result.body)) response.structuredContent = result.body;
  return response;
}

/**
 * Native x402 MCP entry point. It intentionally delegates the entire paid lifecycle
 * to handleAgentPaidResolution so Kappa remains the single financial authority.
 */
export async function handleNativeCapabilityMcpPayment(args: {
  capability: string;
  input: RuntimeInput;
  extra?: unknown;
}): Promise<NativeMcpX402Result> {
  const paymentSignature = mcpPaymentSignature(args.extra);
  const result = await handleAgentPaidResolution({
    request: { capability: args.capability, input: args.input },
    paymentSignature,
    resourceUrl: nativeMcpToolResourceUrl(args.capability),
  });

  if (paymentSignature) {
    try {
      await observeDurableConsumerPayment({ paymentSignature, entryChannel: "mcp" });
    } catch {
      // Telemetry is deliberately non-authoritative and must never change money behavior.
    }
  }

  return agentPaymentResultToMcp(result);
}
