import { createMcpHandler } from "@modelcontextprotocol/server";
import express, { type Request as ExpressRequest, type Response as ExpressResponse } from "express";
import { createServer, type IncomingMessage } from "node:http";
import { pathToFileURL } from "node:url";
import { mountA2A } from "../a2a/server.js";
import { demandLedgerPath } from "../runtime/demandLedger.js";
import { VERIFIED_RECIPES } from "../runtime/recipes.js";
import { createProductServer } from "./server.js";

export const productMcpHandler = createMcpHandler(() => createProductServer());

export function healthPayload() {
  return {
    status: "ok",
    product: "MISSING",
    version: "0.2.0",
    capability_count: new Set(VERIFIED_RECIPES.map(recipe => recipe.capability)).size,
    recipe_count: VERIFIED_RECIPES.length,
    transports: ["mcp-streamable-http", "a2a-jsonrpc"],
    demand_persistence: demandLedgerPath() !== null,
  };
}

async function nodeRequestToWeb(req: IncomingMessage): Promise<Request> {
  const host = req.headers.host ?? "127.0.0.1";
  const url = new URL(req.url ?? "/", `http://${host}`);
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) for (const item of value) headers.append(key, item);
    else if (value !== undefined) headers.set(key, value);
  }
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  const body = chunks.length ? Buffer.concat(chunks) : undefined;
  return new Request(url, { method: req.method, headers, body: req.method === "GET" || req.method === "HEAD" ? undefined : body });
}

async function writeWebResponse(response: Response, res: ExpressResponse) {
  res.status(response.status);
  response.headers.forEach((value, key) => res.setHeader(key, value));
  res.end(Buffer.from(await response.arrayBuffer()));
}

export function createProductHttpApp(baseUrl = process.env.PUBLIC_BASE_URL ?? "http://127.0.0.1:3000") {
  const app = express();

  app.all("/mcp", async (req: ExpressRequest, res: ExpressResponse) => {
    try {
      await writeWebResponse(await productMcpHandler.fetch(await nodeRequestToWeb(req)), res);
    } catch (error) {
      if (!res.headersSent) res.status(500).json({ error: "internal_error" });
      process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
    }
  });

  app.get("/healthz", (_req, res) => {
    res.status(200).json(healthPayload());
  });

  mountA2A(app, baseUrl);

  app.use((_req, res) => {
    res.status(404).json({ error: "not_found" });
  });

  return app;
}

export async function serveHttp() {
  const port = Number(process.env.PORT ?? 3000);
  const host = process.env.HOST ?? "127.0.0.1";
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error(`Invalid PORT: ${process.env.PORT}`);
  const publicBaseUrl = process.env.PUBLIC_BASE_URL ?? `http://${host}:${port}`;
  const server = createServer(createProductHttpApp(publicBaseUrl));

  const close = async () => {
    await productMcpHandler.close();
    server.close();
  };
  process.once("SIGINT", close);
  process.once("SIGTERM", close);

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, resolve);
  });
  process.stdout.write(`MISSING remote MCP listening on ${publicBaseUrl}/mcp\n`);
  process.stdout.write(`MISSING A2A Agent Card on ${publicBaseUrl}/.well-known/agent-card.json\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await serveHttp();
