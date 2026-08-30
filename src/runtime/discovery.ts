import { VERIFIED_RECIPES } from "./recipes.js";

export interface DemandObservation {
  intent: string;
  normalized_intent: string;
  capability: string | null;
  count: number;
  first_seen_at: string;
  last_seen_at: string;
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

function terms(value: string): string[] {
  return [...new Set(normalizeIntent(value).split(" ").filter(token => token.length > 1 && !STOPWORDS.has(token)))];
}

export function recordDemand(intent: string, capability: string | null = null): DemandObservation {
  const normalized = normalizeIntent(intent);
  if (!normalized) throw new Error("intent must contain searchable text");
  const key = `${capability ?? "unknown"}::${normalized}`;
  const now = new Date().toISOString();
  const existing = demand.get(key);
  if (existing) {
    existing.count += 1;
    existing.last_seen_at = now;
    return { ...existing };
  }
  const created: DemandObservation = {
    intent,
    normalized_intent: normalized,
    capability,
    count: 1,
    first_seen_at: now,
    last_seen_at: now,
  };
  demand.set(key, created);
  return { ...created };
}

export function demandSnapshot(): DemandObservation[] {
  return [...demand.values()]
    .map(item => ({ ...item }))
    .sort((a, b) => b.count - a.count || b.last_seen_at.localeCompare(a.last_seen_at));
}

export function resetDemand() {
  demand.clear();
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
