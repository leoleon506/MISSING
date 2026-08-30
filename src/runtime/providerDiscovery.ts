import { rankSupplyOpportunities, type SupplyOpportunity } from "./acquisition.js";

export interface ProviderDiscoveryCandidate {
  source: "apis_guru";
  directory_id: string;
  provider: string;
  title: string;
  description: string;
  spec_url: string;
  directory_url: string | null;
  openapi_version: string | null;
  score: number;
  matched_terms: string[];
  demand_intent: string;
  normalized_intent: string;
}

export interface ProviderDiscoveryResult {
  opportunity: SupplyOpportunity;
  candidates: ProviderDiscoveryCandidate[];
}

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

interface APIsGuruVersion {
  info?: {
    title?: string;
    description?: string;
  };
  swaggerUrl?: string;
  link?: string;
  openapiVer?: string;
}

interface APIsGuruEntry {
  preferred?: string;
  versions?: Record<string, APIsGuruVersion>;
}

type APIsGuruDirectory = Record<string, APIsGuruEntry>;

const DEFAULT_DIRECTORY_URL = "https://api.apis.guru/v2/list.json";
const STOP_WORDS = new Set([
  "a", "an", "and", "api", "for", "from", "in", "is", "me", "number", "of", "on", "or", "the", "this", "to", "with",
  "validate", "validation", "verify", "check", "find", "get", "lookup", "locate",
]);

export function providerDiscoveryEnabled(): boolean {
  return process.env.MISSING_PROVIDER_DISCOVERY_ENABLED === "1";
}

export function providerDirectoryUrl(): string {
  return process.env.MISSING_PROVIDER_DIRECTORY_URL || DEFAULT_DIRECTORY_URL;
}

function tokens(text: string): string[] {
  return [...new Set(text.toLowerCase().match(/[a-z0-9]{2,}/g) ?? [])]
    .filter(token => !STOP_WORDS.has(token));
}

function tokenSet(text: string): Set<string> {
  return new Set(tokens(text));
}

function selectedVersion(entry: APIsGuruEntry): APIsGuruVersion | null {
  const versions = entry.versions ?? {};
  if (entry.preferred && versions[entry.preferred]) return versions[entry.preferred];
  const keys = Object.keys(versions).sort();
  return keys.length ? versions[keys[keys.length - 1]] ?? null : null;
}

function scoreCandidate(directoryId: string, version: APIsGuruVersion, opportunity: SupplyOpportunity) {
  const queryTerms = tokens(`${opportunity.normalized_intent} ${opportunity.requested_capability ?? ""}`);
  const title = version.info?.title ?? directoryId;
  const description = version.info?.description ?? "";
  const allTokens = tokenSet(`${directoryId} ${title} ${description}`);
  const titleTokens = tokenSet(title);
  const idTokens = tokenSet(directoryId);
  const matched = queryTerms.filter(term => allTokens.has(term));
  const coverage = queryTerms.length ? matched.length / queryTerms.length : 0;
  const titleMatches = matched.filter(term => titleTokens.has(term)).length;
  const idMatches = matched.filter(term => idTokens.has(term)).length;
  const score = coverage * 0.7 + Math.min(titleMatches, 3) * 0.08 + Math.min(idMatches, 2) * 0.03;
  return { score: Number(Math.min(1, score).toFixed(4)), matchedTerms: matched };
}

export async function discoverProviderCandidates(
  opportunity: SupplyOpportunity,
  options: { fetchFn?: FetchLike; limit?: number; directoryUrl?: string } = {},
): Promise<ProviderDiscoveryCandidate[]> {
  const fetchFn = options.fetchFn ?? fetch;
  const directoryUrl = options.directoryUrl ?? providerDirectoryUrl();
  const response = await fetchFn(directoryUrl, {
    headers: { accept: "application/json", "user-agent": "MISSING-Theta6/0.2" },
  });
  if (!response.ok) throw new Error(`Provider directory request failed with HTTP ${response.status}`);
  const payload = await response.json() as unknown;
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("Provider directory returned an invalid payload");

  const candidates: ProviderDiscoveryCandidate[] = [];
  for (const [directoryId, rawEntry] of Object.entries(payload as APIsGuruDirectory)) {
    if (!rawEntry || typeof rawEntry !== "object") continue;
    const version = selectedVersion(rawEntry);
    if (!version?.swaggerUrl) continue;
    const { score, matchedTerms } = scoreCandidate(directoryId, version, opportunity);
    if (!matchedTerms.length || score <= 0) continue;
    const title = version.info?.title?.trim() || directoryId;
    candidates.push({
      source: "apis_guru",
      directory_id: directoryId,
      provider: title,
      title,
      description: version.info?.description?.trim() || "",
      spec_url: version.swaggerUrl,
      directory_url: version.link ?? null,
      openapi_version: version.openapiVer ?? null,
      score,
      matched_terms: matchedTerms,
      demand_intent: opportunity.intent,
      normalized_intent: opportunity.normalized_intent,
    });
  }

  return candidates
    .sort((a, b) => b.score - a.score || b.matched_terms.length - a.matched_terms.length || a.directory_id.localeCompare(b.directory_id))
    .slice(0, Math.max(1, Math.min(options.limit ?? 10, 50)));
}

export async function discoverTopSupplyCandidates(
  options: { fetchFn?: FetchLike; opportunityLimit?: number; candidatesPerOpportunity?: number; directoryUrl?: string } = {},
): Promise<ProviderDiscoveryResult[]> {
  const opportunities = rankSupplyOpportunities(options.opportunityLimit ?? 5);
  const results: ProviderDiscoveryResult[] = [];
  for (const opportunity of opportunities) {
    results.push({
      opportunity,
      candidates: await discoverProviderCandidates(opportunity, {
        fetchFn: options.fetchFn,
        limit: options.candidatesPerOpportunity ?? 5,
        directoryUrl: options.directoryUrl,
      }),
    });
  }
  return results;
}
