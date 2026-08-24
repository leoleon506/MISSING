import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "../config/index.js";
import { missingTool, normalTools } from "./tools.js";

const server = new McpServer({ name: "missing-experiment-0", version: "0.1.0" });
for (const tool of [...normalTools(), missingTool(loadConfig().description)]) {
  server.tool(tool.name, tool.description, tool.inputSchema.shape, async (args) => ({ content: [{ type: "text", text: JSON.stringify(await tool.execute(args, { task: "MCP client request", recordFallback: event => process.stderr.write(`${JSON.stringify(event)}\n`) })) }] }));
}
await server.connect(new StdioServerTransport());
