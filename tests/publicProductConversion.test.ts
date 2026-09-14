import { describe, expect, it } from "vitest";
import { publicExecutionMetadata } from "../src/mcp/product.js";

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
});
