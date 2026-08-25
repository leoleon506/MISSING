import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const cfg=JSON.parse(readFileSync("experiments/experiment-1d/config.json","utf8"));
const readme=readFileSync("experiments/experiment-1d/README.md","utf8");

describe("Experiment 1D preregistration",()=>{
  it("uses a long real-world observation window",()=>{
    expect(cfg.days).toBeGreaterThanOrEqual(180);
    expect(cfg.min_change_events).toBeGreaterThanOrEqual(50);
  });
  it("requires material schema and repeated churn",()=>{
    expect(cfg.min_schema_changes).toBeGreaterThanOrEqual(10);
    expect(cfg.min_repeat_churn_services).toBeGreaterThanOrEqual(5);
    expect(cfg.min_changed_service_share).toBeGreaterThanOrEqual(0.03);
  });
  it("documents the conservative NO-GO path",()=>{
    expect(readme).toContain("does **not** assume every schema change is breaking");
    expect(readme).toContain("NO_GO_CAPABILITY_CONTINUITY");
    expect(readme).toContain("does not establish a product or moat");
  });
});
