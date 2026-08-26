import {describe,expect,it} from "vitest";
import {readFileSync} from "node:fs";
const readme=readFileSync("experiments/experiment-3l/README.md","utf8");
describe("Experiment 3L preregistration",()=>{
  it("requires seeded two-step composition",()=>{expect(readme).toContain("Step A consumes only fields from the user seed");expect(readme).toContain("Step B consumes exactly one scalar value extracted from Step A output");});
  it("requires independent replay seed",()=>{expect(readme).toContain("different frozen replay seed");expect(readme).toContain("zero planner/repair/judge calls");});
  it("freezes safety and no literal invention",()=>{expect(readme).toContain("literals invented by planner = **0**");expect(readme).toContain("known 3I pair used = **0**");expect(readme).toContain("replay success rate across persisted recipes = **100%**");});
});
