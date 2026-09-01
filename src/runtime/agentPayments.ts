import { createHash, randomUUID } from "node:crypto";
import { quoteCapability } from "./charging.js";
import { recipeEconomics } from "./economics.js";
import { resolveCapability } from "./executor.js";
import { providerCostForExecution, providerCostSnapshot } from "./providerCostLedger.js";
import { VERIFIED_RECIPES } from "./recipes.js";
import type { RuntimeInput } from "./types.js";
import {
  settleX402Payment,
  verifyX402Payment,
  x402PaymentRequired,
  x402PaymentRequiredHeader,
  x402PaymentResponseHeader,
  x402Ready,
} from "./x402.js";
import { recordX402Settlement, x402Snapshot } from "./x402Ledger.js";
import {
  failX402PaymentGuard,
  reserveX402Payment,
  settleX402PaymentGuard,
  x402PaymentGuardSnapshot,
} from "./x402PaymentGuard.js";

const inFlightPayments = new Set<string>();

export function agentPaymentsEnabled(): boolean {
  return process.env.MISSING_AGENT_PAYMENTS_ENABLED === "1";
}

function signatureHash(signature: string): string {
  return createHash("sha256").update(signature, "utf8").digest("hex");
}

export interface AgentPaidRequest {
  capability: string;
  input: RuntimeInput;
}

export interface AgentPaymentHttpResult {
  status: number;
  headers?: Record<string, string>;
  body: unknown;
}

export async function handleAgentPaidResolution(args: {
  request: AgentPaidRequest;
  paymentSignature?: string | null;
  resourceUrl: string;
}): Promise<AgentPaymentHttpResult> {
  if (!agentPaymentsEnabled()) return { status: 404, body: { error: "not_found" } };
  if (!x402Ready()) return { status: 503, body: { error: "agent_payment_rail_not_ready", rail: "x402" } };
  if (!args.request?.capability || typeof args.request.capability !== "string" || !args.request.input || typeof args.request.input !== "object" || Array.isArray(args.request.input)) {
    return { status: 400, body: { error: "invalid_request", required: { capability: "string", input: "object" } } };
  }

  const quote = quoteCapability(args.request.capability);
  if (quote.status !== "quoted") return { status: 404, body: quote };

  const paymentRequired = x402PaymentRequired({
    resourceUrl: args.resourceUrl,
    capability: args.request.capability,
    customerPriceMicrousd: quote.customer_price_microusd,
  });
  if (!paymentRequired) return { status: 503, body: { error: "agent_payment_rail_not_ready", rail: "x402" } };
  const requirements = paymentRequired.accepts[0];

  if (!args.paymentSignature) {
    return {
      status: 402,
      headers: {
        "PAYMENT-REQUIRED": x402PaymentRequiredHeader(paymentRequired),
        "Cache-Control": "no-store",
      },
      body: paymentRequired,
    };
  }

  const paymentKey = signatureHash(args.paymentSignature);
  if (inFlightPayments.has(paymentKey)) return { status: 409, body: { error: "payment_in_progress" } };
  inFlightPayments.add(paymentKey);

  try {
    let verified;
    try {
      verified = await verifyX402Payment({ paymentSignature: args.paymentSignature, requirements });
    } catch (error) {
      return { status: 502, body: { error: "payment_verification_unavailable", reason: error instanceof Error ? error.message : String(error) } };
    }
    if (!verified.valid) {
      return {
        status: 402,
        headers: { "PAYMENT-REQUIRED": x402PaymentRequiredHeader(paymentRequired), "Cache-Control": "no-store" },
        body: { ...paymentRequired, error: verified.reason },
      };
    }

    const executionId = randomUUID();
    const guard = reserveX402Payment({ paymentHash: verified.paymentHash, executionId, capability: args.request.capability });
    if (!guard.reserved) {
      return {
        status: 409,
        body: {
          error: guard.prior?.state === "settled" ? "payment_already_settled" : "payment_already_used",
          prior_state: guard.prior?.state ?? "in_progress",
          payment_settled: guard.prior?.state === "settled",
          transaction: guard.prior?.transaction_reference ?? undefined,
        },
      };
    }

    const resolution = await resolveCapability(args.request.capability, args.request.input, {
      meterEconomics: false,
      executionId,
    });
    if (resolution.status !== "resolved") {
      failX402PaymentGuard({ paymentHash: verified.paymentHash, executionId, capability: args.request.capability, reason: resolution.reason });
      return { status: 502, body: { status: resolution.status, reason: resolution.reason, payment_settled: false } };
    }

    const recipe = VERIFIED_RECIPES.find(item => item.recipe_fingerprint === resolution.recipe_fingerprint) ?? null;
    const economics = recipe ? recipeEconomics(recipe) : null;
    if (!recipe || !economics || economics.customer_price_microusd !== quote.customer_price_microusd) {
      failX402PaymentGuard({ paymentHash: verified.paymentHash, executionId, capability: args.request.capability, reason: "pricing_changed_before_settlement" });
      return { status: 503, body: { error: "pricing_changed_before_settlement", payment_settled: false } };
    }

    let settlement;
    try {
      settlement = await settleX402Payment({ paymentPayload: verified.paymentPayload, requirements });
    } catch (error) {
      failX402PaymentGuard({ paymentHash: verified.paymentHash, executionId, capability: args.request.capability, reason: "payment_settlement_unavailable" });
      return { status: 502, body: { error: "payment_settlement_unavailable", payment_settled: false, reason: error instanceof Error ? error.message : String(error) } };
    }
    if (!settlement.success || !settlement.transaction) {
      failX402PaymentGuard({ paymentHash: verified.paymentHash, executionId, capability: args.request.capability, reason: settlement.errorReason ?? "payment_settlement_failed" });
      return { status: 402, body: { error: settlement.errorReason ?? "payment_settlement_failed", payment_settled: false } };
    }

    const realized = providerCostForExecution(executionId);
    recordX402Settlement({
      paymentHash: verified.paymentHash,
      transactionReference: settlement.transaction,
      network: settlement.network,
      capability: args.request.capability,
      recipe,
      customerPriceMicrousd: quote.customer_price_microusd,
      realizedProviderCostMicrousd: realized.provider_cost_microusd,
    });
    settleX402PaymentGuard({
      paymentHash: verified.paymentHash,
      executionId,
      capability: args.request.capability,
      transactionReference: settlement.transaction,
    });

    return {
      status: 200,
      headers: {
        "PAYMENT-RESPONSE": x402PaymentResponseHeader(settlement),
        "Cache-Control": "private, no-store",
      },
      body: {
        status: "resolved",
        payment: {
          rail: "x402",
          settled: true,
          amount_microusd: quote.customer_price_microusd,
          transaction: settlement.transaction,
          provider_attempts: realized.attempts,
          provider_cost_microusd: realized.provider_cost_microusd,
          unknown_provider_cost_attempts: realized.unknown_cost_attempts,
          realized_gross_margin_microusd: realized.provider_cost_microusd === null
            ? null
            : quote.customer_price_microusd - realized.provider_cost_microusd,
        },
        resolution,
      },
    };
  } finally {
    inFlightPayments.delete(paymentKey);
  }
}

export function agentPaymentsSnapshot() {
  return {
    enabled: agentPaymentsEnabled(),
    x402_ready: x402Ready(),
    x402: x402Snapshot(),
    payment_guard: x402PaymentGuardSnapshot(),
    provider_costs: providerCostSnapshot(),
  };
}
