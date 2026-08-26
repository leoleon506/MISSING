import {describe,expect,it} from "vitest";
import {readFileSync} from "node:fs";
const readme=readFileSync("experiments/experiment-3o/README.md","utf8");
describe("Experiment 3O preregistration",()=>{
  it("uses three unrelated families",()=>{expect(readme).toContain("scholarly metadata");expect(readme).toContain("weather/environment");expect(readme).toContain("earthquakes/scientific monitoring");});
  it("requires shared source catalog and wrong-source rejection",()=>{expect(readme).toContain("planner sees all three sources for every case");expect(readme).toContain("wrong-source accepted = 0");expect(readme).toContain("negative controls rejected = 100%");});
  it("requires multi-family live reuse",()=>{expect(readme).toContain(">=2 distinct families have live semantic success");expect(readme).toContain(">=2 distinct families have independent replay success");expect(readme).toContain("replay success rate across persisted recipes = 100%");});
});
