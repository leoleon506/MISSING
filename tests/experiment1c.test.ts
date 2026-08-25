import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const cfg=JSON.parse(readFileSync("experiments/experiment-1c/config.json","utf8"));
const readme=readFileSync("experiments/experiment-1c/README.md","utf8");

describe("Experiment 1C preregistration",()=>{
  it("uses multiple real capability queries",()=>{
    expect(cfg.capability_queries.length).toBeGreaterThanOrEqual(5);
    expect(new Set(cfg.capability_queries).size).toBe(cfg.capability_queries.length);
  });
  it("requires nontrivial overlap and joint failures",()=>{
    expect(cfg.min_overlap_hours).toBeGreaterThanOrEqual(24);
    expect(cfg.min_joint_failure_hours).toBeGreaterThanOrEqual(2);
    expect(cfg.behavioral_phi_threshold).toBeGreaterThan(0);
    expect(cfg.joint_failure_multiplier_threshold).toBeGreaterThan(1);
  });
  it("documents the health-check limitation and conservative decision",()=>{
    expect(readme).toContain("availability/handshake correlation");
    expect(readme).toContain("INSUFFICIENT_REAL_EVIDENCE");
    expect(readme).toContain("does not yet prove shared infrastructure causality");
  });
});
