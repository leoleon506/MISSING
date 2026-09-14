import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { publicCapabilitySearchResponse, publicExecutionMetadata } from "../src/mcp/product.js";

const originalEconomicsJson = process.env.MISSING_ECONOMICS_JSON;
const originalMinMargin = process.env.MISSING_MIN_MARGIN_MICROUSD;

beforeEach(() => {
  process.env.MISSING_ECONOMICS_JSON = JSON.stringify({
    recipes: {
      "3b3d8e080a59f5f341c4faf6f035b5336343c16af162424854bdb3017f64bfb6": {
        provider_cost_microusd: 0,
        customer_price_microusd: 5000,
      },
    },
  });
  process.env.MISSING_MIN_MARGIN_MICROUSD = "0";
});

afterEach(() => {
  if (originalEconomicsJson === undefined) delete process.env.MISSING_ECONOMICS_JSON;
  else process.env.MISSING_ECONOMICS_JSON = originalEconomicsJson;

  if (originalMinMargin === undefined) delete process.env.MISSING_MIN_MARGIN_MICROUSD;
  else process.env.MISSING_MIN_MARGIN_MICROUSD = originalMinMargin;
});

describe("public capability conversion guidance", () => {
  it("returns a machine-readable resolve_capability next action for a priced verified capability", () => {
    const input = { ip_address: "1.1.1.1" };
    const execution = publicExecutionMetadata("ip_geolocation_metadata", input);

    expect(execution).toMatchObject({
      executable: true,
      execution_tool: "resolve_capability",
      pricing_status: "quoted",
      customer_price_microusd: 5000,
      currency: "USD",
      next_action: {
        tool: "resolve_capability",
        arguments: {
          capability: "ip_geolocation_metadata",
          input,
        },
      },
    });
  });

  it("does not advertise an executable next action when no valid quote exists", () => {
    const execution = publicExecutionMetadata("definitely_missing_capability", { example: true });

    expect(execution).toMatchObject({
      executable: false,
      execution_tool: "resolve_capability",
      pricing_status: "unavailable",
      next_action: null,
    });
  });

  it("clones the advertised example input so callers receive a stable handoff payload", () => {
    const input = { ip_address: "1.1.1.1" };
    const execution = publicExecutionMetadata("ip_geolocation_metadata", input);
    expect(execution.executable).toBe(true);
    if (!execution.executable || !execution.next_action) return;

    expect(execution.next_action.arguments.input).toEqual(input);
    expect(execution.next_action.arguments.input).not.toBe(input);
  });

  it("returns an explicit demand-recording next action when no verified capability matches", () => {
    const query = "reverse geocode latitude longitude into a postal code";
    const response = publicCapabilitySearchResponse(query, 5);

    expect(response).toMatchObject({
      query,
      status: "capability_not_yet_available",
      missing_can_acquire_capability: true,
      matches: [],
      next_action: {
        tool: "record_missing_capability_demand",
        arguments: {
          intent: query,
        },
      },
    });
    expect(response.instruction).toContain("replay-verify");
    expect(response.instruction).toContain("does not guarantee immediate availability");
  });

  it("keeps verified matches on the execution path while still explaining the acquisition fallback", () => {
    const response = publicCapabilitySearchResponse("locate this IP address", 5);

    expect(response.status).toBe("verified_matches_found");
    expect(response.missing_can_acquire_capability).toBe(true);
    expect(response.next_action).toBeNull();
    expect(response.matches.length).toBeGreaterThan(0);
    expect(response.matches.some(match => match.capability === "ip_geolocation_metadata")).toBe(true);
    expect(response.instruction).toContain("record_missing_capability_demand");
  });
});
