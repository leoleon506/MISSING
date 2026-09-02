import { createHash, randomUUID } from "node:crypto";
import { quoteCapability } from "./charging.js";
import {
  cachedDistributedResponse,
  claimDistributedRecovery,
  distributedMoneyEnabled,
  distributedMoneySnapshot,
  distributedPayment,
  failDistributedPayment,
  markDistributedPaymentAmbiguous,
  markDistributedPaymentExecuting,
  markDistributedPaymentSettling,
  markDistributedProviderDone,
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
  providerRecoveryPolicy,
  stableProviderIdempotencyKey,
  stableSettlementIntentId,
} from "./recoveryPolicy.js";
import { releaseRecoverableDistributedLease } from "./recoverableLease.js";
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
import type { ResolveResult, RuntimeInput, VerifiedRecipe } from "./types.js";
import {
  settleX402Payment,
  verifyX402Payment,
  x402PaymentRequired,
  x402PaymentRequiredHeader,
  x402PaymentResponseHeader,
  x402Ready,
  type X402Requirements,
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

export type AgentPaymentCrashPoint =
  | "after_reservation"
  | "after_provider_effect"
  | "after_settlement_effect"
  | "after_settlement_transaction_persisted";
type AgentPaymentCrashHook = (point: AgentPaymentCrashPoint, context: { paymentHash: string; executionId: string }) => void | Promise<void>;
let crashHook: AgentPaymentCrashHook | null = null;

/** Test-only fault injection used by Kappa recovery workers to kill the real production path at exact crash windows. */
export function configureAgentPaymentCrashHookForTest(hook?: AgentPaymentCrashHook) {
  crashHook = hook ?? null;
}

async function crashPoint(point: AgentPaymentCrashPoint, paymentHash: string, executionId: string) {
  await crashHook?.(point, { paymentHash, executionId });
}

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

async function relinquishRecoverableLease(record: DistributedPaymentRecord, leaseToken: string) {
  try {
    return await releaseRecoverableDistributedLease({
      paymentHash: record.payment_hash,
      executionId: record.execution_id,
      leaseToken,
      leaseFence: record.lease_fence,
    });
  } catch {
    return { released: false, state: record.state, leaseFence: record.lease_fence };
  }
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
    const resolution = JSON.parse(record.resolution_json) as ResolveResult;
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

function storedResolution(record: DistributedPaymentRecord): ResolveResult | null {
  if (!record.resolution_json) return null;
  try {
    const value = JSON.parse(record.resolution_json) as ResolveResult;
    return value?.status === "resolved" ? value : null;
  } catch {
    return null;
  }
}

function storedRecipe(record: DistributedPaymentRecord, resolution?: ResolveResult | null): VerifiedRecipe | null {
  const fingerprint = record.provider_recipe_fingerprint
    ?? (resolution?.status === "resolved" ? resolution.recipe_fingerprint : null);
  return fingerprint ? VERIFIED_RECIPES.find(item => item.recipe_fingerprint === fingerprint) ?? null : null;
}

async function reconcileKnownDistributedSettlement(
  prior: DistributedPaymentRecord,
  currentRequestHash: string,
  leaseToken: string,
): Promise<AgentPaymentHttpResult> {
  const asset = process.env.MISSING_X402_ASSET?.trim();
  const payTo = process.env.MISSING_X402_PAY_TO?.trim();
  if (!prior.network || prior.customer_price_microusd === null || !asset || !payTo || !prior.transaction_reference) {
    await relinquishRecoverableLease(prior, leaseToken);
    return { status: 503, body: { error: "payment_reconciliation_data_incomplete", prior_state: "settling" } };
  }

  // Kappa.5.13 invariant: a known transaction may only be reconciled after the
  // current process has verified the payment and successfully acquired the durable
  // recovery lease/fence. Every authoritative transition below therefore carries
  // the newly claimed lease token.
  const chain = await x402SettlementProof({
    transaction: prior.transaction_reference,
    network: prior.network,
    asset,
    payTo,
    amount: String(prior.customer_price_microusd),
  });
  if (chain.state === "verified") {
    const reconstructed = distributedResponse(prior);
    if (!reconstructed) {
      await relinquishRecoverableLease(prior, leaseToken);
      return { status: 503, body: { error: "payment_reconciliation_data_incomplete", prior_state: "settling" } };
    }
    const committed = await settleDistributedPayment({
      paymentHash: prior.payment_hash,
      executionId: prior.execution_id,
      transactionReference: prior.transaction_reference,
      responseStatus: 200,
      responseHeaders: reconstructed.headers,
      responseBody: reconstructed.body,
      leaseToken,
    });
    if (!committed.changed) {
      const latest = await distributedPayment(prior.payment_hash);
      if (latest) {
        const latestBinding = bindingFailure(latest, currentRequestHash);
        if (latestBinding) return latestBinding;
        const recovered = cachedDistributedResponse(latest);
        if (recovered) return recovered;
        if (latest.state === "settled") return { status: 200, headers: reconstructed.headers, body: reconstructed.body };
      }
      await relinquishRecoverableLease(prior, leaseToken);
      return { status: 503, body: { error: "payment_commit_reconciliation_required", payment_settled: true, transaction: prior.transaction_reference } };
    }
    const recipeFingerprint = reconstructed.resolution.status === "resolved" ? reconstructed.resolution.recipe_fingerprint : null;
    const recipe = recipeFingerprint ? VERIFIED_RECIPES.find(item => item.recipe_fingerprint === recipeFingerprint) ?? null : null;
    if (recipe) {
      recordX402Settlement({
        paymentHash: prior.payment_hash,
        transactionReference: prior.transaction_reference,
        network: prior.network ?? undefined,
        capability: prior.capability,
        recipe,
        customerPriceMicrousd: prior.customer_price_microusd,
        realizedProviderCostMicrousd: prior.provider_cost_microusd,
      });
    }
    return { status: 200, headers: reconstructed.headers, body: reconstructed.body };
  }
  if (chain.state === "failed") {
    await failDistributedPayment({
      paymentHash: prior.payment_hash,
      executionId: prior.execution_id,
      reason: `settlement_proof_${chain.reason ?? "failed"}`,
      from: "settling",
      leaseToken,
    });
    return { status: 409, body: { error: "payment_settlement_proof_failed", reason: chain.reason, prior_state: "failed", payment_settled: false, transaction: prior.transaction_reference } };
  }
  await relinquishRecoverableLease(prior, leaseToken);
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

/**
 * Returns terminal results only. Every active durable state, including a settling
 * record with a known transaction, returns null so the request must first pass x402
 * verification and acquire the recovery lease before any reconciliation side effect.
 */
async function priorDistributedResult(paymentKey: string, currentRequestHash: string): Promise<AgentPaymentHttpResult | null> {
  if (!distributedMoneyEnabled()) return null;
  const prior = await distributedPayment(paymentKey);
  if (!prior) return null;
  const binding = bindingFailure(prior, currentRequestHash);
  if (binding) return binding;
  const cached = cachedDistributedResponse(prior);
  if (cached) return cached;

  if (prior.state === "reserved" || prior.state === "executing" || prior.state === "provider_done" || prior.state === "settling") return null;
  if (prior.state === "ambiguous") {
    return { status: 409, body: { error: "payment_outcome_ambiguous", prior_state: "ambiguous", reason: prior.reason, payment_settled: false } };
  }
  return {
    status: 409,
    body: {
      error: prior.state === "settled" ? "payment_already_settled" : "payment_already_used",
      prior_state: prior.state,
      payment_settled: prior.state === "settled",
      transaction: prior.transaction_reference ?? undefined,
    },
  };
}

function providerHeaders(recipe: VerifiedRecipe, paymentHash: string, existingKey?: string | null) {
  const policy = providerRecoveryPolicy(recipe);
  const key = policy.mode === "idempotent" ? existingKey ?? stableProviderIdempotencyKey(paymentHash, recipe.recipe_fingerprint) : null;
  return {
    policy,
    key,
    headerOverrides: policy.mode === "idempotent" && policy.idempotency_header && key
      ? { [policy.idempotency_header]: key }
      : undefined,
  };
}

async function executeDistributedProvider(args: {
  paymentHash: string;
  executionId: string;
  leaseToken: string;
  capability: string;
  input: RuntimeInput;
  pinnedRecipeFingerprint?: string;
  existingIdempotencyKey?: string | null;
}) {
  let selectedRecipe: VerifiedRecipe | null = null;
  let selectedMode: DistributedPaymentRecord["provider_recovery_mode"] = null;
  const resolution = await resolveCapability(args.capability, args.input, {
    meterEconomics: false,
    executionId: args.executionId,
    recipeFingerprint: args.pinnedRecipeFingerprint,
    stopAfterPostAttempt: true,
    beforeAttempt: async recipe => {
      const prepared = providerHeaders(recipe, args.paymentHash, args.existingIdempotencyKey);
      selectedRecipe = recipe;
      selectedMode = prepared.policy.mode;
      const durable = await markDistributedPaymentExecuting({
        paymentHash: args.paymentHash,
        executionId: args.executionId,
        recipeFingerprint: recipe.recipe_fingerprint,
        recoveryMode: prepared.policy.mode,
        providerIdempotencyKey: prepared.key,
        leaseToken: args.leaseToken,
      });
      if (!durable.changed) throw new Error("payment_execution_intent_transition_failed");
      return { headerOverrides: prepared.headerOverrides };
    },
  });
  return { resolution, selectedRecipe, selectedMode };
}

async function finishDistributedSettlement(args: {
  record: DistributedPaymentRecord;
  resolution: Extract<ResolveResult, { status: "resolved" }>;
  recipe: VerifiedRecipe;
  paymentPayload: unknown;
  requirements: X402Requirements;
  leaseToken: string;
  currentRequestHash: string;
}): Promise<AgentPaymentHttpResult> {
  const settlementIntentId = args.record.settlement_intent_id ?? stableSettlementIntentId(args.record.payment_hash, args.currentRequestHash);
  if (args.record.state === "provider_done") {
    const transitioned = await markDistributedPaymentSettling({
      paymentHash: args.record.payment_hash,
      executionId: args.record.execution_id,
      customerPriceMicrousd: args.record.customer_price_microusd!,
      providerCostMicrousd: args.record.provider_cost_microusd,
      grossMarginMicrousd: args.record.gross_margin_microusd,
      providerAttempts: args.record.provider_attempts ?? 0,
      unknownProviderCostAttempts: args.record.unknown_provider_cost_attempts ?? 0,
      resolution: args.resolution,
      network: args.requirements.network,
      settlementIntentId,
      leaseToken: args.leaseToken,
    });
    if (!transitioned.changed || !transitioned.record) return { status: 503, body: { error: "payment_state_transition_failed", payment_settled: false } };
    args.record = transitioned.record;
  }

  if (args.record.state !== "settling") return { status: 503, body: { error: "payment_state_transition_failed", prior_state: args.record.state, payment_settled: false } };
  if (!args.record.settlement_intent_id) {
    await markDistributedPaymentAmbiguous({
      paymentHash: args.record.payment_hash,
      executionId: args.record.execution_id,
      reason: "settlement_outcome_unknown_without_durable_intent",
      from: "settling",
      leaseToken: args.leaseToken,
    });
    return { status: 409, body: { error: "payment_outcome_ambiguous", prior_state: "ambiguous", payment_settled: false } };
  }

  let settlement;
  try {
    settlement = await settleX402Payment({
      paymentPayload: args.paymentPayload,
      requirements: args.requirements,
      settlementIntentId: args.record.settlement_intent_id,
    });
  } catch (error) {
    await relinquishRecoverableLease(args.record, args.leaseToken);
    return { status: 503, body: { error: "payment_settlement_reconciliation_required", payment_settled: false, reason: error instanceof Error ? error.message : String(error) } };
  }

  await crashPoint("after_settlement_effect", args.record.payment_hash, args.record.execution_id);

  if (!settlement.success && settlement.errorReason === "settlement_pending" && settlement.transaction) {
    const pending = await markDistributedSettlementPending({ paymentHash: args.record.payment_hash, executionId: args.record.execution_id, transactionReference: settlement.transaction, reason: "settlement_pending", leaseToken: args.leaseToken });
    await relinquishRecoverableLease(pending.record ?? args.record, args.leaseToken);
    return { status: 503, body: { error: "payment_settlement_reconciliation_required", payment_settled: false, transaction: settlement.transaction, prior_state: "settling" } };
  }

  if (!settlement.success || !settlement.transaction) {
    await failDistributedPayment({ paymentHash: args.record.payment_hash, executionId: args.record.execution_id, reason: settlement.errorReason ?? "payment_settlement_failed", from: "settling", leaseToken: args.leaseToken });
    return { status: 402, body: { error: settlement.errorReason ?? "payment_settlement_failed", payment_settled: false } };
  }

  const observed = await markDistributedSettlementPending({
    paymentHash: args.record.payment_hash,
    executionId: args.record.execution_id,
    transactionReference: settlement.transaction,
    reason: "settlement_transaction_observed",
    leaseToken: args.leaseToken,
  });
  if (!observed.changed) {
    await relinquishRecoverableLease(args.record, args.leaseToken);
    return { status: 503, body: { error: "payment_settlement_reconciliation_required", payment_settled: false, transaction: settlement.transaction } };
  }
  args.record = observed.record ?? args.record;

  await crashPoint("after_settlement_transaction_persisted", args.record.payment_hash, args.record.execution_id);

  const chain = await x402SettlementProof({
    transaction: settlement.transaction,
    network: args.requirements.network,
    asset: args.requirements.asset,
    payTo: args.requirements.payTo,
    amount: args.requirements.amount,
  });
  if (chain.state === "failed") {
    await failDistributedPayment({ paymentHash: args.record.payment_hash, executionId: args.record.execution_id, reason: `settlement_proof_${chain.reason ?? "failed"}`, from: "settling", leaseToken: args.leaseToken });
    return { status: 409, body: { error: "payment_settlement_proof_failed", payment_settled: false, transaction: settlement.transaction, reason: chain.reason } };
  }
  if (chain.state !== "verified") {
    const pending = await markDistributedSettlementPending({ paymentHash: args.record.payment_hash, executionId: args.record.execution_id, transactionReference: settlement.transaction, reason: `settlement_proof_${chain.state}${chain.reason ? `:${chain.reason}` : ""}`, leaseToken: args.leaseToken });
    await relinquishRecoverableLease(pending.record ?? args.record, args.leaseToken);
    return { status: 503, body: { error: "payment_settlement_reconciliation_required", payment_settled: false, transaction: settlement.transaction, prior_state: "settling", reconciliation: chain.state, reason: chain.reason } };
  }

  const responseHeaders = { "PAYMENT-RESPONSE": x402PaymentResponseHeader(settlement), "Cache-Control": "private, no-store" };
  const responseBody = {
    status: "resolved",
    payment: {
      rail: "x402", settled: true, amount_microusd: args.record.customer_price_microusd, transaction: settlement.transaction,
      provider_attempts: args.record.provider_attempts ?? 0, provider_cost_microusd: args.record.provider_cost_microusd,
      unknown_provider_cost_attempts: args.record.unknown_provider_cost_attempts ?? 0, realized_gross_margin_microusd: args.record.gross_margin_microusd,
    },
    resolution: args.resolution,
  };
  const committed = await settleDistributedPayment({
    paymentHash: args.record.payment_hash,
    executionId: args.record.execution_id,
    transactionReference: settlement.transaction,
    responseStatus: 200,
    responseHeaders,
    responseBody,
    leaseToken: args.leaseToken,
  });
  if (!committed.changed) {
    await relinquishRecoverableLease(args.record, args.leaseToken);
    return { status: 503, body: { error: "payment_commit_reconciliation_required", payment_settled: true, transaction: settlement.transaction } };
  }

  recordX402Settlement({
    paymentHash: args.record.payment_hash,
    transactionReference: settlement.transaction,
    network: settlement.network,
    capability: args.record.capability,
    recipe: args.recipe,
    customerPriceMicrousd: args.record.customer_price_microusd!,
    realizedProviderCostMicrousd: args.record.provider_cost_microusd,
  });
  return { status: 200, headers: responseHeaders, body: responseBody };
}

async function resumeDistributedPayment(args: {
  record: DistributedPaymentRecord;
  leaseToken: string;
  capability: string;
  input: RuntimeInput;
  paymentPayload: unknown;
  requirements: X402Requirements;
  requestHash: string;
}): Promise<AgentPaymentHttpResult> {
  let record = args.record;
  let resolution = storedResolution(record);
  let recipe = storedRecipe(record, resolution);

  if (record.state === "executing") {
    if (record.provider_recovery_mode === "ambiguous" || !record.provider_recipe_fingerprint) {
      await markDistributedPaymentAmbiguous({
        paymentHash: record.payment_hash,
        executionId: record.execution_id,
        reason: "provider_outcome_unknown_without_idempotency",
        from: "executing",
        leaseToken: args.leaseToken,
      });
      return { status: 409, body: { error: "payment_outcome_ambiguous", prior_state: "ambiguous", payment_settled: false } };
    }
    const executed = await executeDistributedProvider({
      paymentHash: record.payment_hash,
      executionId: record.execution_id,
      leaseToken: args.leaseToken,
      capability: args.capability,
      input: args.input,
      pinnedRecipeFingerprint: record.provider_recipe_fingerprint,
      existingIdempotencyKey: record.provider_idempotency_key,
    });
    if (executed.resolution.status !== "resolved") {
      await relinquishRecoverableLease(record, args.leaseToken);
      return { status: 503, body: { error: "provider_recovery_required", prior_state: "executing", payment_settled: false, reason: executed.resolution.reason } };
    }
    await crashPoint("after_provider_effect", record.payment_hash, record.execution_id);
    resolution = executed.resolution;
    recipe = executed.selectedRecipe ?? storedRecipe(record, resolution);
  } else if (record.state === "reserved") {
    const executed = await executeDistributedProvider({
      paymentHash: record.payment_hash,
      executionId: record.execution_id,
      leaseToken: args.leaseToken,
      capability: args.capability,
      input: args.input,
    });
    if (executed.resolution.status !== "resolved") {
      await relinquishRecoverableLease(record, args.leaseToken);
      return { status: 503, body: { error: "provider_recovery_required", prior_state: "executing", payment_settled: false, reason: executed.resolution.reason } };
    }
    await crashPoint("after_provider_effect", record.payment_hash, record.execution_id);
    resolution = executed.resolution;
    recipe = executed.selectedRecipe ?? storedRecipe(record, resolution);
  }

  if (record.state === "reserved" || record.state === "executing") {
    if (!resolution || resolution.status !== "resolved" || !recipe) {
      await relinquishRecoverableLease(record, args.leaseToken);
      return { status: 503, body: { error: "payment_recovery_data_incomplete", payment_settled: false } };
    }
    const economics = recipeEconomics(recipe);
    const realized = providerCostForExecution(record.execution_id);
    if (!economics || economics.customer_price_microusd !== Number(args.requirements.amount)) {
      await markDistributedPaymentAmbiguous({ paymentHash: record.payment_hash, executionId: record.execution_id, reason: "pricing_changed_during_recovery", from: "executing", leaseToken: args.leaseToken });
      return { status: 409, body: { error: "payment_outcome_ambiguous", reason: "pricing_changed_during_recovery", payment_settled: false } };
    }
    const grossMargin = realized.provider_cost_microusd === null ? null : economics.customer_price_microusd - realized.provider_cost_microusd;
    const done = await markDistributedProviderDone({
      paymentHash: record.payment_hash,
      executionId: record.execution_id,
      customerPriceMicrousd: economics.customer_price_microusd,
      providerCostMicrousd: realized.provider_cost_microusd,
      grossMarginMicrousd: grossMargin,
      providerAttempts: realized.attempts,
      unknownProviderCostAttempts: realized.unknown_cost_attempts,
      resolution,
      network: args.requirements.network,
      leaseToken: args.leaseToken,
    });
    if (!done.changed || !done.record) {
      await relinquishRecoverableLease(record, args.leaseToken);
      return { status: 503, body: { error: "payment_state_transition_failed", payment_settled: false } };
    }
    record = done.record;
  }

  if (record.state === "provider_done") {
    resolution = storedResolution(record) ?? resolution;
    recipe = storedRecipe(record, resolution) ?? recipe;
  }
  if (record.state === "settling" && record.transaction_reference) {
    return reconcileKnownDistributedSettlement(record, args.requestHash, args.leaseToken);
  }
  if (record.state === "settling" && !record.settlement_intent_id) {
    await markDistributedPaymentAmbiguous({ paymentHash: record.payment_hash, executionId: record.execution_id, reason: "settlement_outcome_unknown_without_durable_intent", from: "settling", leaseToken: args.leaseToken });
    return { status: 409, body: { error: "payment_outcome_ambiguous", prior_state: "ambiguous", payment_settled: false } };
  }
  if (!resolution || resolution.status !== "resolved" || !recipe || record.customer_price_microusd === null) {
    await relinquishRecoverableLease(record, args.leaseToken);
    return { status: 503, body: { error: "payment_recovery_data_incomplete", prior_state: record.state, payment_settled: false } };
  }
  return finishDistributedSettlement({
    record,
    resolution,
    recipe,
    paymentPayload: args.paymentPayload,
    requirements: args.requirements,
    leaseToken: args.leaseToken,
    currentRequestHash: args.requestHash,
  });
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

    if (distributedMoneyEnabled()) {
      const existing = await distributedPayment(verified.paymentHash);
      if (existing) {
        const binding = bindingFailure(existing, requestHash);
        if (binding) return binding;
        const terminal = await priorDistributedResult(verified.paymentHash, requestHash);
        if (terminal) return terminal;
        const leaseToken = randomUUID();
        const claimed = await claimDistributedRecovery({ paymentHash: verified.paymentHash, requestHash, leaseToken });
        if (!claimed.claimed || !claimed.record) {
          const latest = await distributedPayment(verified.paymentHash);
          return {
            status: latest?.state === "settling" ? 503 : 409,
            body: { error: "payment_in_progress", prior_state: latest?.state ?? existing.state, payment_settled: false },
          };
        }
        return resumeDistributedPayment({
          record: claimed.record,
          leaseToken,
          capability: args.request.capability,
          input: args.request.input,
          paymentPayload: verified.paymentPayload,
          requirements,
          requestHash,
        });
      }

      const executionId = randomUUID();
      const reservation = await reserveDistributedPayment({ paymentHash: verified.paymentHash, requestHash, executionId, capability: args.request.capability });
      if (!reservation.reserved || !reservation.prior) return await priorDistributedResult(verified.paymentHash, requestHash) ?? { status: 409, body: { error: "payment_already_used" } };
      await crashPoint("after_reservation", verified.paymentHash, executionId);
      return resumeDistributedPayment({
        record: reservation.prior,
        leaseToken: reservation.leaseToken ?? executionId,
        capability: args.request.capability,
        input: args.request.input,
        paymentPayload: verified.paymentPayload,
        requirements,
        requestHash,
      });
    }

    const executionId = randomUUID();
    if (transactionalMoneyEnabled()) {
      const reservation = reserveTransactionalPayment({ paymentHash: verified.paymentHash, requestHash, executionId, capability: args.request.capability });
      if (!reservation.reserved) return priorSqliteResult(verified.paymentHash, requestHash) ?? { status: 409, body: { error: "payment_already_used" } };
    } else {
      const guard = reserveX402Payment({ paymentHash: verified.paymentHash, executionId, capability: args.request.capability });
      if (!guard.reserved) return { status: 409, body: { error: guard.prior?.state === "settled" ? "payment_already_settled" : "payment_already_used", prior_state: guard.prior?.state ?? "in_progress", payment_settled: guard.prior?.state === "settled", transaction: guard.prior?.transaction_reference ?? undefined } };
    }

    const resolution = await resolveCapability(args.request.capability, args.request.input, { meterEconomics: false, executionId });
    if (resolution.status !== "resolved") {
      if (transactionalMoneyEnabled()) failTransactionalPayment({ paymentHash: verified.paymentHash, executionId, reason: resolution.reason });
      else failX402PaymentGuard({ paymentHash: verified.paymentHash, executionId, capability: args.request.capability, reason: resolution.reason });
      return { status: 502, body: { status: resolution.status, reason: resolution.reason, payment_settled: false } };
    }

    const recipe = VERIFIED_RECIPES.find(item => item.recipe_fingerprint === resolution.recipe_fingerprint) ?? null;
    const economics = recipe ? recipeEconomics(recipe) : null;
    if (!recipe || !economics || economics.customer_price_microusd !== quote.customer_price_microusd) {
      if (transactionalMoneyEnabled()) failTransactionalPayment({ paymentHash: verified.paymentHash, executionId, reason: "pricing_changed_before_settlement" });
      else failX402PaymentGuard({ paymentHash: verified.paymentHash, executionId, capability: args.request.capability, reason: "pricing_changed_before_settlement" });
      return { status: 503, body: { error: "pricing_changed_before_settlement", payment_settled: false } };
    }

    const realized = providerCostForExecution(executionId);
    const grossMargin = realized.provider_cost_microusd === null ? null : quote.customer_price_microusd - realized.provider_cost_microusd;
    if (transactionalMoneyEnabled()) {
      const transition = markTransactionalPaymentSettling({ paymentHash: verified.paymentHash, executionId });
      if (!transition.changed) return { status: 503, body: { error: "payment_state_transition_failed", payment_settled: false } };
    }

    let settlement;
    try {
      settlement = await settleX402Payment({ paymentPayload: verified.paymentPayload, requirements });
    } catch (error) {
      if (!transactionalMoneyEnabled()) failX402PaymentGuard({ paymentHash: verified.paymentHash, executionId, capability: args.request.capability, reason: "payment_settlement_unavailable" });
      return { status: 503, body: { error: transactionalMoneyEnabled() ? "payment_settlement_reconciliation_required" : "payment_settlement_unavailable", payment_settled: false, reason: error instanceof Error ? error.message : String(error) } };
    }

    if (!settlement.success || !settlement.transaction) {
      if (transactionalMoneyEnabled()) failTransactionalPayment({ paymentHash: verified.paymentHash, executionId, reason: settlement.errorReason ?? "payment_settlement_failed", from: "settling" });
      else failX402PaymentGuard({ paymentHash: verified.paymentHash, executionId, capability: args.request.capability, reason: settlement.errorReason ?? "payment_settlement_failed" });
      return { status: 402, body: { error: settlement.errorReason ?? "payment_settlement_failed", payment_settled: false } };
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

    if (transactionalMoneyEnabled()) {
      const committed = settleTransactionalPayment({ paymentHash: verified.paymentHash, executionId, transactionReference: settlement.transaction, responseStatus: 200, responseHeaders, responseBody, customerPriceMicrousd: quote.customer_price_microusd, providerCostMicrousd: realized.provider_cost_microusd, grossMarginMicrousd: grossMargin });
      if (!committed.changed) return { status: 503, body: { error: "payment_commit_reconciliation_required", payment_settled: true, transaction: settlement.transaction } };
    }

    recordX402Settlement({ paymentHash: verified.paymentHash, transactionReference: settlement.transaction, network: settlement.network, capability: args.request.capability, recipe, customerPriceMicrousd: quote.customer_price_microusd, realizedProviderCostMicrousd: realized.provider_cost_microusd });
    if (!transactionalMoneyEnabled()) settleX402PaymentGuard({ paymentHash: verified.paymentHash, executionId, capability: args.request.capability, transactionReference: settlement.transaction });
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