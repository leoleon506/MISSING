import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { recipeFromSupplyCandidate } from "../src/runtime/acquisition.js";
import {
  appendPromotedRecipe,
  configureSupplyLedger,
  supplyPromotionEvidenceSnapshot,
  withSupplyPromotionProvenance,
} from "../src/runtime/supplyLedger.js";

const dirs: string[] = [];

afterEach(() => {
  configureSupplyLedger(undefined);
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("supply promotion evidence", () => {
  it("returns trusted provenance and sanitized verification metadata", async () => {
    const dir = mkdtempSync(join(tmpdir(), "missing-promotion-evidence-"));
    dirs.push(dir);
    configureSupplyLedger(join(dir, "supply.jsonl"));

    const recipe = recipeFromSupplyCandidate({
      candidate_id: "theta_test",
      demand_intent: "Get holiday metadata",
      capability: "holiday_metadata",
      family: "discovered",
      provider: "Holiday API",
      evidence_url: "https://example.test/openapi.json",
      method: "GET",
      base_url: "https://example.test",
      path_template: "/holidays/{holidayId}",
      path_bindings: { holidayId: "$input.holidayId" },
      query_bindings: { year: "$input.year" },
      projection: { holiday: { op: "FIELD", path: "holiday" } },
      required: ["holiday"],
      verification_inputs: [
        { holidayId: 1, year: 2026 },
        { holidayId: 32, year: 2027 },
      ],
    }, "2026-09-04T20:30:00.000Z");

    await withSupplyPromotionProvenance({
      acquisition_path: "trusted_control_plane",
      control_plane_run_id: "run-123",
    }, async () => {
      appendPromotedRecipe(recipe, "2026-09-04T20:31:00.000Z", {
        demand_intent: "Get holiday metadata",
        normalized_intent: "get holiday metadata",
      });
    });

    expect(supplyPromotionEvidenceSnapshot({ capability: "holiday_metadata" })).toEqual([{
      promoted_at: "2026-09-04T20:31:00.000Z",
      capability: "holiday_metadata",
      family: "discovered",
      provider: "Holiday API",
      recipe_fingerprint: recipe.recipe_fingerprint,
      verification_source: "product_live",
      verification_input_count: 2,
      verified_at: "2026-09-04T20:30:00.000Z",
      origin: {
        demand_intent: "Get holiday metadata",
        normalized_intent: "get holiday metadata",
        acquisition_path: "trusted_control_plane",
        control_plane_run_id: "run-123",
      },
    }]);

    const serialized = JSON.stringify(supplyPromotionEvidenceSnapshot());
    expect(serialized).not.toContain("https://example.test");
    expect(serialized).not.toContain("holidayId");
    expect(serialized).not.toContain("2026\"}");
  });
});
