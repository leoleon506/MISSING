import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const readme=readFileSync("experiments/experiment-3f/README.md","utf8");

describe("Experiment 3F preregistration",()=>{
  it("freezes readiness states",()=>{
    expect(readme).toContain("`public`");
    expect(readme).toContain("`auth_required`");
    expect(readme).toContain("`execution_error`");
    expect(readme).toContain("`unreachable`");
  });
  it("requires fresh confirmation for public supply",()=>{
    expect(readme).toContain("succeeds again on a fresh connection");
    expect(readme).toContain("public confirmation rate = **100%**");
  });
  it("freezes conservative execution and safety gates",()=>{
    expect(readme).toContain("at least **4 public servers** confirmed");
    expect(readme).toContain("at least **1 auth_required** server");
    expect(readme).toContain("unsafe tools executed = **0**");
    expect(readme).toContain("credentials supplied = **0**");
  });
});
