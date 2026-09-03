import { acquireVerifiedSupplyCandidate, rankSupplyOpportunities, type SupplyOpportunity } from "./acquisition.js";
import { compileOpenApiLead, type OpenApiCompileResult } from "./openApiCompiler.js";
import { demandVerificationInputs } from "./discovery.js";
import { discoverProviderCandidates, type ProviderDiscoveryCandidate } from "./providerDiscovery.js";
import { acquireSafePostCandidate, safePostReplayEnabled } from "./safePostReplay.js";
import { isSupplyIntentBlocked, recordSupplyBlock } from "./supplyBlockLedger.js";

export type Theta4Status = "promoted" | "rejected" | "needs_evidence" | "needs_safe_verification" | "candidate_ready_for_safe_post_replay" | "needs_provider_setup" | "no_candidates";

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

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;
type DiscoverFn = (opportunity: SupplyOpportunity, options?: { limit?: number; directoryUrl?: string }) => Promise<ProviderDiscoveryCandidate[]>;
type CompileFn = (lead: ProviderDiscoveryCandidate) => Promise<OpenApiCompileResult>;
type AcquireFn = typeof acquireVerifiedSupplyCandidate;
type SafePostAcquireFn = typeof acquireSafePostCandidate;

const DEFAULT_CYCLE_TIMEOUT_MS = 8_000;
const DEFAULT_DEPENDENCY_TIMEOUT_MS = 5_000;
const DEADLINE_RESERVE_MS = 500;

function boundedMs(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? Math.max(100, Math.min(parsed, 30_000)) : fallback;
}

function dependencyTimeoutMs() {
  return boundedMs(process.env.MISSING_ACQUISITION_DEPENDENCY_TIMEOUT_MS, DEFAULT_DEPENDENCY_TIMEOUT_MS);
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export async function runThetaOrchestrator(options: {
  candidateLimit?: number;
  directoryUrl?: string;
  timeoutMs?: number;
  discoverFn?: DiscoverFn;
  compileFn?: CompileFn;
  acquireFn?: AcquireFn;
  safePostAcquireFn?: SafePostAcquireFn;
  dependencyFetchFn?: FetchLike;
} = {}): Promise<Theta4Result> {
  const cycleTimeoutMs = boundedMs(options.timeoutMs, DEFAULT_CYCLE_TIMEOUT_MS);
  const deadlineAt = Date.now() + Math.max(100, cycleTimeoutMs - DEADLINE_RESERVE_MS);
  const remainingMs = () => Math.max(0, deadlineAt - Date.now());
  const dependencyBaseFetch = options.dependencyFetchFn ?? fetch;
  const dependencyFetch: FetchLike = async (input, init) => {
    const remaining = remainingMs();
    if (remaining <= 0) throw new Error("Acquisition cycle deadline exhausted before dependency request");
    const timeout = Math.max(100, Math.min(dependencyTimeoutMs(), remaining));
    const deadlineSignal = AbortSignal.timeout(timeout);
    const signal = init?.signal ? AbortSignal.any([init.signal, deadlineSignal]) : deadlineSignal;
    try {
      return await dependencyBaseFetch(input, { ...init, signal });
    } catch (error) {
      if (deadlineSignal.aborted) throw new Error(`Acquisition dependency timed out after ${timeout} ms`);
      throw error;
    }
  };

  const ranked = rankSupplyOpportunities(50);
  const opportunity = ranked.find(item => !isSupplyIntentBlocked(item.normalized_intent)) ?? null;
  const trace: Theta4TraceStep[] = [];
  if (!opportunity) {
    const detail = ranked.length ? "All ranked unresolved demand is temporarily blocked by supply backoff" : "No unresolved demand is currently ranked";
    trace.push({ stage: "opportunity", status: ranked.length ? "blocked" : "none", detail });
    return { status: "no_candidates", opportunity: null, selected_provider: null, recipe_fingerprint: null, trace, reason: detail };
  }
  trace.push({ stage: "opportunity", status: "selected", detail: opportunity.normalized_intent });

  const recordBackoff = (reason: string, provider: string | null = null, readiness: { credentials_required?: string[]; response_schema_missing?: boolean } = {}) => {
    const block = recordSupplyBlock({
      normalized_intent: opportunity.normalized_intent,
      intent: opportunity.intent,
      provider,
      reason,
      credentials_required: readiness.credentials_required ?? [],
      response_schema_missing: readiness.response_schema_missing ?? false,
    });
    trace.push({ stage: "opportunity", status: "backoff_recorded", provider: provider ?? undefined, detail: block.retry_after });
    return block;
  };

  const discoverFn = options.discoverFn ?? ((item, discoverOptions) => discoverProviderCandidates(item, {
    ...discoverOptions,
    fetchFn: dependencyFetch,
  }));
  let leads: ProviderDiscoveryCandidate[];
  try {
    leads = await discoverFn(opportunity, { limit: options.candidateLimit ?? 5, directoryUrl: options.directoryUrl });
  } catch (error) {
    const reason = errorMessage(error);
    trace.push({ stage: "discovery", status: "error", detail: reason });
    const block = recordBackoff(reason);
    return { status: "no_candidates", opportunity, selected_provider: null, recipe_fingerprint: null, trace, reason: `${reason} Retry after ${block.retry_after}.` };
  }
  trace.push({ stage: "discovery", status: leads.length ? "candidates_found" : "none", detail: String(leads.length) });
  if (!leads.length) {
    const reason = "No provider candidates matched the top unresolved demand";
    const block = recordBackoff(reason);
    return { status: "no_candidates", opportunity, selected_provider: null, recipe_fingerprint: null, trace, reason: `${reason} Retry after ${block.retry_after}.` };
  }

  const callerInputs = demandVerificationInputs(opportunity.normalized_intent, opportunity.requested_capability, 2);
  if (callerInputs.length >= 2) trace.push({ stage: "opportunity", status: "caller_evidence_ready", detail: String(callerInputs.length) });
  const compileFn = options.compileFn ?? (lead => compileOpenApiLead(lead, {
    capability: opportunity.requested_capability ?? undefined,
    verificationInputs: callerInputs.length >= 2 ? callerInputs : undefined,
    fetchFn: dependencyFetch,
  }));
  const acquireFn = options.acquireFn ?? acquireVerifiedSupplyCandidate;
  const safePostAcquireFn = options.safePostAcquireFn ?? acquireSafePostCandidate;
  let evidenceReason: string | null = null;
  let evidenceLead: ProviderDiscoveryCandidate | null = null;
  let safeVerificationReason: string | null = null;
  let safeVerificationLead: ProviderDiscoveryCandidate | null = null;
  let providerSetupReason: string | null = null;
  let providerSetupLead: ProviderDiscoveryCandidate | null = null;
  let providerSetupResult: OpenApiCompileResult | null = null;
  let lastRejection: string | null = null;

  for (const lead of leads) {
    if (remainingMs() <= 100) {
      lastRejection = "Acquisition cycle deadline exhausted before all provider candidates were compiled";
      trace.push({ stage: "compile", status: "deadline_exhausted", provider: lead.provider, detail: lastRejection });
      break;
    }

    let compiled: OpenApiCompileResult;
    try {
      compiled = await compileFn(lead);
    } catch (error) {
      const detail = errorMessage(error);
      trace.push({ stage: "compile", status: "error", provider: lead.provider, detail });
      lastRejection = detail;
      if (remainingMs() <= 100) break;
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
    if (compiled.status === "candidate_ready_for_safe_post_replay") {
      if (!compiled.candidate || !compiled.safe_post_verification) {
        lastRejection = "Safe POST compiler result is missing candidate or policy evidence";
        continue;
      }
      if (!safePostReplayEnabled()) {
        return {
          status: "candidate_ready_for_safe_post_replay",
          opportunity,
          selected_provider: lead.provider,
          recipe_fingerprint: null,
          trace,
          reason: compiled.reason ?? "POST candidate passed the safe replay policy; enable the trusted Lambda.3 verifier to continue",
        };
      }
      if (remainingMs() <= 100) {
        lastRejection = "Acquisition cycle deadline exhausted before safe POST replay";
        trace.push({ stage: "verify_promote", status: "deadline_exhausted", provider: lead.provider, candidate_id: compiled.candidate.candidate_id, detail: lastRejection });
        break;
      }
      try {
        const replayCount = Math.max(1, compiled.candidate.verification_inputs.length);
        const replayTimeoutMs = Math.max(100, Math.floor(remainingMs() / replayCount));
        const acquisition = await safePostAcquireFn(compiled.candidate, compiled.safe_post_verification, { timeoutMs: replayTimeoutMs });
        trace.push({
          stage: "verify_promote",
          status: `safe_post_${acquisition.status}`,
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
            reason: acquisition.status === "already_registered" ? "Safe POST recipe was already registered" : null,
          };
        }
        lastRejection = acquisition.verification.reason ?? acquisition.promotion.reason ?? "Safe POST replay rejected the candidate";
        continue;
      } catch (error) {
        const detail = errorMessage(error);
        trace.push({ stage: "verify_promote", status: "safe_post_error", provider: lead.provider, candidate_id: compiled.candidate.candidate_id, detail });
        lastRejection = detail;
        continue;
      }
    }
    if (compiled.status === "needs_safe_verification") {
      if (!safeVerificationReason) {
        safeVerificationReason = compiled.reason ?? "POST candidate requires explicit side-effect-safe verification before live replay";
        safeVerificationLead = lead;
      }
      continue;
    }
    if (compiled.status === "needs_verification_inputs") {
      if (!evidenceReason) {
        evidenceReason = compiled.reason ?? "At least one provider lead compiled but lacked two evidence-backed verification inputs";
        evidenceLead = lead;
      }
      continue;
    }
    if (compiled.status !== "candidate_ready" || !compiled.candidate) {
      lastRejection = compiled.reason ?? "Candidate compilation was unsupported";
      continue;
    }

    if (remainingMs() <= 100) {
      lastRejection = "Acquisition cycle deadline exhausted before live replay";
      trace.push({ stage: "verify_promote", status: "deadline_exhausted", provider: lead.provider, candidate_id: compiled.candidate.candidate_id, detail: lastRejection });
      break;
    }
    try {
      const replayCount = Math.max(1, compiled.candidate.verification_inputs.length);
      const replayTimeoutMs = Math.max(100, Math.floor(remainingMs() / replayCount));
      const acquisition = await acquireFn(compiled.candidate, { timeoutMs: replayTimeoutMs });
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
      const detail = errorMessage(error);
      trace.push({ stage: "verify_promote", status: "error", provider: lead.provider, candidate_id: compiled.candidate.candidate_id, detail });
      lastRejection = detail;
    }
  }

  if (safeVerificationReason) {
    const block = recordBackoff(safeVerificationReason, safeVerificationLead?.provider ?? null);
    return {
      status: "needs_safe_verification",
      opportunity,
      selected_provider: safeVerificationLead?.provider ?? null,
      recipe_fingerprint: null,
      trace,
      reason: `${safeVerificationReason} Retry after ${block.retry_after}.`,
    };
  }
  if (evidenceReason) {
    const block = recordBackoff(evidenceReason, evidenceLead?.provider ?? null);
    return {
      status: "needs_evidence",
      opportunity,
      selected_provider: null,
      recipe_fingerprint: null,
      trace,
      reason: `${evidenceReason} Retry after ${block.retry_after}.`,
    };
  }
  if (providerSetupReason) {
    const readiness = providerSetupResult?.provider_readiness;
    const block = recordBackoff(providerSetupReason, providerSetupLead?.provider ?? null, {
      credentials_required: readiness?.credentials_required ?? [],
      response_schema_missing: readiness?.response_schema_missing ?? false,
    });
    return { status: "needs_provider_setup", opportunity, selected_provider: null, recipe_fingerprint: null, trace, reason: `${providerSetupReason} Retry after ${block.retry_after}.` };
  }

  const rejectedReason = lastRejection ?? "All discovered provider candidates were rejected";
  const block = recordBackoff(rejectedReason);
  return { status: "rejected", opportunity, selected_provider: null, recipe_fingerprint: null, trace, reason: `${rejectedReason} Retry after ${block.retry_after}.` };
}
