import { createServer, type Server } from "node:http";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { configureDemandLedger } from "../src/runtime/demandLedger.js";
import { resetSandboxState } from "../src/runtime/sandbox.js";
import { createProductHttpApp } from "../src/mcp/http.js";

let server: Server | null = null;
let baseUrl = "";

beforeEach(async () => {
  process.env.MISSING_SANDBOX_ENABLED = "1";
  process.env.MISSING_SANDBOX_REQUESTS_PER_WINDOW = "2";
  process.env.MISSING_SANDBOX_WINDOW_MS = "60000";
  configureDemandLedger(".missing/test-eta-demand.jsonl");
  resetSandboxState();
  server = createServer(createProductHttpApp("https://missing.example"));
  await new Promise<void>((resolve, reject) => {
    server?.once("error", reject);
    server?.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Expected TCP address");
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterEach(async () => {
  delete process.env.MISSING_SANDBOX_ENABLED;
  delete process.env.MISSING_SANDBOX_REQUESTS_PER_WINDOW;
  delete process.env.MISSING_SANDBOX_WINDOW_MS;
  configureDemandLedger(null);
  resetSandboxState();
  if (server) await new Promise<void>(resolve => server?.close(() => resolve()));
  server = null;
});

describe("MISSING Product Eta public agent sandbox", () => {
  it("exposes liveness, readiness and privacy-safe telemetry", async () => {
    expect((await fetch(`${baseUrl}/livez`)).status).toBe(200);
    expect((await fetch(`${baseUrl}/readyz`)).status).toBe(200);
    const sandbox = await (await fetch(`${baseUrl}/sandboxz`)).json() as any;
    expect(sandbox.sandbox).toBe(true);
    expect(sandbox.requests_per_window).toBe(2);
    expect(sandbox.telemetry).not.toHaveProperty("clients");
    expect(JSON.stringify(sandbox.telemetry)).not.toContain("127.0.0.1");
  });

  it("rate limits agent traffic but leaves control endpoints available", async () => {
    const options = {
      method: "POST",
      headers: { "content-type": "application/json", "A2A-Version": "1.0" },
      body: JSON.stringify({ jsonrpc: "2.0", method: "UnknownMethod", id: 1, params: {} }),
    };
    await fetch(baseUrl, options);
    await fetch(baseUrl, options);
    const limited = await fetch(baseUrl, options);
    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).toBeTruthy();
    expect((await fetch(`${baseUrl}/livez`)).status).toBe(200);
  });

  it("publishes Agent Card without consuming sandbox quota", async () => {
    expect((await fetch(`${baseUrl}/.well-known/agent-card.json`)).status).toBe(200);
    expect((await fetch(`${baseUrl}/.well-known/agent-card.json`)).status).toBe(200);
    expect((await fetch(`${baseUrl}/.well-known/agent-card.json`)).status).toBe(200);
  });
});
