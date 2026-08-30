import { appendDemandEvent, readDemandEvents, truncateDemandLedger, type DemandSource } from "./demandLedger.js";
import { VERIFIED_RECIPES } from "./recipes.js";

export interface DemandObservation {
  intent: string;
  normalized_intent: string;
  capability: string | null;
  count: number;
  first_seen_at: string;
  last_seen_at: string;
  sources: Record<string, number>;
  examples: string[];
}

export interface CapabilitySearchResult {
  capability: string;
  family: string;
  providers: string[];
  recipe_count: number;
  score: number;
  matched_terms: string[];
  example_input: Record<string, unknown>;
}

const demand = new Map<string, DemandObservation>();
let hydrated = false;

const STOPWORDS = new Set([
  "a", "an", "and", "api", "can", "for", "find", "get", "i", "in", "is", "me", "my", "of", "or", "service", "the", "this", "to", "tool", "using", "with",
]);

const ALIASES: Record<string, string[]> = {
  country_alpha_metadata: ["country metadata", "country code", "iso country", "country region", "country name"],
  pokemon_name_metadata: ["pokemon", "pokemon metadata", "pokemon lookup"],
  chess_player_metadata: ["chess player", "chess username", "player title"],
  television_show_metadata: ["tv show", "television show", "series metadata", "show lookup"],
  satellite_catalog_metadata: ["satellite", "norad", "satellite catalog", "space object"],
  ip_geolocation_metadata: ["ip geolocation", "ip location", "locate ip", "ip country"],
};

export function normalizeIntent(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function demandKey(normalized: string, capability: string | null) {
  return `${capability ?? "unknown"}::${normalized}`;
}

function applyDemandEvent(event: {
  intent: string;
  normalized_intent: string;
  capability: string | null;
  observed_at: string;
  source: DemandSource;
}) {
  const key = demandKey(event.normalized_intent, event.capability);
  const existing = demand.get(key);
  if (existing) {
    existing.count += 1;
    if (event.observed_at < existing.first_seen_at) existing.first_seen_at = event.observed_at;
    if (event.observed_at > existing.last_seen_at) existing.last_seen_at = event.observed_at;
    existing.sources[event.source] = (existing.sources[event.source] ?? 0) + 1;
    if (!existing.examples.includes(event.intent) && existing.examples.length < 5) existing.examples.push(event.intent);
    return existing;
  }
  const created: DemandObservation = {
    intent: event.intent,
    normalized_intent: event.normalized_intent,
    capability: event.capability,
    count: 1,
    first_seen_at: event.observed_at,
    last_seen_at: event.observed_at,
    sources: { [event.source]: 1 },
    examples: [event.intent],
  };
  demand.set(key, created);
  return created;
}

function ensureHydrated() {
  if (hydrated) return;
  for (const event of readDemandEvents()) applyDemandEvent(event);
  hydrated = true;
}

function terms(value: string): string[] {
  return [...new Set(normalizeIntent(value).split(" ").filter(token => token.length > 1 && !STOPWORDS.has(token)))];
}

export function recordDemand(intent: string, capability: string | null = null, source: DemandSource = "unknown"): DemandObservation {
  ensureHydrated();
  const normalized = normalizeIntent(intent);
  if (!normalized) throw new Error("intent must contain searchable text");
  const now = new Date().toISOString();
  const event = {
    version: 1 as const,
    observed_at: now,
    intent,
    normalized_intent: normalized,
    capability,
    source,
  };
  appendDemandEvent(event);
  return structuredClone(applyDemandEvent(event));
}

export function demandSnapshot(): DemandObservation[] {
  ensureHydrated();
  return [...demand.values()]
    .map(item => structuredClone(item))
    .sort((a, b) => b.count - a.count || b.last_seen_at.localeCompare(a.last_seen_at));
}

export function demandSummary() {
  const rows = demandSnapshot();
  return {
    unique_intents: rows.length,
    total_observations: rows.reduce((sum, item) => sum + item.count, 0),
    top_demand: rows.slice(0, 10),
    sources: rows.reduce<Record<string, number>>((acc, item) => {
      for (const [source, count] of Object.entries(item.sources)) acc[source] = (acc[source] ?? 0) + count;
      return acc;
    }, {}),
  };
}

export function reloadDemandFromLedger() {
  demand.clear();
  hydrated = false;
  ensureHydrated();
}

export function resetDemand(options: { truncateLedger?: boolean } = {}) {
  demand.clear();
  hydrated = true;
  if (options.truncateLedger) truncateDemandLedger();
}

export function searchCapabilities(query: string, limit = 5): CapabilitySearchResult[] {
  const queryTerms = terms(query);
  if (!queryTerms.length) return [];

  const byCapability = new Map<string, typeof VERIFIED_RECIPES>();
  for (const recipe of VERIFIED_RECIPES) {
    const bucket = byCapability.get(recipe.capability) ?? [];
    bucket.push(recipe);
    byCapability.set(recipe.capability, bucket);
  }

  const ranked: CapabilitySearchResult[] = [];
  for (const [capability, recipes] of byCapability) {
    const primary = recipes[0];
    const searchable = [
      capability.replace(/_/g, " "),
      primary.family,
      ...recipes.map(recipe => recipe.provider),
      ...(ALIASES[capability] ?? []),
    ].join(" ");
    const candidateTerms = new Set(terms(searchable));
    const matched = queryTerms.filter(term => candidateTerms.has(term));
    if (!matched.length) continue;

    const coverage = matched.length / queryTerms.length;
    const redundancyBonus = Math.min(recipes.length - 1, 2) * 0.08;
    const exactCapabilityBonus = normalizeIntent(query).includes(normalizeIntent(capability.replace(/_/g, " "))) ? 0.25 : 0;
    const score = Math.min(1, coverage + redundancyBonus + exactCapabilityBonus);

    ranked.push({
      capability,
      family: primary.family,
      providers: [...new Set(recipes.map(recipe => recipe.provider))],
      recipe_count: recipes.length,
      score: Number(score.toFixed(4)),
      matched_terms: matched,
      example_input: { ...primary.example_input },
    });
  }

  return ranked
    .sort((a, b) => b.score - a.score || b.recipe_count - a.recipe_count || a.capability.localeCompare(b.capability))
    .slice(0, Math.max(1, Math.min(limit, 20)));
}
