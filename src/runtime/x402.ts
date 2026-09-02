import { createHash } from "node:crypto";
import type { ResolveResult, VerifiedRecipe } from "./types.js";

export interface X402Requirements {
  scheme: "exact";
  network: string;
  amount: string;
  asset: string;
  payTo: string;
  maxTimeoutSeconds: number;
  extra: { name: string; version: string };
}

export interface X402PaymentRequired {
  x402Version: 2;
  error: string;
  resource: {
    url: string;
    description: string;
    mimeType: "application/json";
    serviceName: "MISSING";
    tags: string[];
  };
  accepts: X402Requirements[];
  extensions: Record<string, unknown>;
}

export interface X402Settlement {
  success: boolean;
  payer?: string;
  transaction?: string;
  network?: string;
  errorReason?: string;
  errorMessage?: string;
}

let facilitatorFetch: typeof fetch = (...args) => globalThis.fetch(...args);

export function configureX402Fetch(fn?: typeof fetch) {
  facilitatorFetch = fn ?? ((...args) => globalThis.fetch(...args));
}

export function x402Enabled(): boolean {
  return process.env.MISSING_X402_ENABLED === "1";
}

/**
 * Explicit operator assertion that the configured facilitator deduplicates
 * settlement submissions carrying the same MISSING settlement intent.
 * Merely sending an Idempotency-Key header is not treated as evidence.
 */
export function x402FacilitatorIdempotencyEnabled(): boolean {
  return process.env.MISSING_X402_FACILITATOR_IDEMPOTENCY === "1";
}

function env(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

export function x402Config() {
  return {
    enabled: x402Enabled(),
    network: env("MISSING_X402_NETWORK"),
    asset: env("MISSING_X402_ASSET"),
    payTo: env("MISSING_X402_PAY_TO"),
    facilitatorUrl: env("MISSING_X402_FACILITATOR_URL"),
    facilitatorBearer: env("MISSING_X402_FACILITATOR_BEARER"),
    facilitatorIdempotency: x402FacilitatorIdempotencyEnabled(),
    maxTimeoutSeconds: Number(process.env.MISSING_X402_MAX_TIMEOUT_SECONDS ?? 60),
  };
}

export function x402Ready(): boolean {
  const c = x402Config();
  return Boolean(c.enabled && c.network && c.asset && c.payTo && c.facilitatorUrl && Number.isInteger(c.maxTimeoutSeconds) && c.maxTimeoutSeconds > 0);
}

export function x402Requirements(customerPriceMicrousd: number): X402Requirements | null {
  const c = x402Config();
  if (!x402Ready() || !Number.isSafeInteger(customerPriceMicrousd) || customerPriceMicrousd <= 0) return null;
  return {
    scheme: "exact",
    network: c.network!,
    amount: String(customerPriceMicrousd),
    asset: c.asset!,
    payTo: c.payTo!,
    maxTimeoutSeconds: c.maxTimeoutSeconds,
    extra: { name: "USDC", version: "2" },
  };
}

function b64url(value: unknown): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

export function x402PaymentRequired(args: { resourceUrl: string; capability: string; customerPriceMicrousd: number }): X402PaymentRequired | null {
  const requirements = x402Requirements(args.customerPriceMicrousd);
  if (!requirements) return null;
  return {
    x402Version: 2,
    error: "PAYMENT-SIGNATURE header is required",
    resource: {
      url: args.resourceUrl,
      description: `Execute MISSING capability ${args.capability}`,
      mimeType: "application/json",
      serviceName: "MISSING",
      tags: ["agents", "capabilities"],
    },
    accepts: [requirements],
    extensions: {},
  };
}

export function x402PaymentRequiredHeader(required: X402PaymentRequired): string {
  return b64url(required);
}

export function parseX402PaymentSignature(header: string): unknown | null {
  try {
    return JSON.parse(Buffer.from(header, "base64url").toString("utf8")) as unknown;
  } catch {
    return null;
  }
}

function paymentHash(header: string): string {
  return createHash("sha256").update(header, "utf8").digest("hex");
}

async function facilitatorPost(path: "verify" | "settle", body: unknown, extraHeaders: Record<string, string> = {}): Promise<any> {
  const c = x402Config();
  if (!c.facilitatorUrl) throw new Error("x402 facilitator is not configured");
  const headers: Record<string, string> = { "Content-Type": "application/json", ...extraHeaders };
  if (c.facilitatorBearer) headers.Authorization = `Bearer ${c.facilitatorBearer}`;
  const response = await facilitatorFetch(`${c.facilitatorUrl.replace(/\/$/, "")}/${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`x402 facilitator ${path} failed with HTTP ${response.status}`);
  return response.json();
}

export async function verifyX402Payment(args: { paymentSignature: string; requirements: X402Requirements }) {
  const paymentPayload = parseX402PaymentSignature(args.paymentSignature);
  if (!paymentPayload || typeof paymentPayload !== "object") return { valid: false as const, reason: "invalid_payment_signature" };
  const result = await facilitatorPost("verify", {
    x402Version: 2,
    paymentPayload,
    paymentRequirements: args.requirements,
  });
  return result?.isValid === true
    ? { valid: true as const, payer: typeof result.payer === "string" ? result.payer : null, paymentHash: paymentHash(args.paymentSignature), paymentPayload }
    : { valid: false as const, reason: typeof result?.invalidReason === "string" ? result.invalidReason : "payment_not_valid" };
}

export async function settleX402Payment(args: { paymentPayload: unknown; requirements: X402Requirements; settlementIntentId?: string | null }): Promise<X402Settlement> {
  const intent = args.settlementIntentId?.trim() || null;
  if (intent && !x402FacilitatorIdempotencyEnabled()) {
    throw new Error("x402 facilitator settlement idempotency contract is not enabled");
  }
  const idempotent = Boolean(intent);
  const result = await facilitatorPost("settle", {
    x402Version: 2,
    paymentPayload: args.paymentPayload,
    paymentRequirements: args.requirements,
    ...(idempotent ? { extensions: { missingSettlementIntentId: intent } } : {}),
  }, idempotent && intent ? { "Idempotency-Key": intent, "X-MISSING-Settlement-Intent": intent } : {});
  return {
    success: result?.success === true,
    payer: typeof result?.payer === "string" ? result.payer : undefined,
    transaction: typeof result?.transaction === "string" ? result.transaction : undefined,
    network: typeof result?.network === "string" ? result.network : undefined,
    errorReason: typeof result?.errorReason === "string" ? result.errorReason : undefined,
    errorMessage: typeof result?.errorMessage === "string" ? result.errorMessage : undefined,
  };
}

export function x402PaymentResponseHeader(settlement: X402Settlement): string {
  return b64url(settlement);
}

export interface X402ExecutionResult {
  resolution: ResolveResult;
  recipe: VerifiedRecipe | null;
}
