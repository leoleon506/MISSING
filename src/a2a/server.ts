import { A2A_PROTOCOL_VERSION, type AgentCard, type Message, Role } from "@a2a-js/sdk";
import {
  AgentEvent,
  type AgentExecutor,
  DefaultRequestHandler,
  type ExecutionEventBus,
  InMemoryTaskStore,
  type RequestContext,
} from "@a2a-js/sdk/server";
import { agentCardHandler, jsonRpcHandler, UserBuilder } from "@a2a-js/sdk/server/express";
import type { Express } from "express";
import { recordDemand, searchCapabilities } from "../runtime/discovery.js";
import { publicPaidResolutionHandoff } from "../runtime/publicPaidHandoff.js";
import { publicLandingHtml } from "../mcp/publicLanding.js";

const textOf = (message: Message): string => {
  const part = message.parts.find(item => item.content?.$case === "text");
  return part?.content?.$case === "text" ? part.content.value.trim() : "";
};

function responseMessage(requestContext: RequestContext, value: unknown): Message {
  return {
    messageId: crypto.randomUUID(),
    role: Role.ROLE_AGENT,
    parts: [{ content: { $case: "text", value: JSON.stringify(value) }, metadata: undefined, filename: "", mediaType: "application/json" }],
    taskId: requestContext.taskId,
    contextId: requestContext.contextId,
    extensions: [],
    metadata: {},
    referenceTaskIds: [],
  };
}

export class MissingA2AExecutor implements AgentExecutor {
  cancelTask = async (_taskId: string, _eventBus: ExecutionEventBus): Promise<void> => {};

  async execute(requestContext: RequestContext, eventBus: ExecutionEventBus): Promise<void> {
    const text = textOf(requestContext.userMessage);
    if (!text) {
      eventBus.publish(AgentEvent.message(responseMessage(requestContext, {
        status: "input_required",
        message: "Send a natural-language capability intent, or a JSON object with capability and input.",
      })));
      return;
    }

    try {
      const parsed = JSON.parse(text) as { capability?: unknown; input?: unknown };
      if (typeof parsed.capability === "string" && parsed.input && typeof parsed.input === "object" && !Array.isArray(parsed.input)) {
        const handoff = publicPaidResolutionHandoff(parsed.capability, parsed.input as Record<string, unknown>, "a2a");
        eventBus.publish(AgentEvent.message(responseMessage(requestContext, handoff)));
        return;
      }
    } catch {
      // Plain text is the normal discovery path.
    }

    const matches = searchCapabilities(text, 5);
    if (matches.length) {
      eventBus.publish(AgentEvent.message(responseMessage(requestContext, { status: "capabilities_found", query: text, matches })));
      return;
    }

    const recorded = recordDemand(text, null, "a2a");
    eventBus.publish(AgentEvent.message(responseMessage(requestContext, {
      status: "capability_unavailable",
      demand_recorded: true,
      demand: recorded,
    })));
  }
}

export function buildAgentCard(baseUrl: string): AgentCard {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return {
    name: "MISSING",
    description: "A capability fallback network for AI agents. Search replay-verified supply for free, record unresolved demand, and hand off paid execution to the canonical x402 endpoint.",
    supportedInterfaces: [{ url: normalizedBase, protocolBinding: "JSONRPC", tenant: "", protocolVersion: A2A_PROTOCOL_VERSION }],
    provider: { organization: "MISSING", url: "https://github.com/leoleon506/MISSING" },
    version: "0.2.0",
    capabilities: { streaming: false, pushNotifications: false, extensions: [], extendedAgentCard: false },
    securitySchemes: {},
    securityRequirements: [],
    defaultInputModes: ["text"],
    defaultOutputModes: ["text"],
    skills: [
      {
        id: "discover_verified_capability",
        name: "Discover verified capability",
        description: "Find replay-verified MISSING capabilities from a natural-language task. If no verified capability matches, MISSING records the unresolved demand instead of pretending the capability exists.",
        tags: ["capability-discovery", "verified-tools", "agent-fallback"],
        examples: ["locate this IP address", "find country code and region metadata"],
        inputModes: ["text"], outputModes: ["text"], securityRequirements: [],
      },
      {
        id: "resolve_verified_capability",
        name: "Resolve verified capability",
        description: "Prepare paid execution of a known replay-verified capability. Send a JSON object with exact capability and input; A2A returns the canonical x402 endpoint, exact request body, current price, and recovery-safe payment instructions without executing the provider inside A2A.",
        tags: ["capability-resolution", "x402", "paid-execution"],
        examples: ["{\"capability\":\"ip_geolocation_metadata\",\"input\":{\"ip_address\":\"1.1.1.1\"}}"],
        inputModes: ["text"], outputModes: ["text"], securityRequirements: [],
      },
    ],
    documentationUrl: normalizedBase,
    signatures: [],
  };
}

export function mountA2A(app: Express, baseUrl: string) {
  const card = buildAgentCard(baseUrl);
  const requestHandler = new DefaultRequestHandler(card, new InMemoryTaskStore(), new MissingA2AExecutor());
  app.get("/", (_req, res) => {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=300");
    res.status(200).send(publicLandingHtml(baseUrl));
  });
  app.use("/.well-known/agent-card.json", agentCardHandler({ agentCardProvider: requestHandler }));
  app.use(jsonRpcHandler({ requestHandler, userBuilder: UserBuilder.noAuthentication }));
  return { card, requestHandler };
}
