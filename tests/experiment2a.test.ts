import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const readme=readFileSync("experiments/experiment-2a/README.md","utf8");
const cases=JSON.parse(readFileSync("experiments/experiment-2a/cases.json","utf8"));
const sources=JSON.parse(readFileSync("experiments/experiment-2a/sources.json","utf8"));

describe("Experiment 2A preregistration",()=>{
  it("contains safe, unsafe, and composed capabilities",()=>{
    expect(cases.filter((c:any)=>c.expected==="BUILD").length).toBeGreaterThanOrEqual(4);
    expect(cases.filter((c:any)=>c.expected==="REJECT").length).toBeGreaterThanOrEqual(2);
    expect(cases.some((c:any)=>c.requires_composition)).toBe(true);
  });
  it("uses only preapproved HTTPS read sources",()=>{
    expect(sources.length).toBeGreaterThanOrEqual(3);
    expect(sources.every((s:any)=>s.method==="GET"&&s.url_template.startsWith("https://"))).toBe(true);
  });
  it("freezes reuse and safety gates",()=>{
    expect(readme).toContain("reuse pass rate >= **90%**");
    expect(readme).toContain("LLM calls during reuse = **0**");
    expect(readme).toContain("source-policy violations = **0**");
    expect(readme).toContain("may make **one** repair call");
  });
});
