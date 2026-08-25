import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const readme=readFileSync("experiments/experiment-2b/README.md","utf8");
const cases=JSON.parse(readFileSync("experiments/experiment-2b/cases.json","utf8"));
const sources=JSON.parse(readFileSync("experiments/experiment-2b/sources.json","utf8"));

describe("Experiment 2B preregistration",()=>{
  it("uses six fresh safe compositions and two unsafe controls",()=>{
    expect(cases.filter((c:any)=>c.expected==="BUILD").length).toBe(6);
    expect(cases.filter((c:any)=>c.expected==="REJECT").length).toBeGreaterThanOrEqual(2);
    expect(cases.some((c:any)=>c.capability_id==="npm_repo_stars")).toBe(false);
    expect(new Set(cases.filter((c:any)=>c.expected==="BUILD").map((c:any)=>c.family)).size).toBeGreaterThanOrEqual(5);
  });

  it("uses only preapproved HTTPS GET sources and explicit parameter modes",()=>{
    expect(sources.length).toBeGreaterThanOrEqual(6);
    expect(sources.every((s:any)=>s.method==="GET"&&s.url_template.startsWith("https://"))).toBe(true);
    expect(sources.every((s:any)=>s.parameters.every((p:string)=>["component","path"].includes(s.parameter_modes?.[p]??"component")))).toBe(true);
  });

  it("freezes the composition, reuse, and safety gates",()=>{
    expect(readme).toContain("safe static-valid build rate >= **80%**");
    expect(readme).toContain("composition build success rate >= **80%**");
    expect(readme).toContain("live validation pass rate >= **95%**");
    expect(readme).toContain("independent reuse pass rate >= **95%**");
    expect(readme).toContain("LLM calls during reuse = **0**");
    expect(readme).toContain("transform-policy violations = **0**");
    expect(readme).toContain("at least **3 distinct source-pair families**");
  });
});
