import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const readme=readFileSync("experiments/experiment-3c/README.md","utf8");

describe("Experiment 3C preregistration",()=>{
  it("freezes stratified full-directory sampling",()=>{
    expect(readme).toContain("stride = floor(total_ids / 300)");
    expect(readme).toContain("every unseen root provider");
  });
  it("freezes preflight and admission gates",()=>{
    expect(readme).toContain("max preflights: **40**");
    expect(readme).toContain("at least **5** contracts admitted");
    expect(readme).toContain("at least **5 distinct root providers/domains**");
    expect(readme).toContain("schema/export match rate among successful preflights >= **70%**");
    expect(readme).toContain("second-probe validation rate for admitted contracts = **100%**");
  });
  it("keeps discovery free and deterministic",()=>{
    expect(readme).toContain("uses **no LLM** and **no paid APIs**");
    expect(readme).toContain("No API-specific allowlists");
  });
});
