import { rankRecipesForExecution, recordAgentRankAttempt, selectAgentRankExplorationRecipe } from "./agentRank.js";
import { recipesForCapability } from "./recipes.js";
import type { ResolveResult, RuntimeAttempt, RuntimeHealth, RuntimeInput, VerifiedRecipe } from "./types.js";

const DEFAULT_TIMEOUT_MS = 8000;
const FAILURE_THRESHOLD = 2;
const OPEN_MS = 60_000;

const health = new Map<string, RuntimeHealth>();
const explorationInFlight = new Set<string>();

function stateFor(recipe: VerifiedRecipe): RuntimeHealth {
  const existing = health.get(recipe.recipe_fingerprint);
  if (existing) {
    if (existing.state === "open" && existing.open_until && Date.parse(existing.open_until) <= Date.now()) {
      existing.state = "closed";
      existing.failures = 0;
      existing.open_until = null;
    }
    return existing;
  }
  const created: RuntimeHealth = {
    recipe_fingerprint: recipe.recipe_fingerprint,
    provider: recipe.provider,
    failures: 0,
    state: "closed",
    open_until: null,
    last_success_at: null,
    last_failure_at: null,
  };
  health.set(recipe.recipe_fingerprint, created);
  return created;
}

function bindingValue(ref: string, input: RuntimeInput): unknown {
  const match = /^\$input\.([A-Za-z0-9_]+)$/.exec(ref);
  if (!match) throw new Error(`Unsupported binding reference: ${ref}`);
  const value = input[match[1]];
  if (value === undefined || value === null || value === "") throw new Error(`Missing required input: ${match[1]}`);
  return value;
}

export function renderRecipeUrl(recipe: VerifiedRecipe, input: RuntimeInput): string {
  let path = recipe.path_template;
  for (const [slot, ref] of Object.entries(recipe.path_bindings)) {
    path = path.replace(`{${slot}}`, encodeURIComponent(String(bindingValue(ref, input))));
  }
  const url = new URL(path, recipe.base_url);
  for (const [key, ref] of Object.entries(recipe.query_bindings)) {
    url.searchParams.set(key, String(bindingValue(ref, input)));
  }
  return url.toString();
}

function readPath(value: unknown, path: string): unknown {
  let cursor: any = value;
  for (const part of path.split(".")) {
    if (cursor === null || cursor === undefined) return undefined;
    const key: string | number = /^\d+$/.test(part) ? Number(part) : part;
    cursor = cursor[key as any];
  }
  return cursor;
}

export function projectRecipeOutput(recipe: VerifiedRecipe, input: RuntimeInput, payload: unknown): Record<string, unknown> {
  const output: Record<string, unknown> = {};
  for (const [key, rule] of Object.entries(recipe.projection)) {
    output[key] = rule.op === "INPUT" ? input[rule.name] : readPath(payload, rule.path);
  }
  const missing = recipe.required.filter(key => output[key] === undefined || output[key] === null || output[key] === "");
  if (missing.length) throw new Error(`Projection missing required outputs: ${missing.join(",")}`);
  return output;
}

/**
 * Execute exactly one recipe without touching circuit-breaker or AgentRank state.
 * Product Theta uses this primitive to verify supply candidates before they
 * are eligible for registration in the executable recipe registry.
 */
export async function attemptRecipe(recipe: VerifiedRecipe, input: RuntimeInput, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<{ attempt: RuntimeAttempt; output?: Record<string, unknown> }> {
  const started = Date.now();
  let url: string | null = null;
  try {
    url = renderRecipeUrl(recipe, input);
    const response = await fetch(url, { method: recipe.method, signal: AbortSignal.timeout(timeoutMs), headers: { accept: "application/json" } });
    const latency_ms = Date.now() - started;
    if (!response.ok) return { attempt: { provider: recipe.provider, recipe_fingerprint: recipe.recipe_fingerprint, url, ok: false, http_status: response.status, latency_ms, error: `HTTP ${response.status}` } };
    const text = await response.text();
    if (!text.trim()) return { attempt: { provider: recipe.provider, recipe_fingerprint: recipe.recipe_fingerprint, url, ok: false, http_status: response.status, latency_ms, error: "Empty response body" } };
    const payload = JSON.parse(text);
    const output = projectRecipeOutput(recipe, input, payload);
    return { attempt: { provider: recipe.provider, recipe_fingerprint: recipe.recipe_fingerprint, url, ok: true, http_status: response.status, latency_ms, error: null }, output };
  } catch (error) {
    return { attempt: { provider: recipe.provider, recipe_fingerprint: recipe.recipe_fingerprint, url, ok: false, http_status: null, latency_ms: Date.now() - started, error: error instanceof Error ? error.message : String(error) } };
  }
}

function markSuccess(recipe: VerifiedRecipe) {
  const s = stateFor(recipe);
  s.failures = 0;
  s.state = "closed";
  s.open_until = null;
  s.last_success_at = new Date().toISOString();
}

function markFailure(recipe: VerifiedRecipe) {
  const s = stateFor(recipe);
  s.failures += 1;
  s.last_failure_at = new Date().toISOString();
  if (s.failures >= FAILURE_THRESHOLD) {
    s.state = "open";
    s.open_until = new Date(Date.now() + OPEN_MS).toISOString();
  }
}

function scheduleAgentRankExploration(capability: string, registered: VerifiedRecipe[], selectedRecipe: VerifiedRecipe, timeoutMs: number) {
  const explorationRecipe = selectAgentRankExplorationRecipe(registered, selectedRecipe.recipe_fingerprint);
  if (!explorationRecipe || explorationInFlight.has(explorationRecipe.recipe_fingerprint)) return;
  explorationInFlight.add(explorationRecipe.recipe_fingerprint);

  // Privacy boundary: shadow probes use only the recipe's already-verified example input.
  // User inputs and outputs are never copied to an alternate provider for exploration.
  void attemptRecipe(explorationRecipe, explorationRecipe.example_input, timeoutMs)
    .then(result => {
      recordAgentRankAttempt({
        capability,
        attempt: result.attempt,
        attemptPosition: 0,
        rescue: false,
        source: "exploration",
      });
    })
    .catch(() => {
      // attemptRecipe normally converts exceptions into RuntimeAttempt; this is an
      // extra guard so advisory exploration can never affect a user resolution.
    })
    .finally(() => explorationInFlight.delete(explorationRecipe.recipe_fingerprint));
}

export async function resolveCapability(capability: string, input: RuntimeInput, options: { timeoutMs?: number } = {}): Promise<ResolveResult> {
  const registered = recipesForCapability(capability);
  if (!registered.length) return { status: "unavailable", capability, reason: "No replay-verified recipe is registered for this capability", attempts: [] };

  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const recipes = rankRecipesForExecution(registered);
  const attempts: RuntimeAttempt[] = [];
  for (const recipe of recipes) {
    if (stateFor(recipe).state === "open") continue;
    const result = await attemptRecipe(recipe, input, timeoutMs);
    const attemptPosition = attempts.length;
    attempts.push(result.attempt);
    recordAgentRankAttempt({ capability, attempt: result.attempt, attemptPosition, rescue: attemptPosition > 0 && Boolean(result.output) });
    if (result.output) {
      markSuccess(recipe);
      scheduleAgentRankExploration(capability, registered, recipe, timeoutMs);
      return { status: "resolved", capability, provider: recipe.provider, recipe_fingerprint: recipe.recipe_fingerprint, output: result.output, attempts };
    }
    markFailure(recipe);
  }

  return {
    status: "provider_error",
    capability,
    reason: attempts.length ? "All available replay-verified recipes failed at runtime" : "All registered recipes are temporarily circuit-open",
    attempts,
  };
}

export function runtimeHealth(): RuntimeHealth[] {
  return [...health.values()].map(item => ({ ...item }));
}

export function resetRuntimeHealth() {
  health.clear();
  explorationInFlight.clear();
}
