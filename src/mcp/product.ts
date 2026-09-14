import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { acquireVerifiedSupplyCandidate, rankSupplyOpportunities, supplyAcquisitionEnabled, verifySupplyCandidate } from "../runtime/acquisition.js";
import { agentRankSnapshot } from "../runtime/agentRank.js";
import { quoteCapability } from "../runtime/charging.js";
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

export function publicExecutionMetadata(capability: string, input: Record<string, unknown>) {
  const quote = quoteCapability(capability);
  if (quote.status !== "quoted") {
    return {
      executable: false as const,
      execution_tool: "resolve_capability" as const,
      pricing_status: quote.status,
      reason: quote.reason,
      next_action: null,
    };
  }
  return {
    executable: true as const,
    execution_tool: "resolve_capability" as const,
    pricing_status: "quoted" as const,
    customer_price_microusd: quote.customer_price_microusd,
    currency: quote.currency,
    next_action: {
      tool: "resolve_capability" as const,
      arguments: {
        capability,
        input: structuredClone(input),
      },
    },
  };
}

function publicCapabilityCatalog() {
  return VERIFIED_RECIPES.map(recipe => ({
    capability: recipe.capability,
    family: recipe.family,
    provider: recipe.provider,
    example_input: recipe.example_input,
    execution: publicExecutionMetadata(recipe.capability, recipe.example_input),
  }));
}

export function publicCapabilitySearchResponse(query: string, limit = 5) {
  const matches = searchCapabilities(query, limit).map(match => ({
    ...match,
    execution: publicExecutionMetadata(match.capability, match.example_input),
  }));

  if (matches.length > 0) {
    return {
      query,
      status: "verified_matches_found" as const,
      missing_can_acquire_capability: true,
      instruction: "If a match satisfies the requested task, call its execution.next_action.tool with execution.next_action.arguments. If none is suitable, call record_missing_capability_demand so MISSING can use the unmet demand to discover, replay-verify, and potentially promote new executable supply.",
      matches,
      next_action: null,
    };
  }

  return {
    query,
    status: "capability_not_yet_available" as const,
    missing_can_acquire_capability: true,
    instruction: "No verified capability currently matches this request. Call record_missing_capability_demand with the returned next_action arguments. MISSING can use recorded demand to discover candidate supply, replay-verify it on a trusted worker, and promote it only if verification gates pass. Recording demand does not guarantee immediate availability.",
    matches,
    next_action: {
      tool: "record_missing_capability_demand" as const,
      arguments: {
        intent: query,
      },
    },
  };
}

/** Anonymous/public MCP surface. Discovery is free; execution is x402-only. */
export function registerPublicProductTools(server: McpServer) {
  server.registerTool("list_verified_capabilities", {
    title: "List Verified Capabilities",
    description: "List every replay-verified capability currently executable by MISSING. If a listed capability satisfies the caller's task, continue with the returned execution.next_action and call resolve_capability; do not stop after listing unless the caller only asked to inspect the catalog. If no listed capability is suitable, use search_verified_capabilities with the caller's natural-language need; that search can direct you to request a new capability. resolve_capability is still a non-charging quote/handoff step. This tool is read-only and has no payment or provider side effect.",
    inputSchema: z.object({}),
    annotations: { readOnlyHint: true, openWorldHint: false },
  }, async () => content({
    instruction: "If a capability satisfies the requested task, call its execution.next_action.tool with execution.next_action.arguments. If none is suitable, call search_verified_capabilities with the desired outcome; MISSING can record unmet demand for future verified supply acquisition.",
    missing_can_acquire_capability: true,
    capabilities: publicCapabilityCatalog(),
  }));

  server.registerTool("search_verified_capabilities", {
    title: "Search or Request a Capability",
    description: "Search the replay-verified MISSING catalog from a natural-language task description. If a returned match satisfies the caller's task, continue with that match's execution.next_action and call resolve_capability. If no suitable verified match exists, this tool returns an explicit next_action for record_missing_capability_demand so MISSING can use the unmet need to discover, replay-verify, and potentially promote new executable supply. Recording demand does not guarantee immediate creation or availability. This search itself is read-only and does not call providers, create demand, or trigger payment.",
    inputSchema: z.object({
      query: z.string().min(2).describe("Natural-language description of the external capability or task you need, for example 'reverse geocode coordinates to postal code'. Describe the outcome, not an implementation."),
      limit: z.number().int().min(1).max(20).optional().describe("Maximum verified matches to return. Optional; defaults to 5. Valid range is 1 through 20."),
    }),
    annotations: { readOnlyHint: true, openWorldHint: false },
  }, async args => content(publicCapabilitySearchResponse(args.query, args.limit ?? 5)));

  server.registerTool("record_missing_capability_demand", {
    title: "Request a New Capability",
    description: "Request a capability MISSING cannot currently resolve. Use this when search_verified_capabilities returns capability_not_yet_available or when its verified matches do not satisfy the task. The request is recorded as durable unmet demand so trusted acquisition can prioritize provider discovery, replay verification, and promotion of new executable supply. Promotion occurs only after verification gates pass, so this does not promise immediate creation or availability. The mutation is additive and non-destructive; repeated calls may increase the observed demand signal. Never include secrets, credentials, personal data, payment material, or private keys.",
    inputSchema: z.object({
      intent: z.string().min(2).describe("Natural-language description of the unresolved task or desired outcome. Keep it specific enough to evaluate future providers and exclude sensitive data."),
      capability: z.string().optional().describe("Optional proposed capability identifier if you already know an appropriate stable name. Prefer lowercase snake_case; omit this field when uncertain."),
      example_input: demandExampleInputSchema.optional(),
    }),
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  }, async args => content({
    status: "demand_recorded",
    message: "MISSING will use this unmet demand to prioritize discovery and verification of new supply. Availability is not guaranteed until a candidate passes replay verification and is promoted.",
    recorded: recordDemand(args.intent, args.capability ?? null, "mcp", args.example_input),
  }));

  server.registerTool("resolve_capability", {
    title: "Resolve Verified Capability",
    description: "Prepare paid execution of one exact replay-verified capability. When list_verified_capabilities or search_verified_capabilities returns a suitable execution.next_action, call this tool with those exact arguments. This MCP call itself does not execute a provider or charge the caller; it returns payment_required with the canonical /v1/agent/resolve endpoint, current price, exact request body, and x402 instructions. The later HTTP x402 flow performs execution and settlement: preserve the exact request body and exact PAYMENT-SIGNATURE for recovery, and do not create a second authorization for a payment already associated with a known transaction.",
    inputSchema: z.object({
      capability: z.string().min(1).describe("Exact verified capability identifier returned by list_verified_capabilities or search_verified_capabilities."),
      input: z.record(z.string(), z.unknown()).describe("JSON input object for that capability. Prefer the exact execution.next_action.arguments.input returned by discovery, and reuse this exact object in the subsequent x402 HTTP request."),
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
