import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { demandLedgerPath } from "./demandLedger.js";
import type { RuntimeAttempt, VerifiedRecipe } from "./types.js";

export interface AgentRankEvent {
  version: 1;
  observed_at: string;
  capability: string;
  recipe_fingerprint: string;
  provider: string;
  ok: boolean;
  latency_ms: number;
  http_status: number | null;
  error: string | null;
  attempt_position: number;
  rescue: boolean;
}

export interface AgentRankEvidence {
  observations: number;
  successes: number;
  failures: number;
  raw_success_rate: number | null;
  smoothed_reliability: number;
  average_success_latency_ms: number | null;
  p95_success_latency_ms: number | null;
  rescue_successes: number;
  last_observed_at: string | null;
  last_success_at: string | null;
}

export interface AgentRankComponents {
  reliability: number;
  latency: number;
  verification: number;
  rescue: number;
}

export interface AgentRankEntry {
  capability: string;
  rank: number;
  provider: string;
  recipe_fingerprint: string;
  score: number;
  routing_evidence: "observed" | "cold_start";
  evidence: AgentRankEvidence;
  components: AgentRankComponents;
}

type InternalStats = {
  observations: number;
  successes: number;
  failures: number;
  success_latency_sum: number;
  recent_success_latencies: number[];
  rescue_successes: number;
  last_observed_at: string | null;
  last_success_at: string | null;
};

const MAX_RECENT_LATENCIES = 100;
const DEFAULT_MIN_OBSERVATIONS = 2;
const statsByFingerprint = new Map<string, InternalStats>();
let overridePath: string | null | undefined;
let loadedPath: string | null | undefined;

export function agentRankEnabled(): boolean {
  return process.env.MISSING_AGENTRANK_ENABLED !== "0";
}

export function agentRankMinObservations(): number {
  const parsed = Number(process.env.MISSING_AGENTRANK_MIN_OBSERVATIONS ?? DEFAULT_MIN_OBSERVATIONS);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 1000 ? parsed : DEFAULT_MIN_OBSERVATIONS;
}

export function agentRankLedgerPath(): string | null {
  if (overridePath !== undefined) return overridePath;
  if (process.env.MISSING_AGENTRANK_LEDGER) return resolve(process.env.MISSING_AGENTRANK_LEDGER);
  const demandPath = demandLedgerPath();
  if (demandPath) return join(dirname(demandPath), "agentrank.jsonl");
  if (process.env.NODE_ENV === "test") return null;
  return resolve(".missing/agentrank.jsonl");
}

export function configureAgentRankLedger(path: string | null | undefined) {
  overridePath = path === undefined ? undefined : path === null ? null : resolve(path);
  loadedPath = undefined;
  statsByFingerprint.clear();
}

function emptyStats(): InternalStats {
  return {
    observations: 0,
    successes: 0,
    failures: 0,
    success_latency_sum: 0,
    recent_success_latencies: [],
    rescue_successes: 0,
    last_observed_at: null,
    last_success_at: null,
  };
}

function acceptEvent(event: AgentRankEvent) {
  const stats = statsByFingerprint.get(event.recipe_fingerprint) ?? emptyStats();
  stats.observations += 1;
  stats.last_observed_at = event.observed_at;
  if (event.ok) {
    stats.successes += 1;
    stats.success_latency_sum += Math.max(0, event.latency_ms);
    stats.recent_success_latencies.push(Math.max(0, event.latency_ms));
    if (stats.recent_success_latencies.length > MAX_RECENT_LATENCIES) stats.recent_success_latencies.shift();
    stats.last_success_at = event.observed_at;
    if (event.rescue) stats.rescue_successes += 1;
  } else {
    stats.failures += 1;
  }
  statsByFingerprint.set(event.recipe_fingerprint, stats);
}

function validEvent(value: unknown): value is AgentRankEvent {
  if (!value || typeof value !== "object") return false;
  const event = value as Partial<AgentRankEvent>;
  return event.version === 1
    && typeof event.observed_at === "string"
    && typeof event.capability === "string"
    && typeof event.recipe_fingerprint === "string"
    && typeof event.provider === "string"
    && typeof event.ok === "boolean"
    && typeof event.latency_ms === "number"
    && Number.isFinite(event.latency_ms)
    && (typeof event.http_status === "number" || event.http_status === null)
    && (typeof event.error === "string" || event.error === null)
    && typeof event.attempt_position === "number"
    && Number.isInteger(event.attempt_position)
    && event.attempt_position >= 0
    && typeof event.rescue === "boolean";
}

function ensureLoaded() {
  const path = agentRankLedgerPath();
  if (loadedPath === path) return;
  statsByFingerprint.clear();
  loadedPath = path;
  if (!path || !existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/).filter(Boolean)) {
    try {
      const event = JSON.parse(line) as unknown;
      if (validEvent(event)) acceptEvent(event);
    } catch {
      // Malformed historical telemetry must never make capability execution unavailable.
    }
  }
}

export function reloadAgentRankFromLedger() {
  loadedPath = undefined;
  ensureLoaded();
}

export function recordAgentRankAttempt(args: {
  capability: string;
  attempt: RuntimeAttempt;
  attemptPosition: number;
  rescue?: boolean;
  observedAt?: string;
}): AgentRankEvent {
  ensureLoaded();
  const event: AgentRankEvent = {
    version: 1,
    observed_at: args.observedAt ?? new Date().toISOString(),
    capability: args.capability,
    recipe_fingerprint: args.attempt.recipe_fingerprint,
    provider: args.attempt.provider,
    ok: args.attempt.ok,
    latency_ms: Math.max(0, args.attempt.latency_ms),
    http_status: args.attempt.http_status,
    error: args.attempt.error,
    attempt_position: Math.max(0, Math.trunc(args.attemptPosition)),
    rescue: Boolean(args.rescue && args.attempt.ok),
  };
  acceptEvent(event);

  const path = agentRankLedgerPath();
  if (path) {
    try {
      mkdirSync(dirname(path), { recursive: true });
      appendFileSync(path, `${JSON.stringify(event)}\n`, "utf8");
    } catch {
      // Ranking telemetry is advisory. A persistence failure must not fail a user request.
    }
  }
  return event;
}

function percentile95(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1)] ?? null;
}

function evidenceFor(recipe: VerifiedRecipe): AgentRankEvidence {
  ensureLoaded();
  const stats = statsByFingerprint.get(recipe.recipe_fingerprint) ?? emptyStats();
  const rawRate = stats.observations ? stats.successes / stats.observations : null;
  // Beta(2,1) prior: optimistic enough not to bury cold verified supply, but a live failure is meaningful.
  const smoothed = (stats.successes + 2) / (stats.observations + 3);
  return {
    observations: stats.observations,
    successes: stats.successes,
    failures: stats.failures,
    raw_success_rate: rawRate === null ? null : Number(rawRate.toFixed(4)),
    smoothed_reliability: Number(smoothed.toFixed(4)),
    average_success_latency_ms: stats.successes ? Number((stats.success_latency_sum / stats.successes).toFixed(1)) : null,
    p95_success_latency_ms: percentile95(stats.recent_success_latencies),
    rescue_successes: stats.rescue_successes,
    last_observed_at: stats.last_observed_at,
    last_success_at: stats.last_success_at,
  };
}

function verificationScore(recipe: VerifiedRecipe): number {
  if (recipe.verification.source === "experiment") return 0.8;
  const parsed = Date.parse(recipe.verification.verified_at);
  if (!Number.isFinite(parsed)) return 0.75;
  const ageDays = Math.max(0, (Date.now() - parsed) / 86_400_000);
  return Math.max(0.5, 1 / (1 + ageDays / 180));
}

function scoreRecipe(recipe: VerifiedRecipe): Omit<AgentRankEntry, "rank"> {
  const evidence = evidenceFor(recipe);
  const reliability = evidence.smoothed_reliability;
  const latency = evidence.average_success_latency_ms === null
    ? (evidence.observations ? 0.25 : 0.5)
    : 1 / (1 + evidence.average_success_latency_ms / 1000);
  const verification = verificationScore(recipe);
  const rescue = evidence.successes ? Math.min(1, 0.5 + (evidence.rescue_successes / evidence.successes) * 0.5) : 0.5;
  const score = reliability * 0.55 + latency * 0.25 + verification * 0.15 + rescue * 0.05;
  return {
    capability: recipe.capability,
    provider: recipe.provider,
    recipe_fingerprint: recipe.recipe_fingerprint,
    score: Number(score.toFixed(4)),
    routing_evidence: evidence.observations ? "observed" : "cold_start",
    evidence,
    components: {
      reliability: Number(reliability.toFixed(4)),
      latency: Number(latency.toFixed(4)),
      verification: Number(verification.toFixed(4)),
      rescue: Number(rescue.toFixed(4)),
    },
  };
}

function evidenceMature(entries: Array<{ entry: Omit<AgentRankEntry, "rank"> }>): boolean {
  const minimum = agentRankMinObservations();
  return entries.every(item => item.entry.evidence.observations >= minimum);
}

export function rankRecipesForExecution(recipes: VerifiedRecipe[]): VerifiedRecipe[] {
  if (!agentRankEnabled() || recipes.length < 2) return [...recipes];
  const scored = recipes.map((recipe, index) => ({ recipe, index, entry: scoreRecipe(recipe) }));
  // Do not let one noisy request overturn the established provider order. Every
  // candidate must have enough comparable runtime evidence before reranking.
  if (!evidenceMature(scored)) return [...recipes];
  return scored
    .sort((a, b) => b.entry.score - a.entry.score || a.index - b.index)
    .map(item => item.recipe);
}

export function agentRankSnapshot(recipes: VerifiedRecipe[], capability?: string): { enabled: boolean; minimum_observations: number; capabilities: Array<{ capability: string; routing_mode: "agentrank" | "registry_order"; rankings: AgentRankEntry[] }> } {
  const selected = capability ? recipes.filter(recipe => recipe.capability === capability) : recipes;
  const groups = new Map<string, VerifiedRecipe[]>();
  for (const recipe of selected) groups.set(recipe.capability, [...(groups.get(recipe.capability) ?? []), recipe]);

  const capabilities = [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([name, items]) => {
    const scored = items.map((recipe, index) => ({ index, entry: scoreRecipe(recipe) }));
    const mature = evidenceMature(scored);
    const routingMode = agentRankEnabled() && mature && items.length > 1 ? "agentrank" as const : "registry_order" as const;
    const ordered = routingMode === "agentrank"
      ? scored.sort((a, b) => b.entry.score - a.entry.score || a.index - b.index)
      : scored;
    return {
      capability: name,
      routing_mode: routingMode,
      rankings: ordered.map((item, index) => ({ ...item.entry, rank: index + 1 })),
    };
  });

  return { enabled: agentRankEnabled(), minimum_observations: agentRankMinObservations(), capabilities };
}

export function truncateAgentRankLedger() {
  const path = agentRankLedgerPath();
  statsByFingerprint.clear();
  loadedPath = path;
  if (!path) return;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, "", "utf8");
}

export function resetAgentRankForTest(options: { truncateLedger?: boolean } = {}) {
  if (options.truncateLedger) truncateAgentRankLedger();
  else {
    statsByFingerprint.clear();
    loadedPath = undefined;
  }
}
