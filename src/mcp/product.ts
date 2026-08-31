import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { acquireVerifiedSupplyCandidate, rankSupplyOpportunities, supplyAcquisitionEnabled, verifySupplyCandidate } from "../runtime/acquisition.js";
import { agentRankSnapshot } from "../runtime/agentRank.js";
import { demandSnapshot, demandSummary, recordDemand, searchCapabilities } from "../runtime/discovery.js";
import { economicsSnapshot } from "../runtime/economics.js";
import { resolveCapability, runtimeHealth } from "../runtime/executor.js";
import { discoverTopSupplyCandidates, providerDiscoveryEnabled } from "../runtime/providerDiscovery.js";
import { VERIFIED_RECIPES } from "../runtime/recipes.js";

const content = (value: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(value) }] });
const acquisitionDisabled = () => content({
  status: "disabled",
  reason: "Supply verification and promotion are disabled on this public runtime. Enable only on a trusted acquisition worker with MISSING_SUPPLY_ACQUISITION_ENABLED=1.",
});
const discoveryDisabled = () => content({
  status: "disabled",
  reason: "Provider discovery is disabled on this public runtime. Enable only on a trusted discovery worker with MISSING_PROVIDER_DISCOVERY_ENABLED=1.",
});

const projectionRuleSchema = z.union([
  z.object({ op: z.literal("INPUT"), name: z.string().min(1) }),
  z.object({ op: z.literal("FIELD"), path: z.string().min(1) }),
]);

const supplyCandidateSchema = z.object({
  candidate_id: z.string().min(2).describe("Stable identifier for the provider candidate"),
  demand_intent: z.string().min(2).describe("Observed agent demand this candidate is intended to satisfy"),
  capability: z.string().regex(/^[a-z][a-z0-9_]*$/).describe("Proposed lowercase snake_case capability identifier"),
  family: z.string().min(1),
  provider: z.string().min(1),
  evidence_url: z.string().url().describe("Public documentation/evidence URL supporting the candidate mapping"),
  method: z.literal("GET"),
  base_url: z.string().url(),
  path_template: z.string().min(1),
  path_bindings: z.record(z.string(), z.string()),
  query_bindings: z.record(z.string(), z.string()),
  projection: z.record(z.string(), projectionRuleSchema),
  required: z.array(z.string().min(1)).min(1),
  verification_inputs: z.array(z.record(z.string(), z.unknown())).min(2).describe("At least two independent inputs that must both replay successfully before promotion"),
});

export function registerProductTools(server: McpServer) {
  server.registerTool("list_verified_capabilities", {
    description: "List capabilities currently executable by the MISSING product runtime using replay-verified provider recipes.",
    inputSchema: z.object({}),
  }, async () => content({ capabilities: VERIFIED_RECIPES.map(recipe => ({ capability: recipe.capability, family: recipe.family, provider: recipe.provider, example_input: recipe.example_input })) }));

  server.registerTool("search_verified_capabilities", {
    description: "Search MISSING for an executable capability using a natural-language task description. Use this when you know what must be done but do not know the exact capability identifier.",
    inputSchema: z.object({
      query: z.string().min(2).describe("Natural-language capability intent, for example: locate an IP address or find country metadata"),
      limit: z.number().int().min(1).max(20).optional().describe("Maximum results to return"),
    }),
  }, async args => content({ query: args.query, matches: searchCapabilities(args.query, args.limit ?? 5) }));

  server.registerTool("record_missing_capability_demand", {
    description: "Record an external capability that an agent needs but MISSING cannot currently resolve. Demand is persisted when the demand ledger is enabled; this never invents or claims an unverified integration.",
    inputSchema: z.object({
      intent: z.string().min(2).describe("Natural-language description of the missing capability"),
      capability: z.string().optional().describe("Optional proposed capability identifier when already known"),
    }),
  }, async args => content({ recorded: recordDemand(args.intent, args.capability ?? null, "mcp") }));

  server.registerTool("missing_demand_snapshot", {
    description: "Return unresolved capability demand observed by MISSING, ordered by repeated demand and reconstructed from the durable demand ledger when configured.",
    inputSchema: z.object({}),
  }, async () => content({ demand: demandSnapshot(), summary: demandSummary() }));

  server.registerTool("missing_supply_opportunities", {
    description: "Rank unresolved agent demand as supply-acquisition opportunities. This reports demand only; it never claims that an unverified provider exists.",
    inputSchema: z.object({
      limit: z.number().int().min(1).max(50).optional(),
    }),
  }, async args => content({ opportunities: rankSupplyOpportunities(args.limit ?? 10) }));

  server.registerTool("discover_supply_candidates", {
    description: "On a trusted discovery worker, search a structured public API directory for provider candidates matching the highest-priority unresolved demand. Results are unverified leads only and cannot execute or promote themselves.",
    inputSchema: z.object({
      opportunity_limit: z.number().int().min(1).max(20).optional(),
      candidates_per_opportunity: z.number().int().min(1).max(20).optional(),
    }),
  }, async args => providerDiscoveryEnabled()
    ? content({ results: await discoverTopSupplyCandidates({ opportunityLimit: args.opportunity_limit ?? 5, candidatesPerOpportunity: args.candidates_per_opportunity ?? 5 }) })
    : discoveryDisabled());

  server.registerTool("verify_supply_candidate", {
    description: "On a trusted acquisition worker, live-replay a proposed GET provider recipe against at least two verification inputs. Public runtimes keep this disabled by default.",
    inputSchema: supplyCandidateSchema,
  }, async args => supplyAcquisitionEnabled() ? content(await verifySupplyCandidate(args)) : acquisitionDisabled());

  server.registerTool("acquire_verified_supply_candidate", {
    description: "On a trusted acquisition worker, verify a provider candidate and promote it only after every replay gate passes. Public runtimes keep this disabled by default.",
    inputSchema: supplyCandidateSchema,
  }, async args => supplyAcquisitionEnabled() ? content(await acquireVerifiedSupplyCandidate(args)) : acquisitionDisabled());

  server.registerTool("resolve_capability", {
    description: "Execute a capability using replay-verified provider recipes. AgentRank orders by observed quality; when Kappa enforcement is enabled, explicit economics policy is then applied before failover.",
    inputSchema: z.object({
      capability: z.string().describe("Capability identifier returned by list_verified_capabilities or search_verified_capabilities"),
      input: z.record(z.string(), z.unknown()).describe("Capability-specific input object"),
    }),
  }, async args => content(await resolveCapability(args.capability, args.input)));

  server.registerTool("missing_agent_rank", {
    description: "Inspect AgentRank provider ordering derived from observed runtime reliability, latency, verification strength, and rescue history. Economic policy is exposed separately by missing_economics.",
    inputSchema: z.object({
      capability: z.string().optional().describe("Optional exact capability identifier; omit to inspect all verified capabilities"),
    }),
  }, async args => content(agentRankSnapshot(VERIFIED_RECIPES, args.capability)));

  server.registerTool("missing_economics", {
    description: "Inspect Kappa provider economics and durable resolution metering. Unknown economics are never treated as zero cost. Money is reported in integer micro-USD (1 USD = 1,000,000 micro-USD).",
    inputSchema: z.object({
      capability: z.string().optional().describe("Optional exact capability identifier; omit to inspect all verified recipes"),
    }),
  }, async args => content(economicsSnapshot(VERIFIED_RECIPES, args.capability)));

  server.registerTool("missing_runtime_health", {
    description: "Return process-local provider recipe health and circuit-breaker state for the MISSING runtime.",
    inputSchema: z.object({}),
  }, async () => content({
    health: runtimeHealth(),
    supply_acquisition_enabled: supplyAcquisitionEnabled(),
    provider_discovery_enabled: providerDiscoveryEnabled(),
  }));
}
