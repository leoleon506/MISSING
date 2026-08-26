import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const readme=readFileSync("experiments/experiment-3e/README.md","utf8");

describe("Experiment 3E preregistration",()=>{
  it("requires affirmative read-only annotation plus zero required arguments",()=>{
    expect(readme).toContain("`annotations.readOnlyHint === true` is required");
    expect(readme).toContain("`inputSchema.required` is absent or an empty array");
    expect(readme).toContain("The call arguments are exactly `{}`");
  });
  it("freezes conservative execution gates",()=>{
    expect(readme).toContain("at least **4 safe tools** execute successfully");
    expect(readme).toContain("execution success rate among attempted safe tools >= **80%**");
    expect(readme).toContain("tools failing the safety policy that were executed = **0**");
    expect(readme).toContain("at least **10 live tools** are explicitly rejected");
  });
  it("uses no LLM credentials or paid APIs",()=>{
    expect(readme).toContain("uses **no LLM**, **no credentials**, and **no paid APIs**");
  });
});
