import {describe,expect,it} from "vitest";
import {readFileSync} from "node:fs";
const readme=readFileSync("experiments/experiment-3n2/README.md","utf8");
describe("Experiment 3N2 preregistration",()=>{
  it("uses fresh countries",()=>{expect(readme).toContain('"Argentina"');expect(readme).toContain('"Australia"');expect(readme).toContain('"France"');expect(readme).toContain('"India"');});
  it("freezes strict typed DSL",()=>{expect(readme).toContain("additional properties are forbidden");expect(readme).toContain("No aliases such as `field`, `value`, `city`, `as`");});
  it("requires semantic preservation and replay",()=>{expect(readme).toContain("final `country === input.country`");expect(readme).toContain("replay success rate across persisted recipes = 100%");});
});
