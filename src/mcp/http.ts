import { createMcpHandler } from "@modelcontextprotocol/server";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { pathToFileURL } from "node:url";
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

async function writeWebResponse(response: Response, res: ServerResponse) {
  res.statusCode = response.status;
  response.headers.forEach((value, key) => res.setHeader(key, value));
  res.end(Buffer.from(await response.arrayBuffer()));
}

export async function handleHttpRequest(req: IncomingMessage, res: ServerResponse) {
  const pathname = new URL(req.url ?? "/", `http://${req.headers.host ?? "127.0.0.1"}`).pathname;
  if (pathname === "/healthz") {
    res.statusCode = 200;
    res.setHeader("content-type", "application/json; charset=utf-8");
    res.end(JSON.stringify(healthPayload()));
    return;
  }
  if (pathname === "/mcp") {
    await writeWebResponse(await productMcpHandler.fetch(await nodeRequestToWeb(req)), res);
    return;
  }
  res.statusCode = 404;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify({ error: "not_found" }));
}

export async function serveHttp() {
  const port = Number(process.env.PORT ?? 3000);
  const host = process.env.HOST ?? "127.0.0.1";
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error(`Invalid PORT: ${process.env.PORT}`);

  const server = createServer((req, res) => {
    handleHttpRequest(req, res).catch(error => {
      if (!res.headersSent) res.statusCode = 500;
      res.end(JSON.stringify({ error: "internal_error" }));
      process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
    });
  });

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
  process.stdout.write(`MISSING remote MCP listening on http://${host}:${port}/mcp\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await serveHttp();
