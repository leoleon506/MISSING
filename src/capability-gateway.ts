import type { Tool } from "@modelcontextprotocol/client";

export type GatewayDecision =
  | { decision: "ROUTE_EXISTING"; tool_name: string; confidence: number; reason: string }
  | { decision: "MISSING"; tool_name: null; confidence: number; reason: string };

export interface CapabilityGateway {
  resolve(task: string, tools: Tool[]): Promise<GatewayDecision>;
}

const GATEWAY_SYSTEM_PROMPT = `You are MISSING Capability Gateway.
Your only job is to decide whether the currently available capability inventory can FULLY satisfy the user's task.

Return ROUTE_EXISTING only when one listed tool's declared description and input schema cover the complete requested task.
Return MISSING when no listed tool fully covers the task, including when:
- a tool is related but its declared supported values or coverage do not include the requested value,
- the task needs live/external data or an external action that no listed tool declares,
- the task needs a transformation, format, protocol, time granularity, or operation outside the declared schema,
- multiple requirements are requested and no single listed capability can fully satisfy them.

Never assume hidden capabilities. Never infer that a tool can do more than its description/schema explicitly declares.
Do not judge whether you personally know the answer. Judge capability coverage only.`;

export class OpenAICapabilityGateway implements CapabilityGateway {
  constructor(private options: { apiKey: string; baseUrl: string; model: string }) {}

  async resolve(task: string, tools: Tool[]): Promise<GatewayDecision> {
    const inventory = tools.map(tool => ({
      name: tool.name,
      description: tool.description ?? "",
      input_schema: tool.inputSchema,
    }));

    const response = await fetch(`${this.options.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.options.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: this.options.model,
        temperature: 0,
        messages: [
          { role: "system", content: GATEWAY_SYSTEM_PROMPT },
          { role: "user", content: JSON.stringify({ task, available_capabilities: inventory }) },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "capability_gateway_decision",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                decision: { type: "string", enum: ["ROUTE_EXISTING", "MISSING"] },
                tool_name: { type: ["string", "null"] },
                confidence: { type: "number", minimum: 0, maximum: 1 },
                reason: { type: "string" },
              },
              required: ["decision", "tool_name", "confidence", "reason"],
            },
          },
        },
      }),
    });

    if (!response.ok) throw new Error(`Gateway provider returned ${response.status}: ${await response.text()}`);
    const body: any = await response.json();
    const content = body.choices?.[0]?.message?.content;
    if (!content) throw new Error("Gateway provider returned no structured decision");
    const parsed = JSON.parse(content) as GatewayDecision;
    if (parsed.decision === "MISSING") parsed.tool_name = null;
    return parsed;
  }
}
