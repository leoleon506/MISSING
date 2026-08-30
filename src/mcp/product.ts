import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { demandSnapshot, demandSummary, recordDemand, searchCapabilities } from "../runtime/discovery.js";
import { resolveCapability, runtimeHealth } from "../runtime/executor.js";
import { VERIFIED_RECIPES } from "../runtime/recipes.js";

const content = (value: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(value) }] });

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

  server.registerTool("resolve_capability", {
    description: "Execute a capability using only a replay-verified provider recipe. Returns unavailable rather than inventing an unverified integration.",
    inputSchema: z.object({
      capability: z.string().describe("Capability identifier returned by list_verified_capabilities or search_verified_capabilities"),
      input: z.record(z.string(), z.unknown()).describe("Capability-specific input object"),
    }),
  }, async args => content(await resolveCapability(args.capability, args.input)));

  server.registerTool("missing_runtime_health", {
    description: "Return process-local provider recipe health and circuit-breaker state for the MISSING runtime.",
    inputSchema: z.object({}),
  }, async () => content({ health: runtimeHealth() }));
}
