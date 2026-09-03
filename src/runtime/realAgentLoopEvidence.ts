import type { DemandLedgerEvent } from "./demandLedger.js";
import type { SupplyLedgerEvent } from "./supplyLedger.js";

export interface RealAgentLoopPaymentEvidence {
  payment_hash: string;
  request_hash: string | null;
  execution_id: string;
  capability: string;
  state: string;
  created_at: string;
  updated_at: string;
  transaction_reference: string | null;
  customer_price_microusd: number | null;
  provider_cost_microusd: number | null;
  gross_margin_microusd: number | null;
  provider_recipe_fingerprint: string | null;
}

export interface RealAgentLoopAssertions {
  external_agent_demand_precedes_promotion: boolean;
  promotion_is_linked_to_demand: boolean;
  two_settled_paid_resolutions_after_promotion: boolean;
  same_promoted_recipe_reused: boolean;
  distinct_request_hashes: boolean;
  distinct_payments_and_settlements: boolean;
  positive_margin_each_resolution: boolean;
  single_promotion_for_recipe: boolean;
}

export interface RealAgentLoopEvaluation {
  qualified: boolean;
  assertions: RealAgentLoopAssertions;
  evidence: {
    demand: DemandLedgerEvent | null;
    promotion: SupplyLedgerEvent | null;
    paid_resolutions: RealAgentLoopPaymentEvidence[];
  };
}

const EXTERNAL_AGENT_SOURCES = new Set(["a2a", "mcp"]);

function time(value: string): number | null {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function paidAfterPromotion(payment: RealAgentLoopPaymentEvidence, promotion: SupplyLedgerEvent): boolean {
  const paidAt = time(payment.updated_at);
  const promotedAt = time(promotion.promoted_at);
  return payment.state === "settled"
    && paidAt !== null
    && promotedAt !== null
    && paidAt > promotedAt
    && payment.capability === promotion.recipe.capability
    && payment.provider_recipe_fingerprint === promotion.recipe.recipe_fingerprint;
}

function positiveMargin(payment: RealAgentLoopPaymentEvidence): boolean {
  return payment.customer_price_microusd !== null
    && payment.provider_cost_microusd !== null
    && payment.gross_margin_microusd !== null
    && payment.customer_price_microusd > payment.provider_cost_microusd
    && payment.gross_margin_microusd > 0
    && payment.customer_price_microusd - payment.provider_cost_microusd === payment.gross_margin_microusd;
}

function validPaidPair(a: RealAgentLoopPaymentEvidence, b: RealAgentLoopPaymentEvidence): boolean {
  return Boolean(
    a.request_hash
    && b.request_hash
    && a.request_hash !== b.request_hash
    && a.payment_hash !== b.payment_hash
    && a.execution_id !== b.execution_id
    && a.transaction_reference
    && b.transaction_reference
    && a.transaction_reference !== b.transaction_reference,
  );
}

function bestPaidPair(payments: RealAgentLoopPaymentEvidence[]): RealAgentLoopPaymentEvidence[] {
  for (let i = 0; i < payments.length; i += 1) {
    for (let j = i + 1; j < payments.length; j += 1) {
      if (validPaidPair(payments[i], payments[j])) return [payments[i], payments[j]];
    }
  }
  return payments.slice(0, 2);
}

function emptyAssertions(): RealAgentLoopAssertions {
  return {
    external_agent_demand_precedes_promotion: false,
    promotion_is_linked_to_demand: false,
    two_settled_paid_resolutions_after_promotion: false,
    same_promoted_recipe_reused: false,
    distinct_request_hashes: false,
    distinct_payments_and_settlements: false,
    positive_margin_each_resolution: false,
    single_promotion_for_recipe: false,
  };
}

function score(assertions: RealAgentLoopAssertions): number {
  return Object.values(assertions).filter(Boolean).length;
}

export function evaluateRealAgentPaidClosedLoop(args: {
  demands: DemandLedgerEvent[];
  promotions: SupplyLedgerEvent[];
  payments: RealAgentLoopPaymentEvidence[];
}): RealAgentLoopEvaluation {
  let best: RealAgentLoopEvaluation = {
    qualified: false,
    assertions: emptyAssertions(),
    evidence: { demand: null, promotion: null, paid_resolutions: [] },
  };

  for (const promotion of args.promotions) {
    const origin = promotion.origin;
    if (!origin) continue;
    const promotedAt = time(promotion.promoted_at);
    const demand = args.demands
      .filter(event => event.normalized_intent === origin.normalized_intent)
      .filter(event => EXTERNAL_AGENT_SOURCES.has(event.source))
      .filter(event => promotedAt !== null && time(event.observed_at) !== null && time(event.observed_at)! < promotedAt)
      .sort((a, b) => a.observed_at.localeCompare(b.observed_at))[0] ?? null;

    const eligiblePayments = args.payments
      .filter(payment => paidAfterPromotion(payment, promotion))
      .sort((a, b) => a.updated_at.localeCompare(b.updated_at));
    const pair = bestPaidPair(eligiblePayments);
    const singlePromotion = args.promotions.filter(item => item.recipe.recipe_fingerprint === promotion.recipe.recipe_fingerprint).length === 1;

    const assertions: RealAgentLoopAssertions = {
      external_agent_demand_precedes_promotion: demand !== null,
      promotion_is_linked_to_demand: demand !== null
        && origin.normalized_intent === demand.normalized_intent
        && origin.demand_intent.trim().length > 0,
      two_settled_paid_resolutions_after_promotion: pair.length >= 2 && pair.every(payment => paidAfterPromotion(payment, promotion)),
      same_promoted_recipe_reused: pair.length >= 2 && pair.every(payment => payment.provider_recipe_fingerprint === promotion.recipe.recipe_fingerprint && payment.capability === promotion.recipe.capability),
      distinct_request_hashes: pair.length >= 2 && Boolean(pair[0].request_hash && pair[1].request_hash && pair[0].request_hash !== pair[1].request_hash),
      distinct_payments_and_settlements: pair.length >= 2 && validPaidPair(pair[0], pair[1]),
      positive_margin_each_resolution: pair.length >= 2 && pair.every(positiveMargin),
      single_promotion_for_recipe: singlePromotion,
    };
    const qualified = Object.values(assertions).every(Boolean);
    const candidate: RealAgentLoopEvaluation = {
      qualified,
      assertions,
      evidence: { demand, promotion, paid_resolutions: pair },
    };
    if (qualified) return candidate;
    if (score(assertions) > score(best.assertions)) best = candidate;
  }

  return best;
}
