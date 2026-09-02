export type X402TransactionState = "confirmed" | "failed" | "pending" | "unavailable";
export type X402SettlementProofState = "verified" | "failed" | "pending" | "unavailable";

export interface X402SettlementProof {
  state: X402SettlementProofState;
  reason?: string;
  chain_id?: string;
  transfer_log_index?: number;
}

let rpcFetch: typeof fetch = (...args) => globalThis.fetch(...args);

export function configureX402RpcFetch(fn?: typeof fetch) {
  rpcFetch = fn ?? ((...args) => globalThis.fetch(...args));
}

export function x402RpcUrl(): string | null {
  const explicit = process.env.MISSING_X402_RPC_URL?.trim();
  if (explicit) return explicit;
  return null;
}

async function rpc(method: string, params: unknown[]): Promise<{ ok: true; result: any } | { ok: false; reason: string }> {
  const url = x402RpcUrl();
  if (!url) return { ok: false, reason: "rpc_not_configured" };
  try {
    const response = await rpcFetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    });
    if (!response.ok) return { ok: false, reason: `rpc_http_${response.status}` };
    const body = await response.json() as any;
    if (body?.error) return { ok: false, reason: typeof body.error.message === "string" ? body.error.message : "rpc_error" };
    return { ok: true, result: body?.result };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error) };
  }
}

function normalizeAddress(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toLowerCase();
  return /^0x[0-9a-f]{40}$/.test(trimmed) ? trimmed : null;
}

function expectedChainId(network: string): bigint | null {
  const match = /^eip155:(\d+)$/.exec(network.trim());
  if (!match) return null;
  try { return BigInt(match[1]); } catch { return null; }
}

function hexBigInt(value: unknown): bigint | null {
  if (typeof value !== "string" || !/^0x[0-9a-fA-F]+$/.test(value)) return null;
  try { return BigInt(value); } catch { return null; }
}

function topicAddress(topic: unknown): string | null {
  if (typeof topic !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(topic)) return null;
  return normalizeAddress(`0x${topic.slice(-40)}`);
}

const ERC20_TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

export async function x402SettlementProof(args: {
  transaction: string;
  network: string;
  asset: string;
  payTo: string;
  amount: string;
}): Promise<X402SettlementProof> {
  const expectedChain = expectedChainId(args.network);
  const asset = normalizeAddress(args.asset);
  const payTo = normalizeAddress(args.payTo);
  let amount: bigint;
  try { amount = BigInt(args.amount); } catch { return { state: "failed", reason: "invalid_expected_amount" }; }
  if (expectedChain === null) return { state: "failed", reason: "unsupported_network" };
  if (!asset) return { state: "failed", reason: "invalid_expected_asset" };
  if (!payTo) return { state: "failed", reason: "invalid_expected_recipient" };
  if (amount < 0n) return { state: "failed", reason: "invalid_expected_amount" };

  const chain = await rpc("eth_chainId", []);
  if (!chain.ok) return { state: "unavailable", reason: chain.reason };
  const actualChain = hexBigInt(chain.result);
  if (actualChain === null) return { state: "unavailable", reason: "invalid_chain_id_response" };
  if (actualChain !== expectedChain) return { state: "failed", reason: "network_mismatch", chain_id: String(actualChain) };

  const receiptResult = await rpc("eth_getTransactionReceipt", [args.transaction]);
  if (!receiptResult.ok) return { state: "unavailable", reason: receiptResult.reason, chain_id: String(actualChain) };
  const receipt = receiptResult.result;
  if (!receipt) return { state: "pending", chain_id: String(actualChain) };
  const status = receipt.status;
  if (status === "0x0" || status === 0 || status === "0") return { state: "failed", reason: "transaction_reverted", chain_id: String(actualChain) };
  if (!(status === "0x1" || status === 1 || status === "1")) return { state: "pending", reason: "transaction_status_unknown", chain_id: String(actualChain) };

  const logs = Array.isArray(receipt.logs) ? receipt.logs : [];
  let sawTransfer = false;
  let sawAsset = false;
  let sawRecipient = false;
  for (let index = 0; index < logs.length; index += 1) {
    const log = logs[index] as any;
    const topics = Array.isArray(log?.topics) ? log.topics : [];
    if (String(topics[0] ?? "").toLowerCase() !== ERC20_TRANSFER_TOPIC) continue;
    sawTransfer = true;
    const logAsset = normalizeAddress(log?.address);
    if (logAsset !== asset) continue;
    sawAsset = true;
    const recipient = topicAddress(topics[2]);
    if (recipient !== payTo) continue;
    sawRecipient = true;
    const transferred = hexBigInt(log?.data);
    if (transferred === amount) return { state: "verified", chain_id: String(actualChain), transfer_log_index: index };
  }

  if (!sawTransfer) return { state: "failed", reason: "erc20_transfer_missing", chain_id: String(actualChain) };
  if (!sawAsset) return { state: "failed", reason: "asset_mismatch", chain_id: String(actualChain) };
  if (!sawRecipient) return { state: "failed", reason: "recipient_mismatch", chain_id: String(actualChain) };
  return { state: "failed", reason: "amount_mismatch", chain_id: String(actualChain) };
}

export async function x402TransactionState(transaction: string): Promise<{ state: X402TransactionState; reason?: string }> {
  const receipt = await rpc("eth_getTransactionReceipt", [transaction]);
  if (!receipt.ok) return { state: "unavailable", reason: receipt.reason };
  if (!receipt.result) return { state: "pending" };
  const status = receipt.result.status;
  if (status === "0x1" || status === 1 || status === "1") return { state: "confirmed" };
  if (status === "0x0" || status === 0 || status === "0") return { state: "failed" };
  return { state: "pending" };
}
