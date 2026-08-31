import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { acquireVerifiedSupplyCandidate, rankSupplyOpportunities, supplyAcquisitionEnabled, verifySupplyCandidate } from "../runtime/acquisition.js";
import { agentRankSnapshot } from "../runtime/agentRank.js";
import { chargingSnapshot, quoteCapability, resolveCapabilityCharged } from "../runtime/charging.js";
import { demandSnapshot, demandSummary, recordDemand, searchCapabilities } from "../runtime/discovery.js";
import { economicsSnapshot } from "../runtime/economics.js";
import { resolveCapability, runtimeHealth } from "../runtime/executor.js";
import { creditAccount, prepaidCreditsSnapshot } from "../runtime/prepaidCredits.js";
import { discoverTopSupplyCandidates, providerDiscoveryEnabled } from "../runtime/providerDiscovery.js";
import { VERIFIED_RECIPES } from "../runtime/recipes.js";

const content = (value: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(value) }] });
const acquisitionDisabled = () => content({ status: "disabled", reason: "Supply verification and promotion are disabled on this public runtime. Enable only on a trusted acquisition worker with MISSING_SUPPLY_ACQUISITION_ENABLED=1." });
const discoveryDisabled = () => content({ status: "disabled", reason: "Provider discovery is disabled on this public runtime. Enable only on a trusted discovery worker with MISSING_PROVIDER_DISCOVERY_ENABLED=1." });

const projectionRuleSchema = z.union([
  z.object({ op: z.literal("INPUT"), name: z.string().min(1) }),
  z.object({ op: z.literal("FIELD"), path: z.string().min(1) }),
]);

const supplyCandidateSchema = z.object({
  candidate_id: z.string().min(2), demand_intent: z.string().min(2), capability: z.string().regex(/^[a-z][a-z0-9_]*$/), family: z.string().min(1), provider: z.string().min(1), evidence_url: z.string().url(), method: z.literal("GET"), base_url: z.string().url(), path_template: z.string().min(1), path_bindings: z.record(z.string(), z.string()), query_bindings: z.record(z.string(), z.string()), projection: z.record(z.string(), projectionRuleSchema), required: z.array(z.string().min(1)).min(1), verification_inputs: z.array(z.record(z.string(), z.unknown())).min(2),
});

export function registerProductTools(server: McpServer) {
  server.registerTool("list_verified_capabilities", { description: "List capabilities currently executable by the MISSING product runtime using replay-verified provider recipes.", inputSchema: z.object({}) }, async () => content({ capabilities: VERIFIED_RECIPES.map(recipe => ({ capability: recipe.capability, family: recipe.family, provider: recipe.provider, example_input: recipe.example_input })) }));

  server.registerTool("search_verified_capabilities", { description: "Search MISSING for an executable capability using a natural-language task description.", inputSchema: z.object({ query: z.string().min(2), limit: z.number().int().min(1).max(20).optional() }) }, async args => content({ query: args.query, matches: searchCapabilities(args.query, args.limit ?? 5) }));

  server.registerTool("record_missing_capability_demand", { description: "Record an external capability that an agent needs but MISSING cannot currently resolve.", inputSchema: z.object({ intent: z.string().min(2), capability: z.string().optional() }) }, async args => content({ recorded: recordDemand(args.intent, args.capability ?? null, "mcp") }));

  server.registerTool("missing_demand_snapshot", { description: "Return unresolved capability demand observed by MISSING.", inputSchema: z.object({}) }, async () => content({ demand: demandSnapshot(), summary: demandSummary() }));

  server.registerTool("missing_supply_opportunities", { description: "Rank unresolved agent demand as supply-acquisition opportunities.", inputSchema: z.object({ limit: z.number().int().min(1).max(50).optional() }) }, async args => content({ opportunities: rankSupplyOpportunities(args.limit ?? 10) }));

  server.registerTool("discover_supply_candidates", { description: "On a trusted discovery worker, search a structured public API directory for provider candidates.", inputSchema: z.object({ opportunity_limit: z.number().int().min(1).max(20).optional(), candidates_per_opportunity: z.number().int().min(1).max(20).optional() }) }, async args => providerDiscoveryEnabled() ? content({ results: await discoverTopSupplyCandidates({ opportunityLimit: args.opportunity_limit ?? 5, candidatesPerOpportunity: args.candidates_per_opportunity ?? 5 }) }) : discoveryDisabled());

  server.registerTool("verify_supply_candidate", { description: "On a trusted acquisition worker, live-replay a proposed GET provider recipe.", inputSchema: supplyCandidateSchema }, async args => supplyAcquisitionEnabled() ? content(await verifySupplyCandidate(args)) : acquisitionDisabled());

  server.registerTool("acquire_verified_supply_candidate", { description: "On a trusted acquisition worker, verify and promote a provider candidate only after replay gates pass.", inputSchema: supplyCandidateSchema }, async args => supplyAcquisitionEnabled() ? content(await acquireVerifiedSupplyCandidate(args)) : acquisitionDisabled());

  server.registerTool("resolve_capability", { description: "Execute a capability using replay-verified provider recipes.", inputSchema: z.object({ capability: z.string(), input: z.record(z.string(), z.unknown()) }) }, async args => content(await resolveCapability(args.capability, args.input)));

  server.registerTool("missing_agent_rank", { description: "Inspect AgentRank provider ordering.", inputSchema: z.object({ capability: z.string().optional() }) }, async args => content(agentRankSnapshot(VERIFIED_RECIPES, args.capability)));

  server.registerTool("missing_economics", { description: "Inspect Kappa provider economics and durable resolution metering.", inputSchema: z.object({ capability: z.string().optional() }) }, async args => content(economicsSnapshot(VERIFIED_RECIPES, args.capability)));

  server.registerTool("missing_charge_quote", { description: "Quote the explicit customer price for a capability before charged execution.", inputSchema: z.object({ capability: z.string().min(1) }) }, async args => content(quoteCapability(args.capability)));

  server.registerTool("resolve_capability_charged", {
    description: "Execute a capability through Kappa transactional charging. When prepaid credits are enabled, account_id is required and credits are reserved before provider execution, committed on success, and released on failure.",
    inputSchema: z.object({
      idempotency_key: z.string().min(1),
      account_id: z.string().min(1).optional(),
      capability: z.string().min(1),
      input: z.record(z.string(), z.unknown()),
    }),
  }, async args => content(await resolveCapabilityCharged({ idempotencyKey: args.idempotency_key, accountId: args.account_id, capability: args.capability, input: args.input })));

  server.registerTool("missing_charging_snapshot", { description: "Inspect Kappa transactional charging totals including committed revenue, provider cost, and gross margin.", inputSchema: z.object({}) }, async () => content(chargingSnapshot()));

  server.registerTool("missing_prepaid_credits", { description: "Inspect MISSING prepaid credit balances. Credits are internal service credits, not a general-purpose transferable wallet.", inputSchema: z.object({ account_id: z.string().min(1).optional() }) }, async args => content(prepaidCreditsSnapshot(args.account_id)));

  server.registerTool("missing_credit_account", {
    description: "Administrative test/bootstrap credit operation. Disabled unless MISSING_MANUAL_CREDIT_ENABLED=1. Production funding should come from a verified payment webhook such as Stripe.",
    inputSchema: z.object({ account_id: z.string().min(1), amount_microusd: z.number().int().positive(), external_reference: z.string().min(1) }),
  }, async args => process.env.MISSING_MANUAL_CREDIT_ENABLED === "1"
    ? content(creditAccount({ accountId: args.account_id, amountMicrousd: args.amount_microusd, externalReference: args.external_reference }))
    : content({ status: "disabled", reason: "Manual credits are disabled; use a trusted funding adapter or set MISSING_MANUAL_CREDIT_ENABLED=1 only for controlled testing." }));

  server.registerTool("missing_runtime_health", { description: "Return process-local provider recipe health and circuit-breaker state.", inputSchema: z.object({}) }, async () => content({ health: runtimeHealth(), supply_acquisition_enabled: supplyAcquisitionEnabled(), provider_discovery_enabled: providerDiscoveryEnabled() }));
}
