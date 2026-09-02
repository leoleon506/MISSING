import { createHash, randomUUID } from "node:crypto";
import { quoteCapability } from "./charging.js";
import {
  cachedDistributedResponse,
  distributedMoneyEnabled,
  distributedMoneySnapshot,
  distributedPayment,
  failDistributedPayment,
  markDistributedPaymentSettling,
  markDistributedSettlementPending,
  reserveDistributedPayment,
  settleDistributedPayment,
  type DistributedPaymentRecord,
} from "./distributedMoney.js";
import { recipeEconomics } from "./economics.js";
import { resolveCapability } from "./executor.js";
import { providerCostForExecution, providerCostSnapshot } from "./providerCostLedger.js";
import { VERIFIED_RECIPES } from "./recipes.js";
import { agentRequestHash, requestBindingStatus } from "./requestBinding.js";
import {
  cachedTransactionalResponse,
  failTransactionalPayment,
  markTransactionalPaymentSettling,
  reserveTransactionalPayment,
  settleTransactionalPayment,
  transactionalMoneyEnabled,
  transactionalMoneySnapshot,
  transactionalPayment,
  type TransactionalPaymentRecord,
} from "./transactionalMoney.js";
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
import { x402SettlementProof } from "./x402Reconciliation.js";

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

function bindingFailure(record: Pick<TransactionalPaymentRecord, "request_hash" | "state" | "transaction_reference">, currentRequestHash: string): AgentPaymentHttpResult | null {
  const status = requestBindingStatus(record.request_hash, currentRequestHash);
  if (status === "match") return null;
  return {
    status: 409,
    headers: { "Cache-Control": "no-store" },
    body: {
      error: status === "mismatch" ? "payment_request_mismatch" : "payment_request_binding_unavailable",
      prior_state: record.state,
      payment_settled: record.state === "settled",
      transaction: record.transaction_reference ?? undefined,
    },
  };
}

function priorSqliteResult(paymentKey: string, currentRequestHash: string): AgentPaymentHttpResult | null {
  if (!transactionalMoneyEnabled() || distributedMoneyEnabled()) return null;
  const prior = transactionalPayment(paymentKey);
  if (!prior) return null;
  const binding = bindingFailure(prior, currentRequestHash);
  if (binding) return binding;
  const cached = cachedTransactionalResponse(prior);
  if (cached) return cached;
  return {
    status: prior.state === "settling" ? 503 : 409,
    body: {
      error: prior.state === "settled" ? "payment_already_settled" : prior.state === "settling" ? "payment_settlement_reconciliation_required" : "payment_already_used",
      prior_state: prior.state,
      payment_settled: prior.state === "settled",
      transaction: prior.transaction_reference ?? undefined,
    },
  };
}

function distributedResponse(record: DistributedPaymentRecord) {
  if (!record.transaction_reference || record.customer_price_microusd === null || !record.resolution_json) return null;
  try {
    const resolution = JSON.parse(record.resolution_json) as any;
    const settlement = { success: true, transaction: record.transaction_reference, network: record.network ?? undefined };
    const headers = {
      "PAYMENT-RESPONSE": x402PaymentResponseHeader(settlement),
      "Cache-Control": "private, no-store",
    };
    const body = {
      status: "resolved",
      payment: {
        rail: "x402",
        settled: true,
        amount_microusd: record.customer_price_microusd,
        transaction: record.transaction_reference,
        provider_attempts: record.provider_attempts ?? 0,
        provider_cost_microusd: record.provider_cost_microusd,
        unknown_provider_cost_attempts: record.unknown_provider_cost_attempts ?? 0,
        realized_gross_margin_microusd: record.gross_margin_microusd,
      },
      resolution,
    };
    return { headers, body, resolution, settlement };
  } catch {
    return null;
  }
}

async function priorDistributedResult(paymentKey: string, currentRequestHash: string): Promise<AgentPaymentHttpResult | null> {
  if (!distributedMoneyEnabled()) return null;
  const prior = await distributedPayment(paymentKey);
  if (!prior) return null;
  const binding = bindingFailure(prior, currentRequestHash);
  if (binding) return binding;
  const cached = cachedDistributedResponse(prior);
  if (cached) return cached;

  if (prior.state === "settling" && prior.transaction_reference) {
    const asset = process.env.MISSING_X402_ASSET?.trim();
    const payTo = process.env.MISSING_X402_PAY_TO?.trim();
    if (!prior.network || prior.customer_price_microusd === null || !asset || !payTo) {
      return { status: 503, body: { error: "payment_reconciliation_data_incomplete", prior_state: "settling" } };
    }
    const chain = await x402SettlementProof({
      transaction: prior.transaction_reference,
      network: prior.network,
      asset,
      payTo,
      amount: String(prior.customer_price_microusd),
    });
    if (chain.state === "verified") {
      const reconstructed = distributedResponse(prior);
      if (!reconstructed) return { status: 503, body: { error: "payment_reconciliation_data_incomplete", prior_state: "settling" } };
      const committed = await settleDistributedPayment({
        paymentHash: prior.payment_hash,
        executionId: prior.execution_id,
        transactionReference: prior.transaction_reference,
        responseStatus: 200,
        responseHeaders: reconstructed.headers,
        responseBody: reconstructed.body,
      });
      if (!committed.changed) {
        const latest = await distributedPayment(paymentKey);
        if (latest) {
          const latestBinding = bindingFailure(latest, currentRequestHash);
          if (latestBinding) return latestBinding;
          const recovered = cachedDistributedResponse(latest);
          if (recovered) return recovered;
        }
        return { status: 503, body: { error: "payment_commit_reconciliation_required", payment_settled: true, transaction: prior.transaction_reference } };
      }
      const recipeFingerprint = reconstructed.resolution?.recipe_fingerprint;
      const recipe = VERIFIED_RECIPES.find(item => item.recipe_fingerprint === recipeFingerprint) ?? null;
      if (recipe) {
        recordX402Settlement({
          paymentHash: prior.payment_hash,
          transactionReference: prior.transaction_reference,
          network: prior.network ?? undefined,
          capability: prior.capability,
          recipe,
          customerPriceMicrousd: prior.customer_price_microusd!,
          realizedProviderCostMicrousd: prior.provider_cost_microusd,
        });
      }
      return { status: 200, headers: reconstructed.headers, body: reconstructed.body };
    }
    if (chain.state === "failed") {
      await failDistributedPayment({ paymentHash: prior.payment_hash, executionId: prior.execution_id, reason: `settlement_proof_${chain.reason ?? "failed"}`, from: "settling" });
      return { status: 409, body: { error: "payment_settlement_proof_failed", reason: chain.reason, prior_state: "failed", payment_settled: false, transaction: prior.transaction_reference } };
    }
    return {
      status: 503,
      body: {
        error: "payment_settlement_reconciliation_required",
        prior_state: "settling",
        transaction: prior.transaction_reference,
        reconciliation: chain.state,
        reason: chain.reason,
      },
    };
  }

  return {
    status: prior.state === "settling" ? 503 : 409,
    body: {
      error: prior.state === "settled" ? "payment_already_settled" : prior.state === "settling" ? "payment_settlement_reconciliation_required" : prior.state === "reserved" ? "payment_in_progress" : "payment_already_used",
      prior_state: prior.state,
      payment_settled: prior.state === "settled",
      transaction: prior.transaction_reference ?? undefined,
    },
  };
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

  let requestHash: string;
  try {
    requestHash = agentRequestHash(args.request.capability, args.request.input);
  } catch (error) {
    return { status: 400, body: { error: "invalid_request", reason: error instanceof Error ? error.message : String(error) } };
  }

  const quote = quoteCapability(args.request.capability);
  if (quote.status !== "quoted") return { status: 404, body: quote };
  const paymentRequired = x402PaymentRequired({ resourceUrl: args.resourceUrl, capability: args.request.capability, customerPriceMicrousd: quote.customer_price_microusd });
  if (!paymentRequired) return { status: 503, body: { error: "agent_payment_rail_not_ready", rail: "x402" } };
  const requirements = paymentRequired.accepts[0];

  if (!args.paymentSignature) {
    return { status: 402, headers: { "PAYMENT-REQUIRED": x402PaymentRequiredHeader(paymentRequired), "Cache-Control": "no-store" }, body: paymentRequired };
  }

  const paymentKey = signatureHash(args.paymentSignature);
  const priorDistributed = await priorDistributedResult(paymentKey, requestHash);
  if (priorDistributed) return priorDistributed;
  const priorSqlite = priorSqliteResult(paymentKey, requestHash);
  if (priorSqlite) return priorSqlite;
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
      return { status: 402, headers: { "PAYMENT-REQUIRED": x402PaymentRequiredHeader(paymentRequired), "Cache-Control": "no-store" }, body: { ...paymentRequired, error: verified.reason } };
    }

    const executionId = randomUUID();
    if (distributedMoneyEnabled()) {
      const reservation = await reserveDistributedPayment({ paymentHash: verified.paymentHash, requestHash, executionId, capability: args.request.capability });
      if (!reservation.reserved) return await priorDistributedResult(verified.paymentHash, requestHash) ?? { status: 409, body: { error: "payment_already_used" } };
    } else if (transactionalMoneyEnabled()) {
      const reservation = reserveTransactionalPayment({ paymentHash: verified.paymentHash, requestHash, executionId, capability: args.request.capability });
      if (!reservation.reserved) return priorSqliteResult(verified.paymentHash, requestHash) ?? { status: 409, body: { error: "payment_already_used" } };
    } else {
      const guard = reserveX402Payment({ paymentHash: verified.paymentHash, executionId, capability: args.request.capability });
      if (!guard.reserved) return { status: 409, body: { error: guard.prior?.state === "settled" ? "payment_already_settled" : "payment_already_used", prior_state: guard.prior?.state ?? "in_progress", payment_settled: guard.prior?.state === "settled", transaction: guard.prior?.transaction_reference ?? undefined } };
    }

    const resolution = await resolveCapability(args.request.capability, args.request.input, { meterEconomics: false, executionId });
    if (resolution.status !== "resolved") {
      if (distributedMoneyEnabled()) await failDistributedPayment({ paymentHash: verified.paymentHash, executionId, reason: resolution.reason });
      else if (transactionalMoneyEnabled()) failTransactionalPayment({ paymentHash: verified.paymentHash, executionId, reason: resolution.reason });
      else failX402PaymentGuard({ paymentHash: verified.paymentHash, executionId, capability: args.request.capability, reason: resolution.reason });
      return { status: 502, body: { status: resolution.status, reason: resolution.reason, payment_settled: false } };
    }

    const recipe = VERIFIED_RECIPES.find(item => item.recipe_fingerprint === resolution.recipe_fingerprint) ?? null;
    const economics = recipe ? recipeEconomics(recipe) : null;
    if (!recipe || !economics || economics.customer_price_microusd !== quote.customer_price_microusd) {
      if (distributedMoneyEnabled()) await failDistributedPayment({ paymentHash: verified.paymentHash, executionId, reason: "pricing_changed_before_settlement" });
      else if (transactionalMoneyEnabled()) failTransactionalPayment({ paymentHash: verified.paymentHash, executionId, reason: "pricing_changed_before_settlement" });
      else failX402PaymentGuard({ paymentHash: verified.paymentHash, executionId, capability: args.request.capability, reason: "pricing_changed_before_settlement" });
      return { status: 503, body: { error: "pricing_changed_before_settlement", payment_settled: false } };
    }

    const realized = providerCostForExecution(executionId);
    const grossMargin = realized.provider_cost_microusd === null ? null : quote.customer_price_microusd - realized.provider_cost_microusd;
    if (distributedMoneyEnabled()) {
      const transition = await markDistributedPaymentSettling({
        paymentHash: verified.paymentHash, executionId, customerPriceMicrousd: quote.customer_price_microusd,
        providerCostMicrousd: realized.provider_cost_microusd, grossMarginMicrousd: grossMargin,
        providerAttempts: realized.attempts, unknownProviderCostAttempts: realized.unknown_cost_attempts,
        resolution, network: requirements.network,
      });
      if (!transition.changed) return { status: 503, body: { error: "payment_state_transition_failed", payment_settled: false } };
    } else if (transactionalMoneyEnabled()) {
      const transition = markTransactionalPaymentSettling({ paymentHash: verified.paymentHash, executionId });
      if (!transition.changed) return { status: 503, body: { error: "payment_state_transition_failed", payment_settled: false } };
    }

    let settlement;
    try {
      settlement = await settleX402Payment({ paymentPayload: verified.paymentPayload, requirements });
    } catch (error) {
      if (!distributedMoneyEnabled() && !transactionalMoneyEnabled()) failX402PaymentGuard({ paymentHash: verified.paymentHash, executionId, capability: args.request.capability, reason: "payment_settlement_unavailable" });
      return { status: 503, body: { error: distributedMoneyEnabled() || transactionalMoneyEnabled() ? "payment_settlement_reconciliation_required" : "payment_settlement_unavailable", payment_settled: false, reason: error instanceof Error ? error.message : String(error) } };
    }

    if (!settlement.success && settlement.errorReason === "settlement_pending" && settlement.transaction && distributedMoneyEnabled()) {
      await markDistributedSettlementPending({ paymentHash: verified.paymentHash, executionId, transactionReference: settlement.transaction, reason: "settlement_pending" });
      return { status: 503, body: { error: "payment_settlement_reconciliation_required", payment_settled: false, transaction: settlement.transaction, prior_state: "settling" } };
    }

    if (!settlement.success || !settlement.transaction) {
      if (distributedMoneyEnabled()) await failDistributedPayment({ paymentHash: verified.paymentHash, executionId, reason: settlement.errorReason ?? "payment_settlement_failed", from: "settling" });
      else if (transactionalMoneyEnabled()) failTransactionalPayment({ paymentHash: verified.paymentHash, executionId, reason: settlement.errorReason ?? "payment_settlement_failed", from: "settling" });
      else failX402PaymentGuard({ paymentHash: verified.paymentHash, executionId, capability: args.request.capability, reason: settlement.errorReason ?? "payment_settlement_failed" });
      return { status: 402, body: { error: settlement.errorReason ?? "payment_settlement_failed", payment_settled: false } };
    }

    if (distributedMoneyEnabled()) {
      const chain = await x402SettlementProof({
        transaction: settlement.transaction,
        network: requirements.network,
        asset: requirements.asset,
        payTo: requirements.payTo,
        amount: requirements.amount,
      });
      if (chain.state === "failed") {
        await failDistributedPayment({ paymentHash: verified.paymentHash, executionId, reason: `settlement_proof_${chain.reason ?? "failed"}`, from: "settling" });
        return { status: 409, body: { error: "payment_settlement_proof_failed", payment_settled: false, transaction: settlement.transaction, reason: chain.reason } };
      }
      if (chain.state !== "verified") {
        await markDistributedSettlementPending({ paymentHash: verified.paymentHash, executionId, transactionReference: settlement.transaction, reason: `settlement_proof_${chain.state}${chain.reason ? `:${chain.reason}` : ""}` });
        return { status: 503, body: { error: "payment_settlement_reconciliation_required", payment_settled: false, transaction: settlement.transaction, prior_state: "settling", reconciliation: chain.state, reason: chain.reason } };
      }
    }

    const responseHeaders = { "PAYMENT-RESPONSE": x402PaymentResponseHeader(settlement), "Cache-Control": "private, no-store" };
    const responseBody = {
      status: "resolved",
      payment: {
        rail: "x402", settled: true, amount_microusd: quote.customer_price_microusd, transaction: settlement.transaction,
        provider_attempts: realized.attempts, provider_cost_microusd: realized.provider_cost_microusd,
        unknown_provider_cost_attempts: realized.unknown_cost_attempts, realized_gross_margin_microusd: grossMargin,
      },
      resolution,
    };

    if (distributedMoneyEnabled()) {
      const committed = await settleDistributedPayment({ paymentHash: verified.paymentHash, executionId, transactionReference: settlement.transaction, responseStatus: 200, responseHeaders, responseBody });
      if (!committed.changed) return { status: 503, body: { error: "payment_commit_reconciliation_required", payment_settled: true, transaction: settlement.transaction } };
    } else if (transactionalMoneyEnabled()) {
      const committed = settleTransactionalPayment({ paymentHash: verified.paymentHash, executionId, transactionReference: settlement.transaction, responseStatus: 200, responseHeaders, responseBody, customerPriceMicrousd: quote.customer_price_microusd, providerCostMicrousd: realized.provider_cost_microusd, grossMarginMicrousd: grossMargin });
      if (!committed.changed) return { status: 503, body: { error: "payment_commit_reconciliation_required", payment_settled: true, transaction: settlement.transaction } };
    }

    recordX402Settlement({ paymentHash: verified.paymentHash, transactionReference: settlement.transaction, network: settlement.network, capability: args.request.capability, recipe, customerPriceMicrousd: quote.customer_price_microusd, realizedProviderCostMicrousd: realized.provider_cost_microusd });
    if (!distributedMoneyEnabled() && !transactionalMoneyEnabled()) settleX402PaymentGuard({ paymentHash: verified.paymentHash, executionId, capability: args.request.capability, transactionReference: settlement.transaction });
    return { status: 200, headers: responseHeaders, body: responseBody };
  } finally {
    inFlightPayments.delete(paymentKey);
  }
}

export function agentPaymentsSnapshot() {
  return {
    enabled: agentPaymentsEnabled(), x402_ready: x402Ready(), x402: x402Snapshot(), payment_guard: x402PaymentGuardSnapshot(),
    provider_costs: providerCostSnapshot(), transactional_money: transactionalMoneySnapshot(), distributed_money: distributedMoneySnapshot(),
  };
}
