import { createHash } from "node:crypto";
import { isIP } from "node:net";
import { demandSnapshot, type DemandObservation } from "./discovery.js";
import { attemptRecipe } from "./executor.js";
import { recipesForCapability, registerPromotedRecipe } from "./recipes.js";
import type { GeneratedHeaderBinding, HttpMethod, ProjectionRule, RuntimeAttempt, RuntimeInput, SafePostReplayEvidence, VerifiedRecipe } from "./types.js";

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
  method: HttpMethod;
  base_url: string;
  path_template: string;
  path_bindings: Record<string, string>;
  query_bindings: Record<string, string>;
  body_bindings?: Record<string, string>;
  generated_headers?: GeneratedHeaderBinding[];
  forced_inputs?: RuntimeInput;
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

export function supplyAcquisitionEnabled(): boolean {
  return process.env.MISSING_SUPPLY_ACQUISITION_ENABLED === "1";
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
    ...(candidate.body_bindings ? { body_bindings: candidate.body_bindings } : {}),
    ...(candidate.generated_headers?.length ? { generated_headers: candidate.generated_headers } : {}),
    ...(candidate.forced_inputs && Object.keys(candidate.forced_inputs).length ? { forced_inputs: candidate.forced_inputs } : {}),
    projection: candidate.projection,
    required: candidate.required,
  });
}

export function candidateFingerprint(candidate: SupplyCandidate): string {
  return createHash("sha256").update(JSON.stringify(recipeMaterial(candidate))).digest("hex");
}

function isPrivateIpv4(hostname: string): boolean {
  const octets = hostname.split(".").map(Number);
  if (octets.length !== 4 || octets.some(value => !Number.isInteger(value) || value < 0 || value > 255)) return false;
  const [a, b] = octets;
  return a === 10
    || a === 127
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 168)
    || a === 0;
}

function isPrivateIpv6(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  return normalized === "::1"
    || normalized === "::"
    || /^f[cd][0-9a-f]{2}:/.test(normalized)
    || /^fe[89ab][0-9a-f]:/.test(normalized);
}

function isInternalHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/\.$/, "");
  if (normalized === "localhost" || normalized.endsWith(".localhost") || normalized.endsWith(".local") || normalized.endsWith(".internal")) return true;
  const family = isIP(normalized);
  if (family === 4) return isPrivateIpv4(normalized);
  if (family === 6) return isPrivateIpv6(normalized);
  return false;
}

export function validateSupplyCandidateUrl(raw: string, label: string) {
  const url = new URL(raw);
  const testLoopback = process.env.NODE_ENV === "test" && (url.hostname === "127.0.0.1" || url.hostname === "localhost" || url.hostname === "::1" || url.hostname === "[::1]");
  if (!testLoopback && url.protocol !== "https:") throw new Error(`${label} must use HTTPS`);
  if (!testLoopback && isInternalHostname(url.hostname)) throw new Error(`${label} cannot target a private or internal host`);
  if (url.username || url.password) throw new Error(`${label} cannot contain URL credentials`);
  return url;
}

function validateCandidate(candidate: SupplyCandidate) {
  if (!candidate.candidate_id.trim()) throw new Error("candidate_id is required");
  if (!/^[a-z][a-z0-9_]*$/.test(candidate.capability)) throw new Error("capability must be a lowercase snake_case identifier");
  if (candidate.method !== "GET") throw new Error("Automatic Product Theta replay verification supports GET only; POST requires safe verification");
  if (candidate.verification_inputs.length < 2) throw new Error("At least two verification_inputs are required for replay verification");
  if (!candidate.required.length) throw new Error("At least one required output is required");
  for (const field of candidate.required) {
    if (!candidate.projection[field]) throw new Error(`Required output is not projected: ${field}`);
  }
  validateSupplyCandidateUrl(candidate.base_url, "base_url");
  validateSupplyCandidateUrl(candidate.evidence_url, "evidence_url");
}

export function recipeFromSupplyCandidate(candidate: SupplyCandidate, verifiedAt: string, safePost?: SafePostReplayEvidence): VerifiedRecipe {
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
    ...(candidate.body_bindings ? { body_bindings: { ...candidate.body_bindings } } : {}),
    ...(candidate.generated_headers?.length ? { generated_headers: structuredClone(candidate.generated_headers) } : {}),
    ...(candidate.forced_inputs && Object.keys(candidate.forced_inputs).length ? { forced_inputs: structuredClone(candidate.forced_inputs) } : {}),
    projection: structuredClone(candidate.projection),
    required: [...candidate.required],
    example_input: structuredClone(candidate.verification_inputs[0]),
    verification: {
      status: "replay_verified",
      source: "product_live",
      verification_inputs: structuredClone(candidate.verification_inputs),
      verified_at: verifiedAt,
      evidence_url: candidate.evidence_url,
      ...(safePost ? { safe_post: structuredClone(safePost) } : {}),
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
  const recipe = recipeFromSupplyCandidate(candidate, verifiedAt);
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
