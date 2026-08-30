import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { configureDemandLedger } from "../src/runtime/demandLedger.js";
import { recordDemand, resetDemand } from "../src/runtime/discovery.js";
import { runThetaOrchestrator } from "../src/runtime/orchestrator.js";
import { configureSupplyBlockLedger, isSupplyIntentBlocked, latestSupplyBlocks, recordSupplyBlock, truncateSupplyBlockLedger } from "../src/runtime/supplyBlockLedger.js";

let tempDir: string | null = null;

function setup() {
  tempDir = mkdtempSync(join(tmpdir(), "missing-theta9-"));
  configureDemandLedger(join(tempDir, "demand.jsonl"));
  configureSupplyBlockLedger(join(tempDir, "supply-blocks.jsonl"));
  resetDemand({ truncateLedger: true });
  truncateSupplyBlockLedger();
}

afterEach(() => {
  delete process.env.MISSING_SUPPLY_BLOCK_BACKOFF_MS;
  configureDemandLedger(null);
  configureSupplyBlockLedger(null);
  resetDemand();
  if (tempDir) rmSync(tempDir, { recursive: true, force: true });
  tempDir = null;
});

describe("MISSING Product Theta.9 blocked supply queue and backoff", () => {
  it("persists provider-setup blockers with a retry timestamp", () => {
    setup();
    process.env.MISSING_SUPPLY_BLOCK_BACKOFF_MS = "60000";
    const now = new Date("2026-08-30T12:00:00.000Z");
    const event = recordSupplyBlock({
      normalized_intent: "validate this finnish vat number",
      intent: "Validate this Finnish VAT number",
      provider: "VAT API",
      reason: "Provider requires setup",
      credentials_required: ["apikey"],
      response_schema_missing: true,
    }, now);

    expect(event.attempt).toBe(1);
    expect(event.retry_after).toBe("2026-08-30T12:01:00.000Z");
    expect(latestSupplyBlocks().get(event.normalized_intent)?.credentials_required).toEqual(["apikey"]);
    expect(isSupplyIntentBlocked(event.normalized_intent, new Date("2026-08-30T12:00:30.000Z"))).toBe(true);
    expect(isSupplyIntentBlocked(event.normalized_intent, new Date("2026-08-30T12:01:01.000Z"))).toBe(false);
  });

  it("increases backoff on repeated blockers", () => {
    setup();
    process.env.MISSING_SUPPLY_BLOCK_BACKOFF_MS = "1000";
    const input = {
      normalized_intent: "validate this finnish vat number",
      intent: "Validate this Finnish VAT number",
      provider: "VAT API",
      reason: "Provider requires setup",
      credentials_required: ["apikey"],
      response_schema_missing: true,
    };
    const first = recordSupplyBlock(input, new Date("2026-08-30T12:00:00.000Z"));
    const second = recordSupplyBlock(input, new Date("2026-08-30T12:02:00.000Z"));
    expect(first.attempt).toBe(1);
    expect(second.attempt).toBe(2);
    expect(Date.parse(second.retry_after) - Date.parse(second.blocked_at)).toBe(2000);
  });

  it("skips an actively blocked top opportunity and continues with the next demand", async () => {
    setup();
    process.env.MISSING_SUPPLY_BLOCK_BACKOFF_MS = "86400000";
    recordDemand("Validate this Finnish VAT number", null, "a2a");
    recordDemand("Validate this Finnish VAT number", null, "a2a");
    recordDemand("Get postal code metadata", null, "mcp");
    recordSupplyBlock({
      normalized_intent: "validate this finnish vat number",
      intent: "Validate this Finnish VAT number",
      provider: "VAT API",
      reason: "Provider requires setup",
      credentials_required: ["apikey"],
      response_schema_missing: true,
    });

    let selected = "";
    const result = await runThetaOrchestrator({
      discoverFn: async opportunity => {
        selected = opportunity.normalized_intent;
        return [];
      },
    });

    expect(selected).toBe("get postal code metadata");
    expect(result.opportunity?.normalized_intent).toBe("get postal code metadata");
    expect(result.status).toBe("no_candidates");
  });
});
