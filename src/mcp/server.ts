import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio as serveMcpStdio } from "@modelcontextprotocol/server/stdio";
import { pathToFileURL } from "node:url";
import { loadConfig } from "../config/index.js";
import { registerOpenApiCompilerTool } from "./openApiCompiler.js";
import { registerProductTools } from "./product.js";
import { executeNormalTool, fallbackEvent, missingSpecification, toolSpecifications, type InvocationRecorder } from "./tools.js";

export interface BenchmarkServerOptions { includeMissing: boolean; missingDescription: string; missingToolName?: string; recorder?: InvocationRecorder; requestId?: string; caseId?: string; includeProductRuntime?: boolean; }
const content = (value: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(value) }] });

export function createProductServer(): McpServer {
  const server = new McpServer({ name: "missing", version: "0.2.0" });
  registerProductTools(server);
  registerOpenApiCompilerTool(server);
  return server;
}

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
    registerProductTools(server);
    registerOpenApiCompilerTool(server);
  }
  return server;
}

export async function serveStdio() {
  const config = loadConfig();
  await serveMcpStdio(() => createBenchmarkServer({ includeMissing: true, includeProductRuntime: true, missingDescription: config.description, recorder: event => process.stderr.write(`${JSON.stringify(event)}\n`) }));
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await serveStdio();
