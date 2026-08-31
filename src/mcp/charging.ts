import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { chargingSnapshot, quoteCapability, resolveCapabilityCharged } from "../runtime/charging.js";

const content = (value: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(value) }] });

export function registerChargingTools(server: McpServer) {
  server.registerTool("missing_charge_quote", {
    description: "Return an explicit Kappa.1 customer-price quote for a capability. A quote is available only when all eligible failover providers share one configured customer price.",
    inputSchema: z.object({
      capability: z.string().min(1),
    }),
  }, async args => content(quoteCapability(args.capability)));

  server.registerTool("resolve_capability_charged", {
    description: "Execute a capability through Kappa transactional charging. When prepaid credits are enabled, account_id is required; credits are reserved before provider execution, committed on success, and released on failure. The idempotency key is hashed before persistence.",
    inputSchema: z.object({
      idempotency_key: z.string().min(1).max(256),
      account_id: z.string().min(1).optional(),
      capability: z.string().min(1),
      input: z.record(z.string(), z.unknown()),
    }),
  }, async args => content(await resolveCapabilityCharged({
    idempotencyKey: args.idempotency_key,
    accountId: args.account_id,
    capability: args.capability,
    input: args.input,
  })));

  server.registerTool("missing_charging_snapshot", {
    description: "Inspect aggregate Kappa transactional charging state including committed customer revenue, provider cost, and gross margin without exposing idempotency keys, user inputs, outputs, prompts, or provider URLs.",
    inputSchema: z.object({}),
  }, async () => content(chargingSnapshot()));
}
