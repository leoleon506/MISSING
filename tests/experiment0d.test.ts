import { describe, expect, it } from "vitest";
import { loadCases } from "../src/benchmark/load.js";
import type { GatewayDecision } from "../src/capability-gateway.js";

const fixture = "experiments/experiment-0d/cases.json";

describe("Experiment 0D", () => {
  it("has 60 fresh balanced gateway cases", async () => {
    const cases = await loadCases(fixture);
    expect(cases).toHaveLength(60);
    expect(cases.filter(c => c.ground_truth === "solvable_without_missing")).toHaveLength(30);
    expect(cases.filter(c => c.ground_truth === "requires_missing")).toHaveLength(30);
    expect(cases.filter(c => c.case_id.includes("-direct-"))).toHaveLength(15);
    expect(cases.filter(c => c.case_id.includes("-boundary-"))).toHaveLength(15);
  });

  it("requires expected tools for every solvable case", async () => {
    const cases = await loadCases(fixture);
    for (const c of cases.filter(c => c.ground_truth === "solvable_without_missing")) {
      expect(c.expected_tool).toBeTruthy();
    }
  });

  it("keeps structured gateway decisions explicit", () => {
    const routed: GatewayDecision = { decision: "ROUTE_EXISTING", tool_name: "calculator", confidence: 0.99, reason: "Covered" };
    const missing: GatewayDecision = { decision: "MISSING", tool_name: null, confidence: 0.98, reason: "No capability" };
    expect(routed.decision).toBe("ROUTE_EXISTING");
    expect(missing.tool_name).toBeNull();
  });
});
