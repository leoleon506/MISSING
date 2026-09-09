import { afterEach, describe, expect, it } from "vitest";
import {
  internalPayerHashes,
  normalizeConsumerEntryChannel,
  payerAddressFromPaymentSignature,
  payerHashFromAddress,
  paymentHashFromSignature,
} from "../src/runtime/consumerTelemetry.js";
import { PUBLIC_ENTRY_CHANNEL_HEADER, publicPaidResolutionHandoff } from "../src/runtime/publicPaidHandoff.js";

const priorEconomicsJson = process.env.MISSING_ECONOMICS_JSON;
const priorInternalPayers = process.env.MISSING_INTERNAL_PAYER_ADDRESSES;

function signatureFor(from: string) {
  return Buffer.from(JSON.stringify({
    x402Version: 2,
    payload: {
      authorization: { from },
      signature: "0xdeadbeef",
    },
  }), "utf8").toString("base64url");
}

afterEach(() => {
  if (priorEconomicsJson === undefined) delete process.env.MISSING_ECONOMICS_JSON;
  else process.env.MISSING_ECONOMICS_JSON = priorEconomicsJson;
  if (priorInternalPayers === undefined) delete process.env.MISSING_INTERNAL_PAYER_ADDRESSES;
  else process.env.MISSING_INTERNAL_PAYER_ADDRESSES = priorInternalPayers;
});

describe("public consumer telemetry contracts", () => {
  it("extracts the x402 payer but persists only a deterministic hash", () => {
    const payer = "0x834D092974A1766C792ABa3Af2387aD75E3f2C3B";
    const signature = signatureFor(payer);
    expect(payerAddressFromPaymentSignature(signature)).toBe(payer.toLowerCase());
    expect(payerHashFromAddress(payer)).toMatch(/^[0-9a-f]{64}$/);
    expect(payerHashFromAddress(payer)).not.toContain(payer.toLowerCase().slice(2));
    expect(paymentHashFromSignature(signature)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("classifies internal wallets from an explicit operator allowlist", () => {
    const internal = "0x834D092974A1766C792ABa3Af2387aD75E3f2C3B";
    const other = "0x1111111111111111111111111111111111111111";
    process.env.MISSING_INTERNAL_PAYER_ADDRESSES = `${internal}, ${other}`;
    const hashes = internalPayerHashes();
    expect(hashes.size).toBe(2);
    expect(hashes.has(payerHashFromAddress(internal)!)).toBe(true);
    expect(hashes.has(payerHashFromAddress(other)!)).toBe(true);
  });

  it("normalizes only known attribution channels", () => {
    expect(normalizeConsumerEntryChannel("MCP")).toBe("mcp");
    expect(normalizeConsumerEntryChannel("a2a")).toBe("a2a");
    expect(normalizeConsumerEntryChannel("bazaar")).toBe("bazaar");
    expect(normalizeConsumerEntryChannel(undefined)).toBe("http");
    expect(normalizeConsumerEntryChannel("spoofed-client")).toBe("unknown");
  });

  it("returns the entry-channel header in paid MCP/A2A handoffs", () => {
    const fingerprint = "3b3d8e080a59f5f341c4faf6f035b5336343c16af162424854bdb3017f64bfb6";
    process.env.MISSING_ECONOMICS_JSON = JSON.stringify({
      recipes: {
        [fingerprint]: { provider_cost_microusd: 0, customer_price_microusd: 5000 },
      },
    });
    const mcp = publicPaidResolutionHandoff("ip_geolocation_metadata", { ip_address: "1.1.1.1" }, "mcp") as any;
    const a2a = publicPaidResolutionHandoff("ip_geolocation_metadata", { ip_address: "1.1.1.1" }, "a2a") as any;
    expect(mcp.status).toBe("payment_required");
    expect(mcp.request_headers[PUBLIC_ENTRY_CHANNEL_HEADER]).toBe("mcp");
    expect(a2a.request_headers[PUBLIC_ENTRY_CHANNEL_HEADER]).toBe("a2a");
  });
});
