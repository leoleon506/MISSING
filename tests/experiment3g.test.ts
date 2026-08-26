import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const readme=readFileSync("experiments/experiment-3g/README.md","utf8");

describe("Experiment 3G preregistration",()=>{
  it("requires cross-server composition and replay",()=>{
    expect(readme).toContain("at least **1** cross-server composition executes successfully");
    expect(readme).toContain("at least **1** persisted recipe replays successfully");
    expect(readme).toContain("replay success rate for persisted recipes = **100%**");
  });
  it("freezes narrow schema compatibility",()=>{
    expect(readme).toContain("exactly one required input property");
    expect(readme).toContain("source scalar type equals target required-property type");
    expect(readme).toContain("normalized source leaf name equals normalized target parameter name");
  });
  it("forbids unsafe execution and replanning",()=>{
    expect(readme).toContain("unsafe/mutating tools executed = **0**");
    expect(readme).toContain("credentials supplied = **0**");
    expect(readme).toContain("planner/LLM calls during discovery, composition, and replay = **0**");
  });
});
