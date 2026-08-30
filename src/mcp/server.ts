import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio as serveMcpStdio } from "@modelcontextprotocol/server/stdio";
import { pathToFileURL } from "node:url";
import { z } from "zod";
import { loadConfig } from "../config/index.js";
import { resolveCapability, runtimeHealth } from "../runtime/executor.js";
import { VERIFIED_RECIPES } from "../runtime/recipes.js";
import { executeNormalTool, fallbackEvent, missingSpecification, toolSpecifications, type InvocationRecorder } from "./tools.js";

export interface BenchmarkServerOptions { includeMissing: boolean; missingDescription: string; missingToolName?: string; recorder?: InvocationRecorder; requestId?: string; caseId?: string; includeProductRuntime?: boolean; }
const content = (value: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(value) }] });

export function createBenchmarkServer(options: BenchmarkServerOptions): McpServer {
  const server = new McpServer({ name: "missing-experiment-0", version: "0.2.0" });
  for (const [name, specification] of Object.entries(toolSpecifications)) {
    server.registerTool(name, specification, async args => content(executeNormalTool(name as keyof typeof toolSpecifications, args)));
  }
  if (options.includeMissing) {
    let sequence = 0;
    const missingToolName = options.missingToolName ?? "resolve_missing_capability";
    server.registerTool(missingToolName, missingSpecification(options.missingDescription), async args => {
      const event = fallbackEvent(args, { requestId: options.requestId, caseId: options.caseId, sequence: ++sequence });
      options.recorder?.(event);
      return content({ status: "capability_not_available", message: "The requested capability is not currently available.", request_id: event.request_id });
    });
  }
  if (options.includeProductRuntime) {
    server.registerTool("list_verified_capabilities", {
      description: "List capabilities currently executable by the MISSING product runtime using replay-verified provider recipes.",
      inputSchema: z.object({}),
    }, async () => content({ capabilities: VERIFIED_RECIPES.map(recipe => ({ capability: recipe.capability, family: recipe.family, provider: recipe.provider, example_input: recipe.example_input })) }));

    server.registerTool("resolve_capability", {
      description: "Execute a capability using only a replay-verified provider recipe. Returns unavailable rather than inventing an unverified integration.",
      inputSchema: z.object({
        capability: z.string().describe("Capability identifier returned by list_verified_capabilities"),
        input: z.record(z.string(), z.unknown()).describe("Capability-specific input object"),
      }),
    }, async args => content(await resolveCapability(args.capability, args.input)));

    server.registerTool("missing_runtime_health", {
      description: "Return process-local provider recipe health and circuit-breaker state for the MISSING runtime.",
      inputSchema: z.object({}),
    }, async () => content({ health: runtimeHealth() }));
  }
  return server;
}

export async function serveStdio() {
  const config = loadConfig();
  await serveMcpStdio(() => createBenchmarkServer({ includeMissing: true, includeProductRuntime: true, missingDescription: config.description, recorder: event => process.stderr.write(`${JSON.stringify(event)}\n`) }));
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await serveStdio();
