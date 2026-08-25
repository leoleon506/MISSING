import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const readme=readFileSync("experiments/experiment-2c/README.md","utf8");
const cases=JSON.parse(readFileSync("experiments/experiment-2c/cases.json","utf8"));
const sources=JSON.parse(readFileSync("experiments/experiment-2c/sources.json","utf8"));

describe("Experiment 2C preregistration",()=>{
  it("uses fresh safe compositions and unsafe controls",()=>{
    expect(cases.filter((c:any)=>c.expected==="BUILD").length).toBe(5);
    expect(cases.filter((c:any)=>c.expected==="REJECT").length).toBeGreaterThanOrEqual(2);
    expect(new Set(cases.filter((c:any)=>c.expected==="BUILD").map((c:any)=>c.family)).size).toBe(5);
  });

  it("corrects REST Countries array-root exports before the benchmark",()=>{
    const rc=sources.find((s:any)=>s.source_id==="restcountries_alpha");
    expect(rc.exports.capital_latlng).toBe("0.capitalInfo.latlng");
    expect(rc.exports.currencies).toBe("0.currencies");
    expect(rc.exports.languages).toBe("0.languages");
  });

  it("freezes the holdout gates",()=>{
    expect(readme).toContain("composition build success rate >= **80%**");
    expect(readme).toContain("live validation pass rate >= **95%**");
    expect(readme).toContain("independent reuse pass rate >= **95%**");
    expect(readme).toContain("LLM calls during reuse = **0**");
    expect(readme).toContain("at least **4 distinct composition families**");
  });
});
