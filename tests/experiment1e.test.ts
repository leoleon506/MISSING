import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const cfg=JSON.parse(readFileSync("experiments/experiment-1e/config.json","utf8"));
const readme=readFileSync("experiments/experiment-1e/README.md","utf8");

describe("Experiment 1E preregistration",()=>{
  it("uses multiple narrow capability families",()=>{
    expect(cfg.queries.length).toBeGreaterThanOrEqual(6);
    expect(new Set(cfg.queries).size).toBe(cfg.queries.length);
  });
  it("requires meaningful spread",()=>{
    expect(cfg.min_spread_ratio).toBeGreaterThanOrEqual(1.5);
    expect(cfg.min_absolute_spread_usd).toBeGreaterThan(0);
    expect(cfg.min_qualifying_families).toBeGreaterThanOrEqual(3);
  });
  it("documents equivalence and price limitations",()=>{
    expect(readme).toContain("candidate substitutes");
    expect(readme).toContain("does **not** establish functional equivalence");
    expect(readme).toContain("NO_GO_SYNTHETIC_CAPABILITY_SPREAD");
  });
});
