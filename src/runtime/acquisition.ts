import { createHash } from "node:crypto";
import { demandSnapshot, type DemandObservation } from "./discovery.js";
import { attemptRecipe } from "./executor.js";
import { recipesForCapability, registerPromotedRecipe } from "./recipes.js";
import type { ProjectionRule, RuntimeAttempt, RuntimeInput, VerifiedRecipe } from "./types.js";

export interface SupplyOpportunity {
  intent: string;
  normalized_intent: string;
  requested_capability: string | null;
  observations: number;
  source_diversity: number;
  sources: Record<string, number>;
  first_seen_at: string;
  last_seen_at: string;
  priority_score: number;
}

export interface SupplyCandidate {
  candidate_id: string;
  demand_intent: string;
  capability: string;
  family: string;
  provider: string;
  evidence_url: string;
  method: "GET";
  base_url: string;
  path_template: string;
  path_bindings: Record<string, string>;
  query_bindings: Record<string, string>;
  projection: Record<string, ProjectionRule>;
  required: string[];
  verification_inputs: RuntimeInput[];
}

export interface SupplyVerificationRun {
  input: RuntimeInput;
  attempt: RuntimeAttempt;
  output: Record<string, unknown> | null;
}

export interface SupplyVerification {
  candidate_id: string;
  status: "verified" | "rejected";
  recipe_fingerprint: string;
  capability: string;
  provider: string;
  verified_at: string;
  runs: SupplyVerificationRun[];
  reason: string | null;
  recipe: VerifiedRecipe | null;
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => [key, canonical(item)]));
  }
  return value;
}

function recipeMaterial(candidate: SupplyCandidate) {
  return canonical({
    capability: candidate.capability,
    family: candidate.family,
    provider: candidate.provider,
    provider_candidate_id: candidate.candidate_id,
    method: candidate.method,
    base_url: candidate.base_url,
    path_template: candidate.path_template,
    path_bindings: candidate.path_bindings,
    query_bindings: candidate.query_bindings,
    projection: candidate.projection,
    required: candidate.required,
  });
}

export function candidateFingerprint(candidate: SupplyCandidate): string {
  return createHash("sha256").update(JSON.stringify(recipeMaterial(candidate))).digest("hex");
}

function validateCandidate(candidate: SupplyCandidate) {
  if (!candidate.candidate_id.trim()) throw new Error("candidate_id is required");
  if (!/^[a-z][a-z0-9_]*$/.test(candidate.capability)) throw new Error("capability must be a lowercase snake_case identifier");
  if (candidate.method !== "GET") throw new Error("Only GET candidates are supported in Product Theta");
  if (candidate.verification_inputs.length < 2) throw new Error("At least two verification_inputs are required for replay verification");
  if (!candidate.required.length) throw new Error("At least one required output is required");
  for (const field of candidate.required) {
    if (!candidate.projection[field]) throw new Error(`Required output is not projected: ${field}`);
  }
  const base = new URL(candidate.base_url);
  const local = base.hostname === "127.0.0.1" || base.hostname === "localhost" || base.hostname === "::1";
  if (base.protocol !== "https:" && !local) throw new Error("Supply candidates must use HTTPS except for local verification fixtures");
  const evidence = new URL(candidate.evidence_url);
  if (evidence.protocol !== "https:" && !local) throw new Error("evidence_url must use HTTPS except for local verification fixtures");
}

function toVerificationRecipe(candidate: SupplyCandidate, verifiedAt: string): VerifiedRecipe {
  return {
    capability: candidate.capability,
    family: candidate.family,
    provider: candidate.provider,
    provider_candidate_id: candidate.candidate_id,
    recipe_fingerprint: candidateFingerprint(candidate),
    method: candidate.method,
    base_url: candidate.base_url,
    path_template: candidate.path_template,
    path_bindings: { ...candidate.path_bindings },
    query_bindings: { ...candidate.query_bindings },
    projection: structuredClone(candidate.projection),
    required: [...candidate.required],
    example_input: structuredClone(candidate.verification_inputs[0]),
    verification: {
      status: "replay_verified",
      source: "product_live",
      verification_inputs: structuredClone(candidate.verification_inputs),
      verified_at: verifiedAt,
      evidence_url: candidate.evidence_url,
    },
  };
}

function unresolved(row: DemandObservation) {
  return !row.capability || recipesForCapability(row.capability).length === 0;
}

export function rankSupplyOpportunities(limit = 10): SupplyOpportunity[] {
  const rows = demandSnapshot().filter(unresolved);
  return rows.map(row => {
    const sourceDiversity = Object.keys(row.sources).length;
    const ageHours = Math.max(0, (Date.now() - Date.parse(row.last_seen_at)) / 3_600_000);
    const recency = 1 / (1 + ageHours / 24);
    const priority = Math.log2(row.count + 1) * 0.65 + Math.min(sourceDiversity, 4) * 0.2 + recency * 0.15;
    return {
      intent: row.intent,
      normalized_intent: row.normalized_intent,
      requested_capability: row.capability,
      observations: row.count,
      source_diversity: sourceDiversity,
      sources: { ...row.sources },
      first_seen_at: row.first_seen_at,
      last_seen_at: row.last_seen_at,
      priority_score: Number(priority.toFixed(4)),
    };
  }).sort((a, b) => b.priority_score - a.priority_score || b.observations - a.observations || a.normalized_intent.localeCompare(b.normalized_intent))
    .slice(0, Math.max(1, Math.min(limit, 50)));
}

export async function verifySupplyCandidate(candidate: SupplyCandidate, options: { timeoutMs?: number } = {}): Promise<SupplyVerification> {
  validateCandidate(candidate);
  const verifiedAt = new Date().toISOString();
  const recipe = toVerificationRecipe(candidate, verifiedAt);
  const runs: SupplyVerificationRun[] = [];

  for (const input of candidate.verification_inputs) {
    const result = await attemptRecipe(recipe, input, options.timeoutMs);
    runs.push({ input: structuredClone(input), attempt: result.attempt, output: result.output ? structuredClone(result.output) : null });
    if (!result.output || !result.attempt.ok) {
      return {
        candidate_id: candidate.candidate_id,
        status: "rejected",
        recipe_fingerprint: recipe.recipe_fingerprint,
        capability: candidate.capability,
        provider: candidate.provider,
        verified_at: verifiedAt,
        runs,
        reason: result.attempt.error ?? "Candidate did not produce the required projected output",
        recipe: null,
      };
    }
  }

  return {
    candidate_id: candidate.candidate_id,
    status: "verified",
    recipe_fingerprint: recipe.recipe_fingerprint,
    capability: candidate.capability,
    provider: candidate.provider,
    verified_at: verifiedAt,
    runs,
    reason: null,
    recipe,
  };
}

export function promoteSupplyVerification(verification: SupplyVerification) {
  if (verification.status !== "verified" || !verification.recipe) {
    return { promoted: false, reason: "Only a successful live replay verification can be promoted", recipe: null };
  }
  const registered = registerPromotedRecipe(verification.recipe);
  return {
    promoted: registered.added,
    reason: registered.added ? null : "Recipe fingerprint is already registered",
    recipe: registered.recipe,
  };
}

export async function acquireVerifiedSupplyCandidate(candidate: SupplyCandidate, options: { timeoutMs?: number } = {}) {
  const verification = await verifySupplyCandidate(candidate, options);
  if (verification.status !== "verified") {
    return { status: "rejected" as const, verification, promotion: { promoted: false, reason: verification.reason, recipe: null } };
  }
  const promotion = promoteSupplyVerification(verification);
  return { status: promotion.promoted ? "promoted" as const : "already_registered" as const, verification, promotion };
}
