import { afterEach, describe, expect, it } from "vitest";
import { recordDemand, resetDemand } from "../src/runtime/discovery.js";
import { runThetaOrchestrator, thetaOrchestratorEnabled } from "../src/runtime/orchestrator.js";
import type { OpenApiCompileResult } from "../src/runtime/openApiCompiler.js";
import type { ProviderDiscoveryCandidate } from "../src/runtime/providerDiscovery.js";

function lead(provider = "Example VAT API"): ProviderDiscoveryCandidate {
  return {
    source: "apis_guru", directory_id: "example.com:vat", provider, title: provider,
    description: "Validate VAT numbers", spec_url: "https://specs.example/openapi.json",
    directory_url: "https://apis.guru/example", openapi_version: "3.0.3", score: 0.9,
    matched_terms: ["vat"], demand_intent: "Validate VAT number", normalized_intent: "validate vat number",
  };
}

function ready(l = lead()): OpenApiCompileResult {
  return {
    status: "candidate_ready", lead: l,
    operation: { method: "GET", path: "/vat/{vat_number}", operation_id: "validateVat", summary: "Validate VAT", score: 1, matched_terms: ["vat"] },
    candidate: {
      candidate_id: "theta4_candidate", demand_intent: l.demand_intent, capability: "vat_validation", family: "compliance",
      provider: l.provider, evidence_url: l.spec_url, method: "GET", base_url: "https://vat.example",
      path_template: "/vat/{vat_number}", path_bindings: { vat_number: "$input.vat_number" }, query_bindings: {},
      projection: { valid: { op: "FIELD", path: "valid" } }, required: ["valid"],
      verification_inputs: [{ vat_number: "FI1" }, { vat_number: "FI2" }],
    },
    verification_input_evidence: [], missing: [], reason: null,
  };
}

afterEach(() => {
  delete process.env.MISSING_THETA_ORCHESTRATOR_ENABLED;
  resetDemand();
});

describe("MISSING Product Theta.4 end-to-end orchestrator", () => {
  it("is disabled by default", () => {
    expect(thetaOrchestratorEnabled()).toBe(false);
    process.env.MISSING_THETA_ORCHESTRATOR_ENABLED = "1";
    expect(thetaOrchestratorEnabled()).toBe(true);
  });

  it("returns no_candidates when there is no unresolved demand", async () => {
    const result = await runThetaOrchestrator();
    expect(result.status).toBe("no_candidates");
    expect(result.opportunity).toBeNull();
  });

  it("returns needs_evidence when a lead compiles without two grounded inputs", async () => {
    recordDemand("Validate VAT number", null, "a2a");
    const l = lead();
    const result = await runThetaOrchestrator({
      discoverFn: async () => [l],
      compileFn: async () => ({ ...ready(l), status: "needs_verification_inputs", candidate: { ...ready(l).candidate!, verification_inputs: [] }, missing: ["verification_inputs"], reason: "missing evidence" }),
    });
    expect(result.status).toBe("needs_evidence");
    expect(result.trace.some(step => step.status === "needs_verification_inputs")).toBe(true);
  });

  it("continues past a rejected provider and promotes the next verified candidate", async () => {
    recordDemand("Validate VAT number", null, "mcp");
    const first = lead("Provider One");
    const second = lead("Provider Two");
    const result = await runThetaOrchestrator({
      discoverFn: async () => [first, second],
      compileFn: async l => ready(l),
      acquireFn: async candidate => candidate.provider === "Provider One"
        ? ({ status: "rejected", verification: { candidate_id: candidate.candidate_id, status: "rejected", recipe_fingerprint: "a".repeat(64), capability: candidate.capability, provider: candidate.provider, verified_at: new Date().toISOString(), runs: [], reason: "HTTP 500", recipe: null }, promotion: { promoted: false, reason: "HTTP 500", recipe: null } })
        : ({ status: "promoted", verification: { candidate_id: candidate.candidate_id, status: "verified", recipe_fingerprint: "b".repeat(64), capability: candidate.capability, provider: candidate.provider, verified_at: new Date().toISOString(), runs: [], reason: null, recipe: {} as any }, promotion: { promoted: true, reason: null, recipe: {} as any } }),
    });
    expect(result.status).toBe("promoted");
    expect(result.selected_provider).toBe("Provider Two");
    expect(result.recipe_fingerprint).toBe("b".repeat(64));
  });

  it("returns rejected when every compilable candidate fails", async () => {
    recordDemand("Validate VAT number", null, "a2a");
    const l = lead();
    const result = await runThetaOrchestrator({
      discoverFn: async () => [l],
      compileFn: async () => ready(l),
      acquireFn: async candidate => ({ status: "rejected", verification: { candidate_id: candidate.candidate_id, status: "rejected", recipe_fingerprint: "c".repeat(64), capability: candidate.capability, provider: candidate.provider, verified_at: new Date().toISOString(), runs: [], reason: "projection failed", recipe: null }, promotion: { promoted: false, reason: "projection failed", recipe: null } }),
    });
    expect(result.status).toBe("rejected");
    expect(result.reason).toContain("projection failed");
  });
});
