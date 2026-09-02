import { describe, expect, it } from "vitest";
import { agentRequestHash, canonicalAgentRequest, requestBindingStatus } from "../src/runtime/requestBinding.js";

describe("Product Kappa.5.2 request binding", () => {
  it("is deterministic across object key order including nested objects", () => {
    const a = agentRequestHash("example_capability", {
      z: 1,
      nested: { beta: true, alpha: "x" },
      list: [{ b: 2, a: 1 }, "tail"],
    });
    const b = agentRequestHash("example_capability", {
      list: [{ a: 1, b: 2 }, "tail"],
      nested: { alpha: "x", beta: true },
      z: 1,
    });
    expect(a).toBe(b);
    expect(canonicalAgentRequest("example_capability", { b: 2, a: 1 })).toBe('{"capability":"example_capability","input":{"a":1,"b":2}}');
  });

  it("changes when capability, input value, or array order changes", () => {
    const base = agentRequestHash("capability_a", { country: "NZ", values: [1, 2] });
    expect(agentRequestHash("capability_b", { country: "NZ", values: [1, 2] })).not.toBe(base);
    expect(agentRequestHash("capability_a", { country: "US", values: [1, 2] })).not.toBe(base);
    expect(agentRequestHash("capability_a", { country: "NZ", values: [2, 1] })).not.toBe(base);
  });

  it("normalizes negative zero but rejects values outside the JSON request contract", () => {
    expect(agentRequestHash("example_capability", { value: -0 })).toBe(agentRequestHash("example_capability", { value: 0 }));
    expect(() => agentRequestHash("example_capability", { value: Number.NaN })).toThrow(/non-finite/i);
    expect(() => agentRequestHash("example_capability", { value: undefined })).toThrow(/undefined field/i);
  });

  it("classifies exact, mismatched, and legacy-unbound payment records", () => {
    const current = agentRequestHash("example_capability", { value: 1 });
    expect(requestBindingStatus(current, current)).toBe("match");
    expect(requestBindingStatus(agentRequestHash("example_capability", { value: 2 }), current)).toBe("mismatch");
    expect(requestBindingStatus(null, current)).toBe("legacy_unbound");
    expect(requestBindingStatus(undefined, current)).toBe("legacy_unbound");
  });
});
