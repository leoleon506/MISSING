import {describe,expect,it} from "vitest";
import {readFileSync} from "node:fs";
const readme=readFileSync("experiments/experiment-3m/README.md","utf8");
describe("Experiment 3M preregistration",()=>{
  it("requires autonomous manufacture and replay",()=>{expect(readme).toContain("at least **1** case is classified `MANUFACTURE`");expect(readme).toContain("replay LLM/planner calls = **0**");});
  it("freezes constrained DSL",()=>{expect(readme).toContain("FILTER_EQ(path, $input.<field>)");expect(readme).toContain("Maximum **8 operations**");expect(readme).toContain("No regex, eval, shell, Python, JavaScript");});
  it("requires network safety",()=>{expect(readme).toContain("IP literals are rejected");expect(readme).toContain("Redirects are disabled");expect(readme).toContain("host-policy violations = **0**");});
});
