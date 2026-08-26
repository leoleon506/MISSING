import {describe,expect,it} from "vitest";
import {readFileSync} from "node:fs";
const readme=readFileSync("experiments/experiment-3n/README.md","utf8");
describe("Experiment 3N preregistration",()=>{
  it("requires country preservation",()=>{expect(readme).toContain("candidate `country` exactly equals `$input.country`");expect(readme).toContain("final latitude/longitude come from that same candidate object");});
  it("rejects the 3M negative control",()=>{expect(readme).toContain("unconstrained negative-control chain accepted = 0");expect(readme).toContain("known wrong San Jose, United States result from 3M");});
  it("requires replay without planning",()=>{expect(readme).toContain("replay planner/repair calls = 0");expect(readme).toContain("replay success rate across persisted recipes = 100%");});
});
