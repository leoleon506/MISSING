import { createMcpHandler } from "@modelcontextprotocol/server";
import express, { type Request as ExpressRequest, type Response as ExpressResponse } from "express";
import { randomUUID } from "node:crypto";
import { createServer, type IncomingMessage } from "node:http";
import { pathToFileURL } from "node:url";
import { mountA2A } from "../a2a/server.js";
import { supplyAcquisitionEnabled } from "../runtime/acquisition.js";
import { agentRankEnabled, agentRankExplorationEnabled, agentRankLedgerPath } from "../runtime/agentRank.js";
import { agentPaymentsSnapshot, handleAgentPaidResolution } from "../runtime/agentPayments.js";
import { authorizeControlPlane, controlPlaneCycleOptions, controlPlaneEnabled } from "../runtime/controlPlane.js";
import {
  closeConsumerTelemetry,
  consumerTelemetrySnapshot,
  initializeConsumerTelemetry,
  observeDurableConsumerPayment,
  refreshConsumerTelemetrySnapshot,
} from "../runtime/consumerTelemetry.js";
import { demandLedgerPath } from "../runtime/demandLedger.js";
import {
  closeDiscoveryTelemetry,
  discoveryTelemetrySnapshot,
  initializeDiscoveryTelemetry,
  observePublicInteractions,
  parseMcpInteractions,
  refreshDiscoveryTelemetrySnapshot,
} from "../runtime/discoveryTelemetry.js";
import { distributedMoneyEnabled, initializeDistributedMoney } from "../runtime/distributedMoney.js";
import { economicsEnforcementEnabled, economicsLedgerPath } from "../runtime/economics.js";
import { openApiCompilerEnabled } from "../runtime/openApiCompiler.js";
import { runThetaOrchestrator, thetaOrchestratorEnabled } from "../runtime/orchestrator.js";
import { providerDiscoveryEnabled } from "../runtime/providerDiscovery.js";
import { PUBLIC_ENTRY_CHANNEL_HEADER } from "../runtime/publicPaidHandoff.js";
import { VERIFIED_RECIPES } from "../runtime/recipes.js";
import { safePostReplayEnabled } from "../runtime/safePostReplay.js";
import { sandboxConfig, sandboxMiddleware, sandboxSnapshot } from "../runtime/sandbox.js";
import { settledReorgMonitorSnapshot, startSettledX402ReorgMonitor, stopSettledX402ReorgMonitor } from "../runtime/settledReorgMonitor.js";
import { settlingRecoveryWorkerSnapshot, startSettlingX402RecoveryWorker, stopSettlingX402RecoveryWorker } from "../runtime/settlingRecoveryWorker.js";
import { supplyLedgerPath, supplyPromotionEvidenceSnapshot, withSupplyPromotionProvenance } from "../runtime/supplyLedger.js";
import { productionAdmissionEnabled, productionAdmissionSnapshot } from "../runtime/x402.js";
import { enrichX402HttpResultWithBazaar } from "../runtime/x402Bazaar.js";
import { refreshX402RpcNetworkIdentity } from "../runtime/x402RpcIdentity.js";
import { reconcileSettledX402Telemetry } from "../runtime/x402TelemetryReconciliation.js";
import { createPublicProductServer } from "./server.js";

export const productMcpHandler = createMcpHandler(() => createPublicProductServer());

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
    transports: ["mcp-streamable-http", "a2a-jsonrpc", "x402-http"],
    demand_persistence: demandLedgerPath() !== null,
    supply_persistence: supplyLedgerPath() !== null,
    agentrank_enabled: agentRankEnabled(),
    agentrank_exploration_enabled: agentRankExplorationEnabled(),
    agentrank_persistence: agentRankLedgerPath() !== null,
    economics_enforcement_enabled: economicsEnforcementEnabled(),
    economics_persistence: economicsLedgerPath() !== null,
    agent_payments: agentPaymentsSnapshot(),
    consumer_telemetry: consumerTelemetrySnapshot(),
    discovery_telemetry: discoveryTelemetrySnapshot(),
    production_admission: productionAdmissionSnapshot(),
    settled_reorg_monitor: settledReorgMonitorSnapshot(),
    settling_recovery_worker: settlingRecoveryWorkerSnapshot(),
    supply_acquisition_enabled: supplyAcquisitionEnabled(),
    provider_discovery_enabled: providerDiscoveryEnabled(),
    openapi_compiler_enabled: openApiCompilerEnabled(),
    theta_orchestrator_enabled: thetaOrchestratorEnabled(),
    safe_post_replay_enabled: safePostReplayEnabled(),
    control_plane_enabled: controlPlaneEnabled(),
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
  const agentrank_persistence = agentRankLedgerPath() !== null;
  const economics_persistence = economicsLedgerPath() !== null;
  const distributedReady = !distributedMoneyEnabled() || agentPaymentsSnapshot().distributed_money.ready;
  const production_admission = productionAdmissionSnapshot();
  const productionAdmissionReady = !production_admission.enabled || production_admission.ready;
  const consumer_telemetry = consumerTelemetrySnapshot();
  const consumerTelemetryReady = !distributedMoneyEnabled() || consumer_telemetry.ready;
  return {
    status: public_url_valid && demand_persistence && supply_persistence && agentrank_persistence && distributedReady && productionAdmissionReady && consumerTelemetryReady ? "ready" : "not_ready",
    public_url_valid,
    demand_persistence,
    supply_persistence,
    agentrank_enabled: agentRankEnabled(),
    agentrank_exploration_enabled: agentRankExplorationEnabled(),
    agentrank_persistence,
    economics_enforcement_enabled: economicsEnforcementEnabled(),
    economics_persistence,
    agent_payments: agentPaymentsSnapshot(),
    consumer_telemetry,
    discovery_telemetry: discoveryTelemetrySnapshot(),
    production_admission,
    settled_reorg_monitor: settledReorgMonitorSnapshot(),
    settling_recovery_worker: settlingRecoveryWorkerSnapshot(),
    supply_acquisition_enabled: supplyAcquisitionEnabled(),
    provider_discovery_enabled: providerDiscoveryEnabled(),
    openapi_compiler_enabled: openApiCompilerEnabled(),
    theta_orchestrator_enabled: thetaOrchestratorEnabled(),
    safe_post_replay_enabled: safePostReplayEnabled(),
    control_plane_enabled: controlPlaneEnabled(),
  };
}

async function refreshProductionRpcIdentity() {
  if (!productionAdmissionEnabled()) return;
  await refreshX402RpcNetworkIdentity();
}

async function readNodeBody(req: IncomingMessage): Promise<Buffer | undefined> {
  if (req.method === "GET" || req.method === "HEAD") return undefined;
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return chunks.length ? Buffer.concat(chunks) : undefined;
}

function nodeRequestToWeb(req: IncomingMessage, body?: Buffer): Request {
  const host = req.headers.host ?? "127.0.0.1";
  const url = new URL(req.url ?? "/", `http://${host}`);
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) for (const item of value) headers.append(key, item);
    else if (value !== undefined) headers.set(key, value);
  }
  return new Request(url, { method: req.method, headers, body: req.method === "GET" || req.method === "HEAD" ? undefined : body });
}

async function writeWebResponse(response: Response, res: ExpressResponse) {
  res.status(response.status);
  response.headers.forEach((value, key) => res.setHeader(key, value));
  res.end(Buffer.from(await response.arrayBuffer()));
}

function requestIp(req: ExpressRequest): string | null {
  return req.ip || req.socket.remoteAddress || null;
}

export function createProductHttpApp(baseUrl = publicBaseUrl()) {
  const app = express();
  app.disable("x-powered-by");
  if (process.env.RAILWAY_ENVIRONMENT || process.env.MISSING_TRUST_PROXY === "1") app.set("trust proxy", 1);

  app.post("/internal/acquisition/run", async (req: ExpressRequest, res: ExpressResponse) => {
    if (!controlPlaneEnabled()) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    if (!authorizeControlPlane(req.get("authorization"))) {
      res.setHeader("WWW-Authenticate", "Bearer");
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    try {
      const controlPlaneRunId = randomUUID();
      const result = await withSupplyPromotionProvenance({
        acquisition_path: "trusted_control_plane",
        control_plane_run_id: controlPlaneRunId,
      }, () => runThetaOrchestrator(controlPlaneCycleOptions()));
      res.status(200).json({ ...result, control_plane_run_id: controlPlaneRunId });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(`control-plane acquisition failed: ${message}\n`);
      res.status(500).json({ error: "acquisition_cycle_failed" });
    }
  });

  app.use(sandboxMiddleware);

  app.use((req: ExpressRequest, res: ExpressResponse, next) => {
    if (req.path === "/mcp" || req.path.startsWith("/internal/")) return next();
    const event = req.method === "GET" && req.path === "/" ? "landing"
      : req.method === "GET" && req.path === "/.well-known/agent-card.json" ? "agent_card"
      : req.method === "POST" && req.path === "/" ? "a2a"
      : null;
    if (!event) return next();
    res.on("finish", () => {
      void observePublicInteractions({
        clientIp: requestIp(req),
        headers: req.headers,
        events: [{ event_type: event }],
        statusCode: res.statusCode,
      }).catch(error => process.stderr.write(`discovery telemetry observation failed: ${error instanceof Error ? error.message : String(error)}\n`));
    });
    next();
  });

  app.post("/v1/agent/resolve", express.json({ limit: "64kb" }), async (req: ExpressRequest, res: ExpressResponse) => {
    try {
      await refreshProductionRpcIdentity();
      const resourceUrl = `${baseUrl.replace(/\/$/, "")}/v1/agent/resolve`;
      const paymentSignature = req.get("PAYMENT-SIGNATURE");
      const paymentResult = await handleAgentPaidResolution({ request: req.body, paymentSignature, resourceUrl });
      const result = enrichX402HttpResultWithBazaar(paymentResult, req.body);
      if (paymentSignature) {
        try {
          await observeDurableConsumerPayment({
            paymentSignature,
            entryChannel: req.get(PUBLIC_ENTRY_CHANNEL_HEADER),
          });
        } catch (error) {
          process.stderr.write(`consumer telemetry observation failed: ${error instanceof Error ? error.message : String(error)}\n`);
        }
      }
      if (result.headers) for (const [key, value] of Object.entries(result.headers)) res.setHeader(key, value);
      res.status(result.status).json(result.body);
    } catch (error) {
      process.stderr.write(`agent payment request failed: ${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
      res.status(500).json({ error: "internal_error" });
    }
  });

  app.get("/v1/evidence/supply-promotion/:capability", (req: ExpressRequest, res: ExpressResponse) => {
    const capability = String(req.params.capability ?? "");
    if (!/^[a-z][a-z0-9_]*$/.test(capability)) {
      res.status(400).json({ error: "invalid_capability" });
      return;
    }
    const rawFingerprint = req.query.recipe_fingerprint;
    if (rawFingerprint !== undefined && (typeof rawFingerprint !== "string" || !/^[0-9a-f]{64}$/.test(rawFingerprint))) {
      res.status(400).json({ error: "invalid_recipe_fingerprint" });
      return;
    }
    const evidence = supplyPromotionEvidenceSnapshot({
      capability,
      ...(typeof rawFingerprint === "string" ? { recipeFingerprint: rawFingerprint } : {}),
    });
    res.status(200).json({ evidence });
  });

  app.all("/mcp", async (req: ExpressRequest, res: ExpressResponse) => {
    let rawBody: Buffer | undefined;
    try {
      rawBody = await readNodeBody(req);
      const events = parseMcpInteractions(req.method, rawBody);
      const response = await productMcpHandler.fetch(nodeRequestToWeb(req, rawBody));
      await writeWebResponse(response, res);
      void observePublicInteractions({
        clientIp: requestIp(req),
        headers: req.headers,
        events,
        statusCode: response.status,
      }).catch(error => process.stderr.write(`discovery telemetry observation failed: ${error instanceof Error ? error.message : String(error)}\n`));
    } catch (error) {
      if (!res.headersSent) res.status(500).json({ error: "internal_error" });
      process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
    }
  });

  app.get("/livez", (_req, res) => res.status(200).json({ status: "live" }));
  app.get("/readyz", async (_req, res) => {
    try { await refreshProductionRpcIdentity(); } catch { /* snapshot remains fail-closed */ }
    try { await refreshConsumerTelemetrySnapshot(); } catch { /* snapshot remains fail-closed */ }
    try { await refreshDiscoveryTelemetrySnapshot(); } catch { /* observability must not gate readiness */ }
    const payload = readinessPayload(baseUrl);
    res.status(payload.status === "ready" ? 200 : 503).json(payload);
  });
  app.get("/healthz", async (_req, res) => {
    try { await refreshConsumerTelemetrySnapshot(); } catch { /* health exposes last snapshot */ }
    try { await refreshDiscoveryTelemetrySnapshot(); } catch { /* health exposes last snapshot */ }
    res.status(200).json(healthPayload());
  });
  app.get("/sandboxz", async (_req, res) => {
    try { await refreshDiscoveryTelemetrySnapshot(); } catch { /* expose last snapshot */ }
    const config = sandboxConfig();
    res.status(200).json({ sandbox: config.enabled, requests_per_window: config.requests_per_window, window_ms: config.window_ms, telemetry: sandboxSnapshot(), discovery_telemetry: discoveryTelemetrySnapshot() });
  });

  mountA2A(app, baseUrl);
  app.use((_req, res) => res.status(404).json({ error: "not_found" }));
  return app;
}

export async function serveHttp() {
  const port = Number(process.env.PORT ?? 3000);
  const host = process.env.HOST ?? "127.0.0.1";
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error(`Invalid PORT: ${process.env.PORT}`);
  if (distributedMoneyEnabled()) {
    await initializeDistributedMoney();
    await initializeConsumerTelemetry();
    const telemetry = await reconcileSettledX402Telemetry();
    if (telemetry.recorded > 0 || telemetry.error) {
      process.stdout.write(`MISSING x402 telemetry reconciliation ${JSON.stringify(telemetry)}\n`);
    }
    await refreshConsumerTelemetrySnapshot();
  }
  await initializeDiscoveryTelemetry();
  startSettlingX402RecoveryWorker();
  startSettledX402ReorgMonitor();
  try { await refreshProductionRpcIdentity(); } catch { /* readiness will expose failure */ }
  const resolvedPublicBaseUrl = publicBaseUrl(port, host);
  const server = createServer(createProductHttpApp(resolvedPublicBaseUrl));

  const close = async () => {
    await stopSettlingX402RecoveryWorker();
    await stopSettledX402ReorgMonitor();
    await closeDiscoveryTelemetry();
    await closeConsumerTelemetry();
    await productMcpHandler.close();
    server.close();
  };
  process.once("SIGINT", close);
  process.once("SIGTERM", close);

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, resolve);
  });
  process.stdout.write(`MISSING public MCP listening on ${resolvedPublicBaseUrl}/mcp\n`);
  process.stdout.write(`MISSING A2A Agent Card on ${resolvedPublicBaseUrl}/.well-known/agent-card.json\n`);
  process.stdout.write(`MISSING x402 paid capability endpoint on ${resolvedPublicBaseUrl}/v1/agent/resolve\n`);
  process.stdout.write(`MISSING sandbox status on ${resolvedPublicBaseUrl}/sandboxz\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await serveHttp();
