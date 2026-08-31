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
    description: "Execute a capability through the Kappa.1 transactional charging boundary. The idempotency key is hashed before persistence; a successful resolution commits economics exactly once for that key, while failure voids the transaction.",
    inputSchema: z.object({
      idempotency_key: z.string().min(1).max(256),
      capability: z.string().min(1),
      input: z.record(z.string(), z.unknown()),
    }),
  }, async args => content(await resolveCapabilityCharged({
    idempotencyKey: args.idempotency_key,
    capability: args.capability,
    input: args.input,
  })));

  server.registerTool("missing_charging_snapshot", {
    description: "Inspect aggregate Kappa.1 transactional charging state without exposing idempotency keys, user inputs, outputs, prompts, or provider URLs.",
    inputSchema: z.object({}),
  }, async () => content(chargingSnapshot()));
}
