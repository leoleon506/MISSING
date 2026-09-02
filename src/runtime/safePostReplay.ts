import { promoteSupplyVerification, recipeFromSupplyCandidate, validateSupplyCandidateUrl, type SupplyCandidate, type SupplyVerification, type SupplyVerificationRun } from "./acquisition.js";
import { attemptRecipe } from "./executor.js";
import type { SafePostVerificationAssessment } from "./safePostPolicy.js";
import type { GeneratedHeaderBinding, SafePostReplayEvidence } from "./types.js";

export function safePostReplayEnabled(): boolean {
  return process.env.MISSING_SAFE_POST_REPLAY_ENABLED === "1";
}

function inputBindingPresent(candidate: SupplyCandidate, inputName: string): boolean {
  const ref = `$input.${inputName}`;
  return Object.values(candidate.path_bindings).includes(ref)
    || Object.values(candidate.query_bindings).includes(ref)
    || Object.values(candidate.body_bindings ?? {}).includes(ref);
}

function sandboxMarkerPresent(baseUrl: string): boolean {
  const url = new URL(baseUrl);
  const tokens = `${url.hostname} ${url.pathname}`.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  return tokens.some(token => token === "sandbox" || token === "test" || token === "testing");
}

function generatedHeaders(assessment: SafePostVerificationAssessment): GeneratedHeaderBinding[] {
  const result: GeneratedHeaderBinding[] = [];
  const seen = new Set<string>();
  for (const rawName of assessment.generated_headers) {
    const name = rawName.trim();
    const normalized = name.toLowerCase().replace(/[^a-z0-9]+/g, "");
    if (normalized !== "idempotencykey" && normalized !== "xidempotencykey") {
      throw new Error(`Safe POST replay refuses unsupported generated header: ${rawName}`);
    }
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    result.push({ location: "header", name, generator: "uuid_v4" });
  }
  return result;
}

function validateSafeReplay(candidate: SupplyCandidate, assessment: SafePostVerificationAssessment) {
  if (candidate.method !== "POST") throw new Error("Safe POST replay accepts POST candidates only");
  if (assessment.status !== "safe_for_replay") throw new Error("POST candidate has not passed Lambda.2 safe replay policy");
  if (candidate.verification_inputs.length < 2) throw new Error("Safe POST replay requires at least two verification inputs");
  if (!candidate.required.length) throw new Error("Safe POST replay requires at least one projected output");
  for (const field of candidate.required) {
    if (!candidate.projection[field]) throw new Error(`Required output is not projected: ${field}`);
  }
  validateSupplyCandidateUrl(candidate.base_url, "base_url");
  validateSupplyCandidateUrl(candidate.evidence_url, "evidence_url");

  const sufficient = assessment.signals.filter(signal => signal.sufficient);
  if (!sufficient.length) throw new Error("Safe POST replay requires explicit side-effect containment evidence");
  const enforceable = sufficient.filter(signal => signal.kind === "sandbox_server" || signal.kind === "dry_run_control" || signal.kind === "test_mode_control");
  if (!enforceable.length) {
    throw new Error("Safe POST live replay requires enforceable sandbox, dry-run, or test-mode containment; provider declaration alone is not sufficient");
  }

  for (const signal of enforceable) {
    if (signal.kind === "sandbox_server" && !sandboxMarkerPresent(candidate.base_url)) {
      throw new Error("Safe POST sandbox evidence no longer matches candidate base_url");
    }
    if (signal.input_name && typeof signal.safe_value === "boolean") {
      if (!inputBindingPresent(candidate, signal.input_name)) {
        throw new Error(`Safe POST control is not bound into the request: ${signal.input_name}`);
      }
      if (assessment.input_overrides[signal.input_name] !== signal.safe_value) {
        throw new Error(`Safe POST control override is inconsistent: ${signal.input_name}`);
      }
      for (const input of candidate.verification_inputs.slice(0, 2)) {
        if (input[signal.input_name] !== signal.safe_value) {
          throw new Error(`Safe POST replay input does not force ${signal.input_name}=${String(signal.safe_value)}`);
        }
      }
    }
  }
}

function replayEvidence(assessment: SafePostVerificationAssessment): SafePostReplayEvidence {
  return {
    policy: "lambda2",
    signals: structuredClone(assessment.signals),
    input_overrides: structuredClone(assessment.input_overrides),
    generated_headers: [...assessment.generated_headers],
  };
}

export async function verifySafePostCandidate(
  candidate: SupplyCandidate,
  assessment: SafePostVerificationAssessment,
  options: { timeoutMs?: number } = {},
): Promise<SupplyVerification> {
  validateSafeReplay(candidate, assessment);
  const verifiedAt = new Date().toISOString();
  const enrichedCandidate: SupplyCandidate = {
    ...structuredClone(candidate),
    generated_headers: generatedHeaders(assessment),
    forced_inputs: structuredClone(assessment.input_overrides),
    verification_inputs: structuredClone(candidate.verification_inputs.slice(0, 2)),
  };
  const recipe = recipeFromSupplyCandidate(enrichedCandidate, verifiedAt, replayEvidence(assessment));
  const runs: SupplyVerificationRun[] = [];

  for (const input of enrichedCandidate.verification_inputs) {
    const result = await attemptRecipe(recipe, input, options.timeoutMs);
    runs.push({ input: structuredClone(input), attempt: result.attempt, output: result.output ? structuredClone(result.output) : null });
    if (!result.output || !result.attempt.ok) {
      return {
        candidate_id: enrichedCandidate.candidate_id,
        status: "rejected",
        recipe_fingerprint: recipe.recipe_fingerprint,
        capability: enrichedCandidate.capability,
        provider: enrichedCandidate.provider,
        verified_at: verifiedAt,
        runs,
        reason: result.attempt.error ?? "Safe POST candidate did not produce the required projected output",
        recipe: null,
      };
    }
  }

  return {
    candidate_id: enrichedCandidate.candidate_id,
    status: "verified",
    recipe_fingerprint: recipe.recipe_fingerprint,
    capability: enrichedCandidate.capability,
    provider: enrichedCandidate.provider,
    verified_at: verifiedAt,
    runs,
    reason: null,
    recipe,
  };
}

export async function acquireSafePostCandidate(
  candidate: SupplyCandidate,
  assessment: SafePostVerificationAssessment,
  options: { timeoutMs?: number } = {},
) {
  if (!safePostReplayEnabled()) throw new Error("Safe POST replay is disabled");
  const verification = await verifySafePostCandidate(candidate, assessment, options);
  if (verification.status !== "verified") {
    return { status: "rejected" as const, verification, promotion: { promoted: false, reason: verification.reason, recipe: null } };
  }
  const promotion = promoteSupplyVerification(verification);
  return { status: promotion.promoted ? "promoted" as const : "already_registered" as const, verification, promotion };
}
