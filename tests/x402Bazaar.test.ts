import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  enrichX402HttpResultWithBazaar,
  x402BazaarDiscoveryExtension,
} from "../src/runtime/x402Bazaar.js";

function baseRequired() {
  return {
    x402Version: 2 as const,
    error: "PAYMENT-SIGNATURE header is required",
    resource: {
      url: "https://missing.test/v1/agent/resolve",
      description: "Execute MISSING capability ip_geolocation_metadata",
      mimeType: "application/json",
      serviceName: "MISSING",
      tags: ["agents", "capabilities"],
    },
    accepts: [{
      scheme: "exact",
      network: "eip155:8453",
      amount: "5000",
      asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      payTo: "0xe483b6Ac4aCE45eB37508E2049fdC98872893B7D",
      maxTimeoutSeconds: 60,
      extra: { name: "USD Coin", version: "2" },
    }],
    extensions: {},
  };
}

function encoded(value: unknown) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function decoded(value: string) {
  return JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
}

describe("x402 Bazaar discovery metadata", () => {
  it("matches the x402 v2 Bazaar POST JSON discovery shape", () => {
    const extension = x402BazaarDiscoveryExtension({
      capability: "ip_geolocation_metadata",
      input: { ip_address: "1.1.1.1" },
      customerPriceMicrousd: 5000,
    }) as any;

    expect(extension.bazaar.info.input).toEqual({
      type: "http",
      method: "POST",
      bodyType: "json",
      body: {
        capability: "ip_geolocation_metadata",
        input: { ip_address: "1.1.1.1" },
      },
    });
    expect(extension.bazaar.schema.$schema).toBe("https://json-schema.org/draft/2020-12/schema");
    expect(extension.bazaar.schema.properties.input.required).toEqual(["type", "method", "bodyType", "body"]);
    expect(extension.bazaar.schema.properties.input.properties.body.properties.capability).toEqual({
      type: "string",
      const: "ip_geolocation_metadata",
    });
  });

  it("enriches both the 402 body and PAYMENT-REQUIRED header without changing economics", () => {
    const required = baseRequired();
    const result = enrichX402HttpResultWithBazaar({
      status: 402,
      headers: { "PAYMENT-REQUIRED": encoded(required), "Cache-Control": "no-store" },
      body: required,
    }, {
      capability: "ip_geolocation_metadata",
      input: { ip_address: "1.1.1.1" },
    });

    const body = result.body as any;
    const header = decoded(result.headers!["PAYMENT-REQUIRED"]);

    expect(body.extensions.bazaar).toBeTruthy();
    expect(header.extensions.bazaar).toEqual(body.extensions.bazaar);
    expect(body.accepts).toEqual(required.accepts);
    expect(header.accepts).toEqual(required.accepts);
    expect(body.accepts[0].amount).toBe("5000");
    expect(body.accepts[0].network).toBe("eip155:8453");
    expect(body.accepts[0].payTo).toBe("0xe483b6Ac4aCE45eB37508E2049fdC98872893B7D");
    expect(body.extensions.bazaar.info.input.body).toEqual({
      capability: "ip_geolocation_metadata",
      input: { ip_address: "1.1.1.1" },
    });
  });

  it("does not modify non-402 payment outcomes", () => {
    const result = {
      status: 503,
      headers: { "Cache-Control": "no-store" },
      body: { error: "payment_settlement_reconciliation_required", prior_state: "settling" },
    };
    const enriched = enrichX402HttpResultWithBazaar(result, {
      capability: "ip_geolocation_metadata",
      input: { ip_address: "1.1.1.1" },
    });
    expect(enriched).toBe(result);
  });

  it("keeps Bazaar out of the durable financial state machine", () => {
    const paymentsSource = readFileSync(new URL("../src/runtime/agentPayments.ts", import.meta.url), "utf8");
    const distributedSource = readFileSync(new URL("../src/runtime/distributedMoney.ts", import.meta.url), "utf8");
    expect(paymentsSource).not.toContain("x402Bazaar");
    expect(paymentsSource).not.toContain("@x402/extensions/bazaar");
    expect(distributedSource).not.toContain("x402Bazaar");
  });
});
