import { afterEach, describe, expect, it, vi } from "vitest";
import { x402Requirements } from "../src/runtime/x402.js";

const BASE_USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

function configureBaseUsdcX402() {
  vi.stubEnv("MISSING_X402_ENABLED", "1");
  vi.stubEnv("MISSING_PRODUCTION_ADMISSION_ENABLED", "0");
  vi.stubEnv("MISSING_X402_NETWORK", "eip155:8453");
  vi.stubEnv("MISSING_X402_ASSET", BASE_USDC);
  vi.stubEnv("MISSING_X402_PAY_TO", "0x1111111111111111111111111111111111111111");
  vi.stubEnv("MISSING_X402_FACILITATOR_URL", "https://facilitator.example");
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("x402 Base USDC requirements", () => {
  it("advertises the canonical native USDC EIP-712 domain metadata", () => {
    configureBaseUsdcX402();

    const requirements = x402Requirements(10000);

    expect(requirements).toMatchObject({
      scheme: "exact",
      network: "eip155:8453",
      amount: "10000",
      asset: BASE_USDC,
      extra: {
        name: "USD Coin",
        version: "2",
      },
    });
  });
});
