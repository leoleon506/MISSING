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
import { resolveCapability } from "../runtime/executor.js";

const textOf = (message: Message): string => {
  const part = message.parts.find(item => item.content?.$case === "text");
  return part?.content?.$case === "text" ? part.content.value.trim() : "";
};

function responseMessage(requestContext: RequestContext, value: unknown): Message {
  return {
    messageId: crypto.randomUUID(),
    role: Role.ROLE_AGENT,
    parts: [{
      content: { $case: "text", value: JSON.stringify(value) },
      metadata: undefined,
      filename: "",
      mediaType: "application/json",
    }],
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
        const result = await resolveCapability(parsed.capability, parsed.input as Record<string, unknown>);
        eventBus.publish(AgentEvent.message(responseMessage(requestContext, result)));
        return;
      }
    } catch {
      // Plain text is the normal discovery path.
    }

    const matches = searchCapabilities(text, 5);
    if (matches.length) {
      eventBus.publish(AgentEvent.message(responseMessage(requestContext, {
        status: "capabilities_found",
        query: text,
        matches,
      })));
      return;
    }

    const recorded = recordDemand(text);
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
    description: "A verified-capability resolver for AI agents. Discovers replay-verified capabilities, executes them, and fails over across verified providers when redundancy exists.",
    supportedInterfaces: [{
      url: normalizedBase,
      protocolBinding: "JSONRPC",
      tenant: "",
      protocolVersion: A2A_PROTOCOL_VERSION,
    }],
    provider: {
      organization: "MISSING",
      url: "https://github.com/leoleon506/MISSING",
    },
    version: "0.2.0",
    capabilities: {
      streaming: false,
      pushNotifications: false,
      extensions: [],
      extendedAgentCard: false,
    },
    securitySchemes: {},
    securityRequirements: [],
    defaultInputModes: ["text"],
    defaultOutputModes: ["text"],
    skills: [
      {
        id: "discover_verified_capability",
        name: "Discover verified capability",
        description: "Find an executable MISSING capability from a natural-language intent. Unknown intents are recorded as unresolved demand.",
        tags: ["capability-discovery", "verified-tools", "agent-fallback"],
        examples: ["locate this IP address", "find country code and region metadata"],
        inputModes: ["text"],
        outputModes: ["text"],
        securityRequirements: [],
      },
      {
        id: "resolve_verified_capability",
        name: "Resolve verified capability",
        description: "Execute a known replay-verified capability. Send JSON text containing capability and input.",
        tags: ["capability-resolution", "api-failover", "verified-execution"],
        examples: ["{\"capability\":\"ip_geolocation_metadata\",\"input\":{\"ip_address\":\"1.1.1.1\"}}"],
        inputModes: ["text"],
        outputModes: ["text"],
        securityRequirements: [],
      },
    ],
    documentationUrl: "https://github.com/leoleon506/MISSING",
    signatures: [],
  };
}

export function mountA2A(app: Express, baseUrl: string) {
  const card = buildAgentCard(baseUrl);
  const requestHandler = new DefaultRequestHandler(card, new InMemoryTaskStore(), new MissingA2AExecutor());
  app.use("/.well-known/agent-card.json", agentCardHandler({ agentCardProvider: requestHandler }));
  app.use(jsonRpcHandler({ requestHandler, userBuilder: UserBuilder.noAuthentication }));
  return { card, requestHandler };
}
