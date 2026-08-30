import { createMcpHandler } from "@modelcontextprotocol/server";
import express, { type Request as ExpressRequest, type Response as ExpressResponse } from "express";
import { createServer, type IncomingMessage } from "node:http";
import { pathToFileURL } from "node:url";
import { mountA2A } from "../a2a/server.js";
import { supplyAcquisitionEnabled } from "../runtime/acquisition.js";
import { demandLedgerPath } from "../runtime/demandLedger.js";
import { openApiCompilerEnabled } from "../runtime/openApiCompiler.js";
import { providerDiscoveryEnabled } from "../runtime/providerDiscovery.js";
import { VERIFIED_RECIPES } from "../runtime/recipes.js";
import { sandboxConfig, sandboxMiddleware, sandboxSnapshot } from "../runtime/sandbox.js";
import { supplyLedgerPath } from "../runtime/supplyLedger.js";
import { createProductServer } from "./server.js";

export const productMcpHandler = createMcpHandler(() => createProductServer());

export function publicBaseUrl(port = Number(process.env.PORT ?? 3000), host = process.env.HOST ?? "127.0.0.1"): string {
  if (process.env.PUBLIC_BASE_URL) return process.env.PUBLIC_BASE_URL.replace(/\/$/, "");
  if (process.env.RAILWAY_PUBLIC_DOMAIN) return `https://${process.env.RAILWAY_PUBLIC_DOMAIN.replace(/^https?:\/\//, "").replace(/\/$/, "")}`;
  return `http://${host}:${port}`;
}

export function healthPayload() {
  return {
    status: "ok",
    product: "MISSING",
    version: "0.2.0",
    capability_count: new Set(VERIFIED_RECIPES.map(recipe => recipe.capability)).size,
    recipe_count: VERIFIED_RECIPES.length,
    transports: ["mcp-streamable-http", "a2a-jsonrpc"],
    demand_persistence: demandLedgerPath() !== null,
    supply_persistence: supplyLedgerPath() !== null,
    supply_acquisition_enabled: supplyAcquisitionEnabled(),
    provider_discovery_enabled: providerDiscoveryEnabled(),
    openapi_compiler_enabled: openApiCompilerEnabled(),
    sandbox: sandboxConfig().enabled,
  };
}

export function readinessPayload(baseUrl: string) {
  let public_url_valid = false;
  try {
    const parsed = new URL(baseUrl);
    public_url_valid = parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    public_url_valid = false;
  }
  const demand_persistence = demandLedgerPath() !== null;
  const supply_persistence = supplyLedgerPath() !== null;
  return {
    status: public_url_valid && demand_persistence && supply_persistence ? "ready" : "not_ready",
    public_url_valid,
    demand_persistence,
    supply_persistence,
    supply_acquisition_enabled: supplyAcquisitionEnabled(),
    provider_discovery_enabled: providerDiscoveryEnabled(),
    openapi_compiler_enabled: openApiCompilerEnabled(),
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

export function createProductHttpApp(baseUrl = publicBaseUrl()) {
  const app = express();
  app.disable("x-powered-by");
  if (process.env.RAILWAY_ENVIRONMENT || process.env.MISSING_TRUST_PROXY === "1") app.set("trust proxy", 1);
  app.use(sandboxMiddleware);

  app.all("/mcp", async (req: ExpressRequest, res: ExpressResponse) => {
    try {
      await writeWebResponse(await productMcpHandler.fetch(await nodeRequestToWeb(req)), res);
    } catch (error) {
      if (!res.headersSent) res.status(500).json({ error: "internal_error" });
      process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
    }
  });

  app.get("/livez", (_req, res) => {
    res.status(200).json({ status: "live" });
  });

  app.get("/readyz", (_req, res) => {
    const payload = readinessPayload(baseUrl);
    res.status(payload.status === "ready" ? 200 : 503).json(payload);
  });

  app.get("/healthz", (_req, res) => {
    res.status(200).json(healthPayload());
  });

  app.get("/sandboxz", (_req, res) => {
    const config = sandboxConfig();
    res.status(200).json({
      sandbox: config.enabled,
      requests_per_window: config.requests_per_window,
      window_ms: config.window_ms,
      telemetry: sandboxSnapshot(),
    });
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
  const resolvedPublicBaseUrl = publicBaseUrl(port, host);
  const server = createServer(createProductHttpApp(resolvedPublicBaseUrl));

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
  process.stdout.write(`MISSING remote MCP listening on ${resolvedPublicBaseUrl}/mcp\n`);
  process.stdout.write(`MISSING A2A Agent Card on ${resolvedPublicBaseUrl}/.well-known/agent-card.json\n`);
  process.stdout.write(`MISSING sandbox status on ${resolvedPublicBaseUrl}/sandboxz\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await serveHttp();
