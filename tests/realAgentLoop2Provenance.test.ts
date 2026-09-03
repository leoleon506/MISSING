import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  appendPromotedRecipe,
  configureSupplyLedger,
  readSupplyLedgerEvents,
  truncateSupplyLedger,
  withSupplyPromotionProvenance,
} from "../src/runtime/supplyLedger.js";
import type { VerifiedRecipe } from "../src/runtime/types.js";

function recipe(fingerprint: string, capability: string): VerifiedRecipe {
  return {
    capability,
    family: "test",
    provider: "RAL2 Test Provider",
    provider_candidate_id: `candidate_${fingerprint}`,
    recipe_fingerprint: fingerprint,
    method: "GET",
    base_url: "https://example.com",
    path_template: "/lookup",
    path_bindings: {},
    query_bindings: { q: "$input.q" },
    projection: { value: { op: "FIELD", path: "value" } },
    required: ["value"],
    example_input: { q: "a" },
    verification: {
      status: "replay_verified",
      source: "product_live",
      verification_inputs: [{ q: "a" }, { q: "b" }],
      verified_at: "2026-09-03T19:00:00.000Z",
      evidence_url: "https://example.com/docs",
    },
  };
}

describe("RAL2 trusted control-plane promotion provenance", () => {
  let dir = "";

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "missing-ral2-"));
    configureSupplyLedger(join(dir, "supply.jsonl"));
    truncateSupplyLedger();
  });

  afterEach(() => {
    configureSupplyLedger(undefined);
    rmSync(dir, { recursive: true, force: true });
  });

  it("persists trusted control-plane provenance only inside the authenticated cycle context", async () => {
    await withSupplyPromotionProvenance({
      acquisition_path: "trusted_control_plane",
      control_plane_run_id: "run-ral2-1",
    }, async () => {
      appendPromotedRecipe(recipe("fp-1", "capability_one"), "2026-09-03T19:01:00.000Z", {
        demand_intent: "Need capability one",
        normalized_intent: "need capability one",
      });
    });

    appendPromotedRecipe(recipe("fp-2", "capability_two"), "2026-09-03T19:02:00.000Z", {
      demand_intent: "Need capability two",
      normalized_intent: "need capability two",
    });

    const events = readSupplyLedgerEvents();
    expect(events).toHaveLength(2);
    expect(events[0].origin).toEqual({
      demand_intent: "Need capability one",
      normalized_intent: "need capability one",
      acquisition_path: "trusted_control_plane",
      control_plane_run_id: "run-ral2-1",
    });
    expect(events[1].origin).toEqual({
      demand_intent: "Need capability two",
      normalized_intent: "need capability two",
    });
  });

  it("keeps concurrent trusted acquisition run IDs isolated", async () => {
    await Promise.all([
      withSupplyPromotionProvenance({ acquisition_path: "trusted_control_plane", control_plane_run_id: "run-A" }, async () => {
        await Promise.resolve();
        appendPromotedRecipe(recipe("fp-A", "capability_a"), "2026-09-03T19:03:00.000Z", {
          demand_intent: "Demand A",
          normalized_intent: "demand a",
        });
      }),
      withSupplyPromotionProvenance({ acquisition_path: "trusted_control_plane", control_plane_run_id: "run-B" }, async () => {
        await Promise.resolve();
        appendPromotedRecipe(recipe("fp-B", "capability_b"), "2026-09-03T19:04:00.000Z", {
          demand_intent: "Demand B",
          normalized_intent: "demand b",
        });
      }),
    ]);

    const byFingerprint = new Map(readSupplyLedgerEvents().map(event => [event.recipe.recipe_fingerprint, event]));
    expect(byFingerprint.get("fp-A")?.origin?.control_plane_run_id).toBe("run-A");
    expect(byFingerprint.get("fp-B")?.origin?.control_plane_run_id).toBe("run-B");
  });
});
