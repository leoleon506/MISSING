import { acquireVerifiedSupplyCandidate, rankSupplyOpportunities, type SupplyOpportunity } from "./acquisition.js";
import { compileOpenApiLead, type OpenApiCompileResult } from "./openApiCompiler.js";
import { discoverProviderCandidates, type ProviderDiscoveryCandidate } from "./providerDiscovery.js";
import { isSupplyIntentBlocked, recordSupplyBlock } from "./supplyBlockLedger.js";

export type Theta4Status = "promoted" | "rejected" | "needs_evidence" | "needs_provider_setup" | "no_candidates";

export interface Theta4TraceStep {
  stage: "opportunity" | "discovery" | "compile" | "verify_promote";
  status: string;
  provider?: string;
  candidate_id?: string;
  detail?: string;
}

export interface Theta4Result {
  status: Theta4Status;
  opportunity: SupplyOpportunity | null;
  selected_provider: string | null;
  recipe_fingerprint: string | null;
  trace: Theta4TraceStep[];
  reason: string | null;
}

export function thetaOrchestratorEnabled(): boolean {
  return process.env.MISSING_THETA_ORCHESTRATOR_ENABLED === "1";
}

type DiscoverFn = (opportunity: SupplyOpportunity, options?: { limit?: number; directoryUrl?: string }) => Promise<ProviderDiscoveryCandidate[]>;
type CompileFn = (lead: ProviderDiscoveryCandidate) => Promise<OpenApiCompileResult>;
type AcquireFn = typeof acquireVerifiedSupplyCandidate;

export async function runThetaOrchestrator(options: {
  candidateLimit?: number;
  directoryUrl?: string;
  timeoutMs?: number;
  discoverFn?: DiscoverFn;
  compileFn?: CompileFn;
  acquireFn?: AcquireFn;
} = {}): Promise<Theta4Result> {
  const ranked = rankSupplyOpportunities(50);
  const opportunity = ranked.find(item => !isSupplyIntentBlocked(item.normalized_intent)) ?? null;
  const trace: Theta4TraceStep[] = [];
  if (!opportunity) {
    const detail = ranked.length ? "All ranked unresolved demand is temporarily blocked by supply backoff" : "No unresolved demand is currently ranked";
    trace.push({ stage: "opportunity", status: ranked.length ? "blocked" : "none", detail });
    return { status: "no_candidates", opportunity: null, selected_provider: null, recipe_fingerprint: null, trace, reason: detail };
  }
  trace.push({ stage: "opportunity", status: "selected", detail: opportunity.normalized_intent });

  const discoverFn = options.discoverFn ?? discoverProviderCandidates;
  let leads: ProviderDiscoveryCandidate[];
  try {
    leads = await discoverFn(opportunity, { limit: options.candidateLimit ?? 5, directoryUrl: options.directoryUrl });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    trace.push({ stage: "discovery", status: "error", detail: reason });
    return { status: "no_candidates", opportunity, selected_provider: null, recipe_fingerprint: null, trace, reason };
  }
  trace.push({ stage: "discovery", status: leads.length ? "candidates_found" : "none", detail: String(leads.length) });
  if (!leads.length) {
    return { status: "no_candidates", opportunity, selected_provider: null, recipe_fingerprint: null, trace, reason: "No provider candidates matched the top unresolved demand" };
  }

  const compileFn = options.compileFn ?? (lead => compileOpenApiLead(lead));
  const acquireFn = options.acquireFn ?? acquireVerifiedSupplyCandidate;
  let sawNeedsEvidence = false;
  let providerSetupReason: string | null = null;
  let providerSetupLead: ProviderDiscoveryCandidate | null = null;
  let providerSetupResult: OpenApiCompileResult | null = null;
  let lastRejection: string | null = null;

  for (const lead of leads) {
    let compiled: OpenApiCompileResult;
    try {
      compiled = await compileFn(lead);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      trace.push({ stage: "compile", status: "error", provider: lead.provider, detail });
      lastRejection = detail;
      continue;
    }

    trace.push({
      stage: "compile",
      status: compiled.status,
      provider: lead.provider,
      candidate_id: compiled.candidate?.candidate_id,
      detail: compiled.reason ?? undefined,
    });

    if (compiled.status === "needs_provider_setup") {
      if (!providerSetupReason) {
        providerSetupReason = compiled.reason ?? "Relevant provider requires setup before automatic verification";
        providerSetupLead = lead;
        providerSetupResult = compiled;
      }
      continue;
    }
    if (compiled.status === "needs_verification_inputs") {
      sawNeedsEvidence = true;
      continue;
    }
    if (compiled.status !== "candidate_ready" || !compiled.candidate) {
      lastRejection = compiled.reason ?? "Candidate compilation was unsupported";
      continue;
    }

    try {
      const acquisition = await acquireFn(compiled.candidate, { timeoutMs: options.timeoutMs });
      trace.push({
        stage: "verify_promote",
        status: acquisition.status,
        provider: lead.provider,
        candidate_id: compiled.candidate.candidate_id,
        detail: acquisition.verification.reason ?? acquisition.promotion.reason ?? undefined,
      });
      if (acquisition.status === "promoted" || acquisition.status === "already_registered") {
        return {
          status: "promoted",
          opportunity,
          selected_provider: lead.provider,
          recipe_fingerprint: acquisition.verification.recipe_fingerprint,
          trace,
          reason: acquisition.status === "already_registered" ? "Verified recipe was already registered" : null,
        };
      }
      lastRejection = acquisition.verification.reason ?? acquisition.promotion.reason ?? "Live replay rejected the candidate";
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      trace.push({ stage: "verify_promote", status: "error", provider: lead.provider, candidate_id: compiled.candidate.candidate_id, detail });
      lastRejection = detail;
    }
  }

  if (sawNeedsEvidence) {
    return { status: "needs_evidence", opportunity, selected_provider: null, recipe_fingerprint: null, trace, reason: "At least one provider lead compiled but lacked two evidence-backed verification inputs" };
  }
  if (providerSetupReason) {
    const readiness = providerSetupResult?.provider_readiness;
    const block = recordSupplyBlock({
      normalized_intent: opportunity.normalized_intent,
      intent: opportunity.intent,
      provider: providerSetupLead?.provider ?? null,
      reason: providerSetupReason,
      credentials_required: readiness?.credentials_required ?? [],
      response_schema_missing: readiness?.response_schema_missing ?? false,
    });
    trace.push({ stage: "opportunity", status: "backoff_recorded", provider: providerSetupLead?.provider, detail: block.retry_after });
    return { status: "needs_provider_setup", opportunity, selected_provider: null, recipe_fingerprint: null, trace, reason: `${providerSetupReason} Retry after ${block.retry_after}.` };
  }
  return { status: "rejected", opportunity, selected_provider: null, recipe_fingerprint: null, trace, reason: lastRejection ?? "All discovered provider candidates were rejected" };
}
