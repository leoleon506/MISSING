import { A2A_PROTOCOL_VERSION } from "@a2a-js/sdk";
import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { resetDemand } from "../src/runtime/discovery.js";
import { buildAgentCard } from "../src/a2a/server.js";
import { createProductHttpApp } from "../src/mcp/http.js";

let server: Server;
let baseUrl = "";

beforeAll(async () => {
  server = createServer(createProductHttpApp("http://127.0.0.1"));
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Expected TCP address");
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  resetDemand();
  await new Promise<void>(resolve => server.close(() => resolve()));
});

function userMessage(text: string) {
  return {
    tenant: "",
    metadata: {},
    message: {
      messageId: crypto.randomUUID(),
      role: "ROLE_USER",
      parts: [{ text }],
      taskId: "",
      contextId: "",
      extensions: [],
      metadata: {},
      referenceTaskIds: [],
    },
  };
}

async function sendMessage(text: string) {
  const response = await fetch(baseUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "A2A-Version": A2A_PROTOCOL_VERSION,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "SendMessage",
      id: 1,
      params: userMessage(text),
    }),
  });
  expect(response.ok).toBe(true);
  return response.json() as Promise<Record<string, unknown>>;
}

describe("MISSING Product Epsilon A2A discovery", () => {
  it("publishes a genuine A2A v1 Agent Card", async () => {
    const response = await fetch(`${baseUrl}/.well-known/agent-card.json`);
    expect(response.ok).toBe(true);
    const card = await response.json() as any;
    expect(card.name).toBe("MISSING");
    expect(card.supportedInterfaces?.[0]?.protocolBinding).toBe("JSONRPC");
    expect(card.skills?.map((skill: any) => skill.id)).toEqual(expect.arrayContaining([
      "discover_verified_capability",
      "resolve_verified_capability",
    ]));
  });

  it("keeps the Agent Card deterministic from product metadata", () => {
    const card = buildAgentCard("https://missing.example");
    expect(card.supportedInterfaces[0]?.url).toBe("https://missing.example/");
    expect(card.capabilities?.streaming).toBe(false);
    expect(card.securityRequirements).toEqual([]);
  });

  it("discovers a verified capability through A2A SendMessage", async () => {
    const result = await sendMessage("locate this IP address");
    expect(JSON.stringify(result)).toContain("ip_geolocation_metadata");
    expect(JSON.stringify(result)).toContain("capabilities_found");
  });

  it("records unknown demand through the A2A surface", async () => {
    resetDemand();
    const result = await sendMessage("Validate this Finnish VAT number");
    expect(JSON.stringify(result)).toContain("capability_unavailable");
    expect(JSON.stringify(result)).toContain("demand_recorded");
  });
});
