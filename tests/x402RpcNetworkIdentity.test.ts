import { afterEach, describe, expect, it, vi } from "vitest";
import { productionAdmissionSnapshot } from "../src/runtime/x402.js";
import {
  configureX402RpcIdentityFetch,
  refreshX402RpcNetworkIdentity,
  resetX402RpcNetworkIdentity,
  x402RpcNetworkIdentitySnapshot,
} from "../src/runtime/x402RpcIdentity.js";

function chainRpc(chainIdHex: string) {
  return vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? "{}"));
    expect(body.method).toBe("eth_chainId");
    return new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result: chainIdHex }), { status: 200 });
  });
}

afterEach(() => {
  delete process.env.MISSING_X402_NETWORK;
  delete process.env.MISSING_X402_RPC_URL;
  delete process.env.MISSING_PRODUCTION_ADMISSION_ENABLED;
  configureX402RpcIdentityFetch();
  resetX402RpcNetworkIdentity();
});

describe("RAL1 post-GO x402 RPC network identity hardening", () => {
  it("starts unverified and becomes a match only after eth_chainId proves the configured network", async () => {
    process.env.MISSING_X402_NETWORK = "eip155:8453";
    process.env.MISSING_X402_RPC_URL = "https://mainnet.base.test";

    expect(x402RpcNetworkIdentitySnapshot()).toMatchObject({
      state: "unverified",
      expected_chain_id: "8453",
      actual_chain_id: null,
      rpc_host: "mainnet.base.test",
    });

    configureX402RpcIdentityFetch(chainRpc("0x2105") as typeof fetch);
    await expect(refreshX402RpcNetworkIdentity()).resolves.toMatchObject({
      state: "match",
      network: "eip155:8453",
      expected_chain_id: "8453",
      actual_chain_id: "8453",
      rpc_host: "mainnet.base.test",
      reason: null,
    });
  });

  it("detects Base Sepolia behind a Base mainnet configuration and admission fails closed", async () => {
    process.env.MISSING_X402_NETWORK = "eip155:8453";
    process.env.MISSING_X402_RPC_URL = "https://sepolia.base.test";
    process.env.MISSING_PRODUCTION_ADMISSION_ENABLED = "1";
    configureX402RpcIdentityFetch(chainRpc("0x14a34") as typeof fetch);

    await expect(refreshX402RpcNetworkIdentity()).resolves.toMatchObject({
      state: "mismatch",
      expected_chain_id: "8453",
      actual_chain_id: "84532",
      reason: "network_mismatch",
    });

    const admission = productionAdmissionSnapshot();
    expect(admission.checks.x402_rpc_network_match).toBe(false);
    expect(admission.reasons).toContain("x402_rpc_network_mismatch");
    expect(admission.ready).toBe(false);
  });

  it("invalidates a successful probe when the RPC URL changes", async () => {
    process.env.MISSING_X402_NETWORK = "eip155:8453";
    process.env.MISSING_X402_RPC_URL = "https://rpc-a.test";
    configureX402RpcIdentityFetch(chainRpc("0x2105") as typeof fetch);
    await refreshX402RpcNetworkIdentity();
    expect(x402RpcNetworkIdentitySnapshot().state).toBe("match");

    process.env.MISSING_X402_RPC_URL = "https://rpc-b.test";
    expect(x402RpcNetworkIdentitySnapshot()).toMatchObject({
      state: "unverified",
      rpc_host: "rpc-b.test",
      reason: "not_probed_for_current_configuration",
    });
  });

  it("treats RPC failure as unavailable instead of trusting stale configuration", async () => {
    process.env.MISSING_X402_NETWORK = "eip155:8453";
    process.env.MISSING_X402_RPC_URL = "https://rpc-down.test";
    configureX402RpcIdentityFetch((async () => new Response("down", { status: 503 })) as typeof fetch);

    await expect(refreshX402RpcNetworkIdentity()).resolves.toMatchObject({
      state: "unavailable",
      expected_chain_id: "8453",
      actual_chain_id: null,
      reason: "rpc_http_503",
    });
  });
});
