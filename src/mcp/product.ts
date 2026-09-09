import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { acquireVerifiedSupplyCandidate, rankSupplyOpportunities, supplyAcquisitionEnabled, verifySupplyCandidate } from "../runtime/acquisition.js";
import { agentRankSnapshot } from "../runtime/agentRank.js";
import { demandSnapshot, demandSummary, recordDemand, searchCapabilities } from "../runtime/discovery.js";
import { economicsSnapshot } from "../runtime/economics.js";
import { runtimeHealth } from "../runtime/executor.js";
import { creditAccount, prepaidCreditsSnapshot } from "../runtime/prepaidCredits.js";
import { discoverTopSupplyCandidates, providerDiscoveryEnabled } from "../runtime/providerDiscovery.js";
import { publicPaidResolutionHandoff } from "../runtime/publicPaidHandoff.js";
import { VERIFIED_RECIPES } from "../runtime/recipes.js";
import { supplyPromotionEvidenceSnapshot } from "../runtime/supplyLedger.js";

const content = (value: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(value) }] });
const acquisitionDisabled = () => content({ status: "disabled", reason: "Supply verification and promotion are disabled on this public runtime. Enable only on a trusted acquisition worker with MISSING_SUPPLY_ACQUISITION_ENABLED=1." });
const discoveryDisabled = () => content({ status: "disabled", reason: "Provider discovery is disabled on this public runtime. Enable only on a trusted discovery worker with MISSING_PROVIDER_DISCOVERY_ENABLED=1." });

const projectionRuleSchema = z.union([
  z.object({ op: z.literal("INPUT"), name: z.string().min(1) }),
  z.object({ op: z.literal("FIELD"), path: z.string().min(1) }),
]);

const demandExampleInputSchema = z.record(
  z.string().min(1).max(64),
  z.union([z.string().min(1).max(512), z.number().finite(), z.boolean()]),
).describe("Optional non-sensitive representative input fields that may help trusted acquisition verify future supply. Use scalar values only; never include secrets, credentials, personal data, payment signatures, or private keys.");

const supplyCandidateSchema = z.object({
  candidate_id: z.string().min(2), demand_intent: z.string().min(2), capability: z.string().regex(/^[a-z][a-z0-9_]*$/), family: z.string().min(1), provider: z.string().min(1), evidence_url: z.string().url(), method: z.literal("GET"), base_url: z.string().url(), path_template: z.string().min(1), path_bindings: z.record(z.string(), z.string()), query_bindings: z.record(z.string(), z.string()), projection: z.record(z.string(), projectionRuleSchema), required: z.array(z.string().min(1)).min(1), verification_inputs: z.array(z.record(z.string(), z.unknown())).min(2),
});

/** Anonymous/public MCP surface. Discovery is free; execution is x402-only. */
export function registerPublicProductTools(server: McpServer) {
  server.registerTool("list_verified_capabilities", {
    title: "List Verified Capabilities",
    description: "List every replay-verified capability currently executable by MISSING. Use this to inspect the catalog, obtain exact capability identifiers, or copy example inputs before resolve_capability; for fuzzy natural-language intent, use search_verified_capabilities instead. This is read-only, has no payment or provider side effect, and returns capability, family, provider, and example_input metadata.",
    inputSchema: z.object({}),
    annotations: { readOnlyHint: true, openWorldHint: false },
  }, async () => content({ capabilities: VERIFIED_RECIPES.map(recipe => ({ capability: recipe.capability, family: recipe.family, provider: recipe.provider, example_input: recipe.example_input })) }));

  server.registerTool("search_verified_capabilities", {
    title: "Search Verified Capabilities",
    description: "Search the replay-verified MISSING catalog from a natural-language task description. Use this when you know the task you want performed but not the exact capability identifier; if a match is suitable, pass its capability and a valid input object to resolve_capability. This is read-only: it does not call providers, create demand, or trigger payment; limit defaults to 5 and only controls the maximum number of matches.",
    inputSchema: z.object({
      query: z.string().min(2).describe("Natural-language description of the external capability or task you need, for example 'locate this IP address'. Describe the outcome, not an implementation."),
      limit: z.number().int().min(1).max(20).optional().describe("Maximum matches to return. Optional; defaults to 5. Valid range is 1 through 20."),
    }),
    annotations: { readOnlyHint: true, openWorldHint: false },
  }, async args => content({ query: args.query, matches: searchCapabilities(args.query, args.limit ?? 5) }));

  server.registerTool("record_missing_capability_demand", {
    title: "Record Missing Capability Demand",
    description: "Record a capability need that MISSING cannot currently resolve so the trusted acquisition system can prioritize new supply. Call this only after list/search finds no suitable verified capability; it mutates the durable demand ledger and repeated calls may increase the observed demand signal. The mutation is additive and non-destructive; never put secrets, credentials, personal data, payment material, or private keys in intent or example_input.",
    inputSchema: z.object({
      intent: z.string().min(2).describe("Natural-language description of the unresolved task or desired outcome. Keep it specific enough to evaluate future providers and exclude sensitive data."),
      capability: z.string().optional().describe("Optional proposed capability identifier if you already know an appropriate stable name. Prefer lowercase snake_case; omit this field when uncertain."),
      example_input: demandExampleInputSchema.optional(),
    }),
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  }, async args => content({ recorded: recordDemand(args.intent, args.capability ?? null, "mcp", args.example_input) }));

  server.registerTool("resolve_capability", {
    title: "Resolve Verified Capability",
    description: "Prepare paid execution of one exact replay-verified capability. Use this only after you have an exact capability identifier, normally from list_verified_capabilities or search_verified_capabilities; this MCP call itself does not execute a provider or charge the caller, but returns payment_required with the canonical /v1/agent/resolve endpoint, current price, exact request body, and x402 instructions. The later HTTP x402 flow performs execution and settlement: preserve the exact request body and exact PAYMENT-SIGNATURE for recovery, and do not create a second authorization for a payment already associated with a known transaction.",
    inputSchema: z.object({
      capability: z.string().min(1).describe("Exact verified capability identifier returned by list_verified_capabilities or search_verified_capabilities."),
      input: z.record(z.string(), z.unknown()).describe("JSON input object for that capability. Start from the advertised example_input when available, and reuse this exact object in the subsequent x402 HTTP request."),
    }),
    annotations: { readOnlyHint: true, openWorldHint: false },
  }, async args => content(publicPaidResolutionHandoff(args.capability, args.input, "mcp")));
}

/** Trusted operator/control-plane MCP surface. Never mount this on anonymous HTTP. */
export function registerTrustedProductTools(server: McpServer) {
  server.registerTool("missing_demand_snapshot", { description: "Return unresolved capability demand observed by MISSING.", inputSchema: z.object({}) }, async () => content({ demand: demandSnapshot(), summary: demandSummary() }));

  server.registerTool("missing_supply_opportunities", { description: "Rank unresolved agent demand as supply-acquisition opportunities.", inputSchema: z.object({ limit: z.number().int().min(1).max(50).optional() }) }, async args => content({ opportunities: rankSupplyOpportunities(args.limit ?? 10) }));

  server.registerTool("discover_supply_candidates", { description: "On a trusted discovery worker, search a structured public API directory for provider candidates.", inputSchema: z.object({ opportunity_limit: z.number().int().min(1).max(20).optional(), candidates_per_opportunity: z.number().int().min(1).max(20).optional() }) }, async args => providerDiscoveryEnabled() ? content({ results: await discoverTopSupplyCandidates({ opportunityLimit: args.opportunity_limit ?? 5, candidatesPerOpportunity: args.candidates_per_opportunity ?? 5 }) }) : discoveryDisabled());

  server.registerTool("verify_supply_candidate", { description: "On a trusted acquisition worker, live-replay a proposed GET provider recipe.", inputSchema: supplyCandidateSchema }, async args => supplyAcquisitionEnabled() ? content(await verifySupplyCandidate(args)) : acquisitionDisabled());

  server.registerTool("acquire_verified_supply_candidate", { description: "On a trusted acquisition worker, verify and promote a provider candidate only after replay gates pass.", inputSchema: supplyCandidateSchema }, async args => supplyAcquisitionEnabled() ? content(await acquireVerifiedSupplyCandidate(args)) : acquisitionDisabled());

  server.registerTool("missing_supply_promotion_evidence", {
    description: "Inspect sanitized durable supply-promotion evidence including trusted control-plane provenance without exposing provider URLs, caller inputs, outputs, or credentials.",
    inputSchema: z.object({
      capability: z.string().optional(),
      recipe_fingerprint: z.string().regex(/^[a-f0-9]{64}$/).optional(),
    }),
  }, async args => content({
    promotions: supplyPromotionEvidenceSnapshot({ capability: args.capability, recipeFingerprint: args.recipe_fingerprint }),
  }));

  server.registerTool("missing_agent_rank", { description: "Inspect AgentRank provider ordering.", inputSchema: z.object({ capability: z.string().optional() }) }, async args => content(agentRankSnapshot(VERIFIED_RECIPES, args.capability)));
  server.registerTool("missing_economics", { description: "Inspect Kappa provider economics and durable resolution metering.", inputSchema: z.object({ capability: z.string().optional() }) }, async args => content(economicsSnapshot(VERIFIED_RECIPES, args.capability)));
  server.registerTool("missing_prepaid_credits", { description: "Inspect MISSING prepaid credit balances. Credits are internal service credits, not a general-purpose transferable wallet.", inputSchema: z.object({ account_id: z.string().min(1).optional() }) }, async args => content(prepaidCreditsSnapshot(args.account_id)));

  if (process.env.MISSING_MANUAL_CREDIT_ENABLED === "1") {
    server.registerTool("missing_credit_account", { description: "Administrative test/bootstrap credit operation for controlled environments only.", inputSchema: z.object({ account_id: z.string().min(1), amount_microusd: z.number().int().min(1), external_reference: z.string().min(1) }) }, async args => content(creditAccount({ accountId: args.account_id, amountMicrousd: args.amount_microusd, externalReference: args.external_reference })));
  }

  server.registerTool("missing_runtime_health", { description: "Return process-local provider recipe health and circuit-breaker state.", inputSchema: z.object({}) }, async () => content({ health: runtimeHealth(), supply_acquisition_enabled: supplyAcquisitionEnabled(), provider_discovery_enabled: providerDiscoveryEnabled() }));
}

export function registerProductTools(server: McpServer) {
  registerPublicProductTools(server);
  registerTrustedProductTools(server);
}
