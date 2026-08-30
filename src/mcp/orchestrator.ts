import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { runThetaOrchestrator, thetaOrchestratorEnabled } from "../runtime/orchestrator.js";

const content = (value: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(value) }] });

export function registerThetaOrchestratorTool(server: McpServer) {
  server.registerTool("run_supply_acquisition_cycle", {
    description: "On a trusted worker, run one complete demand-to-supply acquisition cycle: select the highest-priority unresolved demand, discover provider leads, compile OpenAPI, harvest evidence-backed replay inputs, live-verify, and promote only after Theta gates pass.",
    inputSchema: z.object({
      candidate_limit: z.number().int().min(1).max(20).optional(),
      timeout_ms: z.number().int().min(100).max(30000).optional(),
    }),
  }, async args => {
    if (!thetaOrchestratorEnabled()) {
      return content({ status: "disabled", reason: "Theta.4 orchestration is disabled on this public runtime. Enable only on a trusted acquisition worker with MISSING_THETA_ORCHESTRATOR_ENABLED=1." });
    }
    return content(await runThetaOrchestrator({ candidateLimit: args.candidate_limit ?? 5, timeoutMs: args.timeout_ms }));
  });
}
