import { createHash } from "node:crypto";
import type { ResolveResult, VerifiedRecipe } from "./types.js";
import { distributedMoneyEnabled, distributedMoneySnapshot } from "./distributedMoney.js";
import { settledReorgMonitorSnapshot } from "./settledReorgMonitor.js";
import { x402FinalityPolicy, x402RpcUrl } from "./x402Reconciliation.js";
import { runDependencyOperation } from "./dependencyBackpressure.js";

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

export type ProductionAdmissionReason =
  | "x402_static_config_not_ready"
  | "facilitator_idempotency_contract_not_enabled"
  | "distributed_money_not_enabled"
  | "distributed_money_not_ready"
  | "transactional_response_cache_not_disabled"
  | "finality_policy_not_ready"
  | "x402_rpc_not_configured"
  | "settled_reorg_monitor_not_enabled"
  | "settled_reorg_monitor_not_running"
  | "settled_reorg_monitor_unhealthy";

let facilitatorFetch: typeof fetch = (...args) => globalThis.fetch(...args);

export function configureX402Fetch(fn?: typeof fetch) {
  facilitatorFetch = fn ?? ((...args) => globalThis.fetch(...args));
}

export function x402Enabled(): boolean {
  return process.env.MISSING_X402_ENABLED === "1";
}

export function productionAdmissionEnabled(): boolean {
  return process.env.MISSING_PRODUCTION_ADMISSION_ENABLED === "1";
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

function x402StaticReady(): boolean {
  const c = x402Config();
  return Boolean(c.enabled && c.network && c.asset && c.payTo && c.facilitatorUrl && Number.isInteger(c.maxTimeoutSeconds) && c.maxTimeoutSeconds > 0);
}

/**
 * Operational Readiness 5 admission contract.
 *
 * The gate is opt-in so existing local/test deployments retain their historical
 * behavior. Once enabled, paid traffic fails closed unless every production
 * prerequisite needed by the durable x402 path is already healthy before any
 * payment verification, provider effect, or settlement submission can occur.
 */
export function productionAdmissionSnapshot() {
  const enabled = productionAdmissionEnabled();
  const config = x402Config();
  const distributed = distributedMoneySnapshot();
  const monitor = settledReorgMonitorSnapshot();
  const finality = config.network ? x402FinalityPolicy(config.network) : null;
  const checks = {
    x402_static_ready: x402StaticReady(),
    facilitator_idempotency_contract: x402FacilitatorIdempotencyEnabled(),
    distributed_money_enabled: distributedMoneyEnabled(),
    distributed_money_ready: distributedMoneyEnabled() && distributed.ready,
    transactional_response_cache_disabled: !distributed.response_cache_enabled,
    finality_policy_ready: finality?.ok === true,
    x402_rpc_configured: x402RpcUrl() !== null,
    settled_reorg_monitor_enabled: monitor.enabled,
    settled_reorg_monitor_running: monitor.running,
    settled_reorg_monitor_healthy: monitor.last_error === null,
  };

  const reasons: ProductionAdmissionReason[] = [];
  if (!checks.x402_static_ready) reasons.push("x402_static_config_not_ready");
  if (!checks.facilitator_idempotency_contract) reasons.push("facilitator_idempotency_contract_not_enabled");
  if (!checks.distributed_money_enabled) reasons.push("distributed_money_not_enabled");
  if (!checks.distributed_money_ready) reasons.push("distributed_money_not_ready");
  if (!checks.transactional_response_cache_disabled) reasons.push("transactional_response_cache_not_disabled");
  if (!checks.finality_policy_ready) reasons.push("finality_policy_not_ready");
  if (!checks.x402_rpc_configured) reasons.push("x402_rpc_not_configured");
  if (!checks.settled_reorg_monitor_enabled) reasons.push("settled_reorg_monitor_not_enabled");
  if (!checks.settled_reorg_monitor_running) reasons.push("settled_reorg_monitor_not_running");
  if (!checks.settled_reorg_monitor_healthy) reasons.push("settled_reorg_monitor_unhealthy");

  return {
    enabled,
    enforced: enabled,
    ready: enabled ? reasons.length === 0 : x402StaticReady(),
    reasons: enabled ? reasons : [],
    checks,
    finality_policy: finality,
  };
}

export function x402Ready(): boolean {
  if (!x402StaticReady()) return false;
  return productionAdmissionEnabled() ? productionAdmissionSnapshot().ready : true;
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
    extra: { name: "USD Coin", version: "2" },
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
  const facilitatorUrl = c.facilitatorUrl;
  if (!facilitatorUrl) throw new Error("x402 facilitator is not configured");
  const headers: Record<string, string> = { "Content-Type": "application/json", ...extraHeaders };
  if (c.facilitatorBearer) headers.Authorization = `Bearer ${c.facilitatorBearer}`;
  return runDependencyOperation(path === "verify" ? "facilitator_verify" : "facilitator_settle", async signal => {
    const response = await facilitatorFetch(`${facilitatorUrl.replace(/\/$/, "")}/${path}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal,
    });
    let parsed: any = null;
    try {
      parsed = await response.json();
    } catch {
      if (!response.ok) throw new Error(`x402 facilitator ${path} failed with HTTP ${response.status}`);
      throw new Error(`x402 facilitator ${path} returned invalid JSON`);
    }
    // x402 facilitators return protocol-shaped JSON for semantic 4xx outcomes.
    // Preserve those bodies for verify/settle callers, while true dependency
    // pressure/outages still feed OR7/OR9 backpressure and deadlines.
    if (!response.ok && (response.status === 429 || response.status >= 500)) {
      throw new Error(`x402 facilitator ${path} failed with HTTP ${response.status}`);
    }
    return parsed;
  });
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
