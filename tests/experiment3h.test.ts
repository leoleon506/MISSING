import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const readme=readFileSync("experiments/experiment-3h/README.md","utf8");

describe("Experiment 3H preregistration",()=>{
  it("requires exact semantic concept matching",()=>{
    expect(readme).toContain("normalized source leaf name equals normalized target parameter name **exactly**");
    expect(readme).toContain("source value is non-empty and is not a placeholder");
  });
  it("requires functional outcome success",()=>{
    expect(readme).toContain("`result.isError !== true`");
    expect(readme).toContain("Protocol-level success alone does **not** count");
  });
  it("requires fresh replay and zero planner calls",()=>{
    expect(readme).toContain("at least **1** persisted recipe passes fresh replay");
    expect(readme).toContain("planner/LLM calls = **0**");
    expect(readme).toContain("at least **20 candidate pairs** are rejected");
  });
});
