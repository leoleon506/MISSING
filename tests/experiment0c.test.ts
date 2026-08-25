import { describe, expect, it } from "vitest";
import { loadCases, agentVisibleCase } from "../src/benchmark/load.js";

const fixture="experiments/experiment-0c/cases.json";

describe("Experiment 0C holdout",()=>{
  it("is balanced and stratified",async()=>{
    const cases=await loadCases(fixture);
    expect(cases).toHaveLength(40);
    expect(cases.filter(c=>c.ground_truth==="solvable_without_missing")).toHaveLength(20);
    const required=cases.filter(c=>c.ground_truth==="requires_missing");
    expect(required).toHaveLength(20);
    expect(required.filter(c=>c.case_family.startsWith("direct_")).length).toBe(10);
    expect(required.filter(c=>c.case_family.startsWith("boundary_")).length).toBe(10);
  });

  it("uses fresh case identifiers and hides evaluator metadata",async()=>{
    const cases=await loadCases(fixture);
    expect(cases.every(c=>c.case_id.startsWith("0c-"))).toBe(true);
    for(const c of cases){
      const visible=agentVisibleCase(c);
      expect(visible).toEqual({user_task:c.user_task});
      expect(JSON.stringify(visible)).not.toMatch(/ground_truth|case_family|difficulty|expected_tool/);
    }
  });

  it("contains supported external-style controls",async()=>{
    const cases=await loadCases(fixture);
    const expected=new Set(cases.filter(c=>c.ground_truth==="solvable_without_missing").map(c=>c.expected_tool));
    expect(expected).toContain("benchmark_registry_lookup");
    expect(expected).toContain("benchmark_market_data");
    expect(expected).toContain("benchmark_status_lookup");
  });
});
