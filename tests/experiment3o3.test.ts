import {describe,expect,it} from "vitest";
import {readFileSync} from "node:fs";
const readme=readFileSync("experiments/experiment-3o3/README.md","utf8");
describe("Experiment 3O3 preregistration",()=>{
  it("keeps the frozen three families and inputs",()=>{expect(readme).toContain("10.1038/nphys1170");expect(readme).toContain("40.7128,-74.0060");expect(readme).toContain("all_day");});
  it("uses a flat spec and deterministic compiler",()=>{expect(readme).toContain("No `oneOf`");expect(readme).toContain("deterministic compiler");expect(readme).toContain("SOURCE -> PROJECT_PATHS -> OUTPUT");});
  it("does not relax original GO gates",()=>{expect(readme).toContain(">=2 distinct families have live semantic success");expect(readme).toContain("replay success rate across persisted recipes = 100%");expect(readme).toContain("wrong-source accepted = 0");});
});
