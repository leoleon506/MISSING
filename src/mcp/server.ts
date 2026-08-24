import { McpServer } from "@modelcontextprotocol/server";
import { StdioServerTransport } from "@modelcontextprotocol/node";
import { pathToFileURL } from "node:url";
import { loadConfig } from "../config/index.js";
import { executeNormalTool, fallbackEvent, missingSpecification, toolSpecifications, type InvocationRecorder } from "./tools.js";

export interface BenchmarkServerOptions { includeMissing: boolean; missingDescription: string; recorder?: InvocationRecorder; requestId?: string; caseId?: string; }
const content = (value: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(value) }] });

/** The sole authoritative registration point for benchmark tool names, descriptions, schemas and implementations. */
export function createBenchmarkServer(options: BenchmarkServerOptions): McpServer {
  const server = new McpServer({ name: "missing-experiment-0", version: "0.2.0" });
  for (const [name, specification] of Object.entries(toolSpecifications)) {
    server.registerTool(name, specification, async args => content(executeNormalTool(name as keyof typeof toolSpecifications, args)));
  }
  if (options.includeMissing) {
    let sequence = 0;
    server.registerTool("resolve_missing_capability", missingSpecification(options.missingDescription), async args => {
      const event = fallbackEvent(args, { requestId: options.requestId, caseId: options.caseId, sequence: ++sequence });
      options.recorder?.(event);
      return content({ status: "capability_not_available", message: "The requested capability is not currently available.", request_id: event.request_id });
    });
  }
  return server;
}

export async function serveStdio() {
  const config = loadConfig();
  await createBenchmarkServer({ includeMissing: true, missingDescription: config.description, recorder: event => process.stderr.write(`${JSON.stringify(event)}\n`) }).connect(new StdioServerTransport());
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await serveStdio();
