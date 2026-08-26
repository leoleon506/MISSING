import {describe,expect,it} from "vitest";
import {readFileSync} from "node:fs";
const readme=readFileSync("experiments/experiment-3o2/README.md","utf8");
describe("Experiment 3O2 preregistration",()=>{
  it("keeps original families and inputs",()=>{expect(readme).toContain("10.1038/nphys1170");expect(readme).toContain("40.7128,-74.0060");expect(readme).toContain("all_day");});
  it("uses strict structured output",()=>{expect(readme).toContain("json_schema");expect(readme).toContain("strict: true");expect(readme).toContain("raw planner response content");});
  it("fixes non-vacuous metrics without relaxing gates",()=>{expect(readme).toContain("wrong_source_detected");expect(readme).toContain("at least one recipe is persisted");expect(readme).toContain(">=2 distinct families have live semantic success");});
});
