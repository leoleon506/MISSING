import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const readme=readFileSync("experiments/experiment-3a/README.md","utf8");
const contracts=JSON.parse(readFileSync("experiments/experiment-3a/contracts.json","utf8"));

describe("Experiment 3A preregistration",()=>{
  it("contains valid and invalid contracts",()=>{
    expect(contracts.filter((c:any)=>c.expected==="ACCEPT").length).toBeGreaterThanOrEqual(3);
    expect(contracts.filter((c:any)=>c.expected==="REJECT").length).toBeGreaterThanOrEqual(3);
  });
  it("freezes perfect gate rates",()=>{
    expect(readme).toContain("valid-contract acceptance rate = **100%**");
    expect(readme).toContain("invalid/stale-contract rejection rate = **100%**");
    expect(readme).toContain("false acceptance rate = **0%**");
    expect(readme).toContain("false rejection rate = **0%**");
  });
  it("does not use an LLM",()=>{
    expect(readme).toContain("uses **no LLM**");
  });
});
