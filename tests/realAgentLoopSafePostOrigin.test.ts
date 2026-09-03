import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SupplyCandidate } from "../src/runtime/acquisition.js";
import { resetPromotedRecipesForTest } from "../src/runtime/recipes.js";
import type { SafePostVerificationAssessment } from "../src/runtime/safePostPolicy.js";
import { acquireSafePostCandidate } from "../src/runtime/safePostReplay.js";
import { configureSupplyLedger, readSupplyLedgerEvents } from "../src/runtime/supplyLedger.js";

const tempDirs: string[] = [];
const originalEnabled = process.env.MISSING_SAFE_POST_REPLAY_ENABLED;

afterEach(() => {
  vi.unstubAllGlobals();
  if (originalEnabled === undefined) delete process.env.MISSING_SAFE_POST_REPLAY_ENABLED;
  else process.env.MISSING_SAFE_POST_REPLAY_ENABLED = originalEnabled;
  configureSupplyLedger(undefined);
  resetPromotedRecipesForTest();
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("Real Agent Loop Safe POST promotion origin", () => {
  it("persists the normalized originating demand when safe replay promotes supply", async () => {
    const dir = mkdtempSync(join(tmpdir(), "missing-ral1-safe-post-"));
    tempDirs.push(dir);
    configureSupplyLedger(join(dir, "supply.jsonl"));
    process.env.MISSING_SAFE_POST_REPLAY_ENABLED = "1";

    const candidate: SupplyCandidate = {
      candidate_id: "ral1_safe_post",
      demand_intent: "Validate a Customer Item",
      capability: "ral1_safe_post_validation",
      family: "test",
      provider: "RAL1 Safe Provider",
      evidence_url: "https://sandbox.provider.example/openapi.json",
      method: "POST",
      base_url: "https://sandbox.provider.example",
      path_template: "/validate",
      path_bindings: {},
      query_bindings: {},
      body_bindings: { name: "$input.name", dry_run: "$input.dry_run" },
      projection: { id: { op: "FIELD", path: "id" }, simulated: { op: "FIELD", path: "simulated" } },
      required: ["id", "simulated"],
      verification_inputs: [
        { name: "alpha", dry_run: true },
        { name: "beta", dry_run: true },
      ],
    };
    const assessment: SafePostVerificationAssessment = {
      status: "safe_for_replay",
      signals: [{
        kind: "dry_run_control",
        sufficient: true,
        source: "body:dry_run",
        detail: "dry-run is non-mutating",
        location: "body",
        name: "dry_run",
        input_name: "dry_run",
        safe_value: true,
      }],
      input_overrides: { dry_run: true },
      generated_headers: [],
      reason: "dry-run containment",
    };

    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ id: "simulated", simulated: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    })));

    const result = await acquireSafePostCandidate(candidate, assessment);
    expect(result.status).toBe("promoted");
    const events = readSupplyLedgerEvents();
    expect(events).toHaveLength(1);
    expect(events[0].origin).toEqual({
      demand_intent: "Validate a Customer Item",
      normalized_intent: "validate a customer item",
    });
  });
});
