import {describe,expect,it} from "vitest";
import {readFileSync} from "node:fs";
const readme=readFileSync("experiments/experiment-3j/README.md","utf8");
describe("Experiment 3J preregistration",()=>{
  it("freezes semantic-purpose judge",()=>{expect(readme).toContain("entity_relation === same_entity");expect(readme).toContain("confidence >= **0.90**");});
  it("requires zero decoy false positives",()=>{expect(readme).toContain("Semantic judge false-positive rate on decoys must be **0%**");});
  it("requires strict functional replay",()=>{expect(readme).toContain("at least **1** persisted recipe replays successfully");expect(readme).toContain("replay success rate for persisted recipes = **100%**");expect(readme).toContain("judge/planner calls during replay = **0**");});
});
