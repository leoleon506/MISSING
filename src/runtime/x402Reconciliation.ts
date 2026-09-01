export type X402TransactionState = "confirmed" | "failed" | "pending" | "unavailable";

let rpcFetch: typeof fetch = (...args) => globalThis.fetch(...args);

export function configureX402RpcFetch(fn?: typeof fetch) {
  rpcFetch = fn ?? ((...args) => globalThis.fetch(...args));
}

export function x402RpcUrl(): string | null {
  const explicit = process.env.MISSING_X402_RPC_URL?.trim();
  if (explicit) return explicit;
  return null;
}

export async function x402TransactionState(transaction: string): Promise<{ state: X402TransactionState; reason?: string }> {
  const url = x402RpcUrl();
  if (!url) return { state: "unavailable", reason: "rpc_not_configured" };
  try {
    const response = await rpcFetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_getTransactionReceipt", params: [transaction] }),
    });
    if (!response.ok) return { state: "unavailable", reason: `rpc_http_${response.status}` };
    const body = await response.json() as any;
    if (body?.error) return { state: "unavailable", reason: typeof body.error.message === "string" ? body.error.message : "rpc_error" };
    if (!body?.result) return { state: "pending" };
    const status = body.result.status;
    if (status === "0x1" || status === 1 || status === "1") return { state: "confirmed" };
    if (status === "0x0" || status === 0 || status === "0") return { state: "failed" };
    return { state: "pending" };
  } catch (error) {
    return { state: "unavailable", reason: error instanceof Error ? error.message : String(error) };
  }
}
