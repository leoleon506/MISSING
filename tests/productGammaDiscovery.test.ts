import { afterEach, describe, expect, it } from "vitest";
import { demandSnapshot, recordDemand, resetDemand, searchCapabilities } from "../src/runtime/discovery.js";

afterEach(() => resetDemand());

describe("MISSING Product Gamma discovery runtime", () => {
  it("ranks known capabilities from natural-language agent intent", () => {
    const results = searchCapabilities("I need IP geolocation and the current provider failed");
    expect(results[0]?.capability).toBe("ip_geolocation_metadata");
    expect(results[0]?.providers).toContain("ipwhois");
    expect(results[0]?.score).toBeGreaterThan(0);
  });

  it("surfaces redundancy in ranking results", () => {
    const results = searchCapabilities("country code and region lookup");
    const country = results.find(result => result.capability === "country_alpha_metadata");
    expect(country?.recipe_count).toBe(2);
    expect(country?.providers).toEqual(["Warnely", "countries.dev"]);
  });

  it("records repeated unknown demand without inventing a capability", () => {
    recordDemand("Validate this Finnish VAT number");
    recordDemand("Validate this Finnish VAT number");
    const snapshot = demandSnapshot();
    expect(snapshot).toHaveLength(1);
    expect(snapshot[0].count).toBe(2);
    expect(snapshot[0].capability).toBeNull();
    expect(snapshot[0].normalized_intent).toBe("validate this finnish vat number");
  });
});
