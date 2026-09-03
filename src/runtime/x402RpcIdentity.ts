import { runDependencyOperation } from "./dependencyBackpressure.js";

export type X402RpcNetworkIdentityState = "unverified" | "match" | "mismatch" | "unavailable";

export interface X402RpcNetworkIdentitySnapshot {
  state: X402RpcNetworkIdentityState;
  network: string | null;
  expected_chain_id: string | null;
  actual_chain_id: string | null;
  rpc_host: string | null;
  checked_at: string | null;
  reason: string | null;
}

type InternalSnapshot = X402RpcNetworkIdentitySnapshot & { rpc_url: string | null };

let identityFetch: typeof fetch = (...args) => globalThis.fetch(...args);
let lastProbe: InternalSnapshot = {
  state: "unverified",
  network: null,
  expected_chain_id: null,
  actual_chain_id: null,
  rpc_host: null,
  checked_at: null,
  reason: "not_probed",
  rpc_url: null,
};

function rpcUrl(): string | null {
  const value = process.env.MISSING_X402_RPC_URL?.trim();
  return value || null;
}

function rpcHost(url: string | null): string | null {
  if (!url) return null;
  try { return new URL(url).host; } catch { return null; }
}

function expectedChainId(network: string | null): bigint | null {
  if (!network) return null;
  const match = /^eip155:(\d+)$/.exec(network.trim());
  if (!match) return null;
  try { return BigInt(match[1]); } catch { return null; }
}

function hexChainId(value: unknown): bigint | null {
  if (typeof value !== "string" || !/^0x[0-9a-fA-F]+$/.test(value)) return null;
  try { return BigInt(value); } catch { return null; }
}

function external(snapshot: InternalSnapshot): X402RpcNetworkIdentitySnapshot {
  const { rpc_url: _rpcUrl, ...visible } = snapshot;
  return visible;
}

export function configureX402RpcIdentityFetch(fn?: typeof fetch) {
  identityFetch = fn ?? ((...args) => globalThis.fetch(...args));
  resetX402RpcNetworkIdentity();
}

export function resetX402RpcNetworkIdentity() {
  lastProbe = {
    state: "unverified",
    network: null,
    expected_chain_id: null,
    actual_chain_id: null,
    rpc_host: null,
    checked_at: null,
    reason: "not_probed",
    rpc_url: null,
  };
}

export function x402RpcNetworkIdentitySnapshot(network = process.env.MISSING_X402_NETWORK?.trim() || null): X402RpcNetworkIdentitySnapshot {
  const url = rpcUrl();
  const expected = expectedChainId(network);
  if (!url) {
    return {
      state: "unavailable",
      network,
      expected_chain_id: expected === null ? null : String(expected),
      actual_chain_id: null,
      rpc_host: null,
      checked_at: null,
      reason: "rpc_not_configured",
    };
  }
  if (expected === null) {
    return {
      state: "unavailable",
      network,
      expected_chain_id: null,
      actual_chain_id: null,
      rpc_host: rpcHost(url),
      checked_at: null,
      reason: "unsupported_network",
    };
  }
  if (lastProbe.network !== network || lastProbe.rpc_url !== url) {
    return {
      state: "unverified",
      network,
      expected_chain_id: String(expected),
      actual_chain_id: null,
      rpc_host: rpcHost(url),
      checked_at: null,
      reason: "not_probed_for_current_configuration",
    };
  }
  return external(lastProbe);
}

export async function refreshX402RpcNetworkIdentity(network = process.env.MISSING_X402_NETWORK?.trim() || null): Promise<X402RpcNetworkIdentitySnapshot> {
  const url = rpcUrl();
  const expected = expectedChainId(network);
  if (!url || expected === null) {
    const snapshot = x402RpcNetworkIdentitySnapshot(network);
    lastProbe = { ...snapshot, rpc_url: url };
    return snapshot;
  }

  const checkedAt = new Date().toISOString();
  try {
    const result = await runDependencyOperation("rpc", async signal => {
      const response = await identityFetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] }),
        signal,
      });
      if (!response.ok) throw new Error(`rpc_http_${response.status}`);
      const body = await response.json() as any;
      if (body?.error) throw new Error(typeof body.error.message === "string" ? body.error.message : "rpc_error");
      return body?.result;
    });
    const actual = hexChainId(result);
    if (actual === null) {
      lastProbe = {
        state: "unavailable",
        network,
        expected_chain_id: String(expected),
        actual_chain_id: null,
        rpc_host: rpcHost(url),
        checked_at: checkedAt,
        reason: "invalid_chain_id_response",
        rpc_url: url,
      };
      return external(lastProbe);
    }
    const matches = actual === expected;
    lastProbe = {
      state: matches ? "match" : "mismatch",
      network,
      expected_chain_id: String(expected),
      actual_chain_id: String(actual),
      rpc_host: rpcHost(url),
      checked_at: checkedAt,
      reason: matches ? null : "network_mismatch",
      rpc_url: url,
    };
    return external(lastProbe);
  } catch (error) {
    lastProbe = {
      state: "unavailable",
      network,
      expected_chain_id: String(expected),
      actual_chain_id: null,
      rpc_host: rpcHost(url),
      checked_at: checkedAt,
      reason: error instanceof Error ? error.message : String(error),
      rpc_url: url,
    };
    return external(lastProbe);
  }
}
