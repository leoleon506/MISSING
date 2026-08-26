import {describe,expect,it} from "vitest";
import {readFileSync} from "node:fs";
const readme=readFileSync("experiments/experiment-3k/README.md","utf8");
describe("Experiment 3K preregistration",()=>{
  it("freezes target-first ordering",()=>{expect(readme).toContain("Construct the **target queue first**, before executing any source tools");expect(readme).toContain("Only after the target queue and intents are frozen");});
  it("requires direct same-entity procurement",()=>{expect(readme).toContain("entity_relation === same_entity");expect(readme).toContain("purpose_fit === direct");expect(readme).toContain("confidence >= **0.90**");});
  it("excludes 3I pair and requires replay",()=>{expect(readme).toContain("known 3I pair used = **0**");expect(readme).toContain("replay success rate for persisted recipes = **100%**");expect(readme).toContain("judge/planner calls during replay = **0**");});
});
