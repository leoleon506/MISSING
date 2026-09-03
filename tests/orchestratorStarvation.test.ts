import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { configureDemandLedger } from "../src/runtime/demandLedger.js";
import { recordDemand, resetDemand } from "../src/runtime/discovery.js";
import { runThetaOrchestrator } from "../src/runtime/orchestrator.js";
import { configureSupplyBlockLedger, latestSupplyBlocks } from "../src/runtime/supplyBlockLedger.js";

let dir = "";

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "missing-orchestrator-starvation-"));
  configureDemandLedger(join(dir, "demand.jsonl"));
  configureSupplyBlockLedger(join(dir, "supply-blocks.jsonl"));
  resetDemand({ truncateLedger: true });
});

afterEach(() => {
  configureDemandLedger(undefined);
  configureSupplyBlockLedger(undefined);
  resetDemand();
  rmSync(dir, { recursive: true, force: true });
});

describe("Theta acquisition starvation backoff", () => {
  it("backs off needs_safe_verification demand so the next cycle can select another opportunity", async () => {
    recordDemand("unsafe post demand", "unsafe_post_capability", "mcp");
    recordDemand("unsafe post demand", "unsafe_post_capability", "mcp");
    recordDemand("second independent demand", "second_capability", "mcp");

    const first = await runThetaOrchestrator({
      discoverFn: async () => [{ provider: "Unsafe Provider" } as any],
      compileFn: async () => ({
        status: "needs_safe_verification",
        candidate: null,
        reason: "POST has no explicit safe verification guarantee",
      } as any),
    });

    expect(first.status).toBe("needs_safe_verification");
    expect(first.opportunity?.requested_capability).toBe("unsafe_post_capability");
    expect(first.trace.some(step => step.status === "backoff_recorded")).toBe(true);
    expect(latestSupplyBlocks().has("unsafe post demand")).toBe(true);

    const second = await runThetaOrchestrator({
      discoverFn: async opportunity => {
        expect(opportunity.requested_capability).toBe("second_capability");
        return [];
      },
    });

    expect(second.opportunity?.requested_capability).toBe("second_capability");
    expect(second.status).toBe("no_candidates");
  });
});
