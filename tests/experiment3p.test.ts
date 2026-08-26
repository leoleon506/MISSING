import {describe,expect,it} from "vitest";
import {readFileSync} from "node:fs";

const readme=readFileSync("experiments/3p/README.md","utf8");
const code=readFileSync("src/experiment3p.ts","utf8");
const casesBlock=code.slice(code.indexOf("const CASES="),code.indexOf("type CaseDef="));

describe("Experiment 3P preregistration",()=>{
  it("freezes a source index without case-to-provider mappings",()=>{
    expect(readme).toContain("No case may contain a required provider/source");
    expect(casesBlock).not.toContain("required_provider");
    expect(casesBlock).not.toContain("required_source");
    expect(casesBlock).not.toContain("provider_id");
    expect(casesBlock).not.toContain("operation_path");
  });
  it("requires live contracts, procurement, persistence and no-planner replay",()=>{
    expect(readme).toContain("all three candidate specs are fetched live, parsed, and fingerprinted");
    expect(readme).toContain("at least 2 distinct providers reach static validation and live JSON execution");
    expect(readme).toContain("planner calls during replay = 0");
    expect(readme).toContain("source procurement calls during replay = 0");
  });
  it("keeps safety and non-vacuous negative controls",()=>{
    expect(readme).toContain("An operation path not present in the selected live contract must be rejected");
    expect(readme).toContain("A parameter not declared by the selected live operation/path must be rejected");
    expect(readme).toContain("A non-GET method must be rejected");
    expect(readme).toContain("fingerprint evidence is non-vacuous");
  });
});
