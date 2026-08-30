import { acquireVerifiedSupplyCandidate, rankSupplyOpportunities, type SupplyOpportunity } from "./acquisition.js";
import { compileOpenApiLead, type OpenApiCompileResult } from "./openApiCompiler.js";
import { discoverProviderCandidates, type ProviderDiscoveryCandidate } from "./providerDiscovery.js";

export type Theta4Status = "promoted" | "rejected" | "needs_evidence" | "no_candidates";

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
  const opportunity = rankSupplyOpportunities(1)[0] ?? null;
  const trace: Theta4TraceStep[] = [];
  if (!opportunity) {
    trace.push({ stage: "opportunity", status: "none", detail: "No unresolved demand is currently ranked" });
    return { status: "no_candidates", opportunity: null, selected_provider: null, recipe_fingerprint: null, trace, reason: "No unresolved demand opportunity is available" };
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
  return { status: "rejected", opportunity, selected_provider: null, recipe_fingerprint: null, trace, reason: lastRejection ?? "All discovered provider candidates were rejected" };
}
