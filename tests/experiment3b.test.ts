import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const readme=readFileSync("experiments/experiment-3b/README.md","utf8");

describe("Experiment 3B preregistration",()=>{
  it("freezes APIs.guru as discovery source",()=>{
    expect(readme).toContain("https://api.apis.guru/v2/list.json");
  });
  it("freezes discovery limits and gates",()=>{
    expect(readme).toContain("max APIs inspected: **250**");
    expect(readme).toContain("max live candidate probes: **30**");
    expect(readme).toContain("at least **5** contracts are autonomously admitted");
    expect(readme).toContain("at least **4 distinct API providers/ids**");
    expect(readme).toContain("second-probe validation rate for admitted contracts = **100%**");
  });
  it("uses no LLM or paid API",()=>{
    expect(readme).toContain("uses **no LLM** and **no paid APIs**");
  });
});
