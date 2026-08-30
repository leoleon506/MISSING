import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { configureDemandLedger } from "../src/runtime/demandLedger.js";
import { demandSnapshot, demandSummary, recordDemand, reloadDemandFromLedger, resetDemand } from "../src/runtime/discovery.js";

let tempDir: string | null = null;

function useTempLedger() {
  tempDir = mkdtempSync(join(tmpdir(), "missing-zeta-"));
  const ledger = join(tempDir, "demand.jsonl");
  configureDemandLedger(ledger);
  resetDemand({ truncateLedger: true });
  return ledger;
}

afterEach(() => {
  configureDemandLedger(null);
  resetDemand();
  if (tempDir) rmSync(tempDir, { recursive: true, force: true });
  tempDir = null;
});

describe("MISSING Product Zeta persistent demand intelligence", () => {
  it("reconstructs unresolved demand after an in-memory restart", () => {
    useTempLedger();
    recordDemand("Validate this Finnish VAT number", null, "mcp");
    recordDemand("Validate this Finnish VAT number", null, "a2a");

    reloadDemandFromLedger();

    const snapshot = demandSnapshot();
    expect(snapshot).toHaveLength(1);
    expect(snapshot[0]?.count).toBe(2);
    expect(snapshot[0]?.sources).toEqual({ mcp: 1, a2a: 1 });
    expect(snapshot[0]?.normalized_intent).toBe("validate this finnish vat number");
  });

  it("keeps bounded examples while aggregating equivalent observations", () => {
    useTempLedger();
    const variants = [
      "Validate Finnish VAT!",
      "Validate Finnish VAT.",
      "Validate Finnish VAT?",
      "Validate Finnish VAT;",
      "Validate Finnish VAT:",
      "Validate Finnish VAT,",
      "Validate Finnish VAT...",
    ];
    for (const variant of variants) recordDemand(variant, "tax_validation", "runtime");

    const snapshot = demandSnapshot();
    expect(snapshot).toHaveLength(1);
    expect(snapshot[0]?.count).toBe(variants.length);
    expect(snapshot[0]?.examples).toHaveLength(5);
  });

  it("summarizes total observations and protocol sources", () => {
    useTempLedger();
    recordDemand("Validate this Finnish VAT number", null, "mcp");
    recordDemand("Validate this Finnish VAT number", null, "mcp");
    recordDemand("Check EU VAT registration", null, "a2a");

    const summary = demandSummary();
    expect(summary.unique_intents).toBe(2);
    expect(summary.total_observations).toBe(3);
    expect(summary.sources).toEqual({ mcp: 2, a2a: 1 });
    expect(summary.top_demand[0]?.count).toBe(2);
  });
});
