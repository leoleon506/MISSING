import { describe, expect, it } from "vitest";
import { underwrite, evaluateScenarios } from "../src/experiment1b.js";

describe("Experiment 1B capability underwriter",()=>{
  it("accepts an insurable portfolio with failover",()=>{
    const q=underwrite({id:"x",intent:"x",buyer_max_price_usd:0.01,target_success_rate:0.99,max_total_latency_ms:1000,uninsurable:false,providers:[{id:"a",cost_usd:0.001,success_rate:0.9,latency_ms:100},{id:"b",cost_usd:0.002,success_rate:0.95,latency_ms:100}]});
    expect(q.decision).toBe("ACCEPT");expect(q.portfolio.length).toBe(2);expect(q.predicted_success_rate).toBeGreaterThanOrEqual(0.99);
  });
  it("rejects a quote that cannot fit buyer price",()=>{
    const q=underwrite({id:"x",intent:"x",buyer_max_price_usd:0.0001,target_success_rate:0.99,max_total_latency_ms:1000,uninsurable:true,providers:[{id:"a",cost_usd:0.001,success_rate:0.999,latency_ms:100}]});
    expect(q.decision).toBe("REJECT");expect(q.reason).toBe("price_not_insurable");
  });
  it("produces deterministic aggregate evaluation",()=>{
    const s=[{id:"x",intent:"x",buyer_max_price_usd:0.01,target_success_rate:0.98,max_total_latency_ms:1000,uninsurable:false,providers:[{id:"a",cost_usd:0.001,success_rate:0.9,latency_ms:100},{id:"b",cost_usd:0.0015,success_rate:0.95,latency_ms:100}]}];
    const a=evaluateScenarios(s),b=evaluateScenarios(s);expect(a.metrics).toEqual(b.metrics);
  });
});
