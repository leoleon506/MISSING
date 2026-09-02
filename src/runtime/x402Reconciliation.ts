import { runDependencyOperation } from "./dependencyBackpressure.js";

export type X402TransactionState = "confirmed" | "failed" | "pending" | "unavailable";
export type X402SettlementProofState = "verified" | "failed" | "pending" | "unavailable";
export type X402FinalityPolicySource = "per_chain_env" | "legacy_global_env" | "builtin";

export interface X402SettlementProof {
  state: X402SettlementProofState;
  reason?: string;
  chain_id?: string;
  transfer_log_index?: number;
  block_number?: string;
  block_hash?: string;
  confirmations?: number;
  required_confirmations?: number;
  finality_policy_source?: X402FinalityPolicySource;
}

export type X402FinalityPolicyResolution =
  | { ok: true; network: string; required_confirmations: number; source: X402FinalityPolicySource }
  | { ok: false; network: string; reason: "unsupported_network" | "invalid_finality_policy_config" | "finality_policy_missing_for_network" | "invalid_legacy_confirmation_config" };

let rpcFetch: typeof fetch = (...args) => globalThis.fetch(...args);

const BUILTIN_FINALITY_POLICIES: Readonly<Record<string, number>> = Object.freeze({
  // Historical/test network used by the Kappa x402 proofs. This explicit
  // chain-scoped compatibility policy replaces the former implicit global 1.
  "eip155:84532": 1,
});

export function configureX402RpcFetch(fn?: typeof fetch) {
  rpcFetch = fn ?? ((...args) => globalThis.fetch(...args));
}

export function x402RpcUrl(): string | null {
  const explicit = process.env.MISSING_X402_RPC_URL?.trim();
  if (explicit) return explicit;
  return null;
}

function strictPositiveInteger(value: unknown): number | null {
  if (typeof value === "number") return Number.isSafeInteger(value) && value >= 1 ? value : null;
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value.trim())) return null;
  const parsed = Number(value.trim());
  return Number.isSafeInteger(parsed) && parsed >= 1 ? parsed : null;
}

/**
 * Legacy compatibility parser. Unlike Kappa.5.5, invalid or missing values never
 * collapse to 1. Production settlement uses x402FinalityPolicy(network).
 */
export function x402MinConfirmations(): number | null {
  if (process.env.MISSING_X402_MIN_CONFIRMATIONS === undefined) return null;
  return strictPositiveInteger(process.env.MISSING_X402_MIN_CONFIRMATIONS);
}

function parsePerChainPolicies(raw: string): Record<string, number> | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const result: Record<string, number> = {};
  for (const [network, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (!/^eip155:\d+$/.test(network)) return null;
    const confirmations = strictPositiveInteger(value);
    if (confirmations === null) return null;
    result[network] = confirmations;
  }
  return result;
}

/**
 * Resolve an exact finality policy for one CAIP-2 EVM network.
 *
 * Precedence is deliberately fail-closed:
 * 1. If MISSING_X402_FINALITY_POLICIES is present, the whole JSON map must be
 *    valid and must contain the requested network. A typo never falls through.
 * 2. The old global MISSING_X402_MIN_CONFIRMATIONS remains accepted only when it
 *    is explicitly present and strictly valid. Invalid values never become 1.
 * 3. A tiny built-in map preserves the historical Base Sepolia proof behavior.
 *    Any other network without operator policy is unavailable, not guessed.
 */
export function x402FinalityPolicy(network: string): X402FinalityPolicyResolution {
  const normalized = network.trim();
  if (!/^eip155:\d+$/.test(normalized)) return { ok: false, network: normalized, reason: "unsupported_network" };

  if (process.env.MISSING_X402_FINALITY_POLICIES !== undefined) {
    const raw = process.env.MISSING_X402_FINALITY_POLICIES.trim();
    const policies = raw ? parsePerChainPolicies(raw) : null;
    if (!policies) return { ok: false, network: normalized, reason: "invalid_finality_policy_config" };
    const confirmations = policies[normalized];
    if (confirmations === undefined) return { ok: false, network: normalized, reason: "finality_policy_missing_for_network" };
    return { ok: true, network: normalized, required_confirmations: confirmations, source: "per_chain_env" };
  }

  if (process.env.MISSING_X402_MIN_CONFIRMATIONS !== undefined) {
    const confirmations = x402MinConfirmations();
    if (confirmations === null) return { ok: false, network: normalized, reason: "invalid_legacy_confirmation_config" };
    return { ok: true, network: normalized, required_confirmations: confirmations, source: "legacy_global_env" };
  }

  const builtin = BUILTIN_FINALITY_POLICIES[normalized];
  if (builtin !== undefined) return { ok: true, network: normalized, required_confirmations: builtin, source: "builtin" };
  return { ok: false, network: normalized, reason: "finality_policy_missing_for_network" };
}

async function rpc(method: string, params: unknown[]): Promise<{ ok: true; result: any } | { ok: false; reason: string }> {
  const url = x402RpcUrl();
  if (!url) return { ok: false, reason: "rpc_not_configured" };
  try {
    const result = await runDependencyOperation("rpc", async () => {
      const response = await rpcFetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      });
      if (!response.ok) throw new Error(`rpc_http_${response.status}`);
      const body = await response.json() as any;
      if (body?.error) throw new Error(typeof body.error.message === "string" ? body.error.message : "rpc_error");
      return body?.result;
    });
    return { ok: true, result };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error) };
  }
}

function normalizeAddress(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toLowerCase();
  return /^0x[0-9a-f]{40}$/.test(trimmed) ? trimmed : null;
}

function normalizeHash(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toLowerCase();
  return /^0x[0-9a-f]{64}$/.test(trimmed) ? trimmed : null;
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

function safeConfirmations(latest: bigint, included: bigint): number | null {
  if (latest < included) return null;
  const value = latest - included + 1n;
  return value <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(value) : Number.MAX_SAFE_INTEGER;
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

  const policy = x402FinalityPolicy(args.network);
  if (!policy.ok) return { state: "unavailable", reason: policy.reason };
  const requiredConfirmations = policy.required_confirmations;
  const policySource = policy.source;
  const policyEvidence = { required_confirmations: requiredConfirmations, finality_policy_source: policySource };

  const chain = await rpc("eth_chainId", []);
  if (!chain.ok) return { state: "unavailable", reason: chain.reason, ...policyEvidence };
  const actualChain = hexBigInt(chain.result);
  if (actualChain === null) return { state: "unavailable", reason: "invalid_chain_id_response", ...policyEvidence };
  if (actualChain !== expectedChain) return { state: "failed", reason: "network_mismatch", chain_id: String(actualChain), ...policyEvidence };

  const receiptResult = await rpc("eth_getTransactionReceipt", [args.transaction]);
  if (!receiptResult.ok) return { state: "unavailable", reason: receiptResult.reason, chain_id: String(actualChain), ...policyEvidence };
  const receipt = receiptResult.result;
  if (!receipt) return { state: "pending", chain_id: String(actualChain), ...policyEvidence };
  const status = receipt.status;
  if (status === "0x0" || status === 0 || status === "0") return { state: "failed", reason: "transaction_reverted", chain_id: String(actualChain), ...policyEvidence };
  if (!(status === "0x1" || status === 1 || status === "1")) return { state: "pending", reason: "transaction_status_unknown", chain_id: String(actualChain), ...policyEvidence };

  const receiptBlockNumber = hexBigInt(receipt.blockNumber);
  const receiptBlockHash = normalizeHash(receipt.blockHash);
  if (receiptBlockNumber === null || !receiptBlockHash) {
    return { state: "unavailable", reason: "receipt_block_anchor_missing", chain_id: String(actualChain), ...policyEvidence };
  }
  const blockNumberHex = `0x${receiptBlockNumber.toString(16)}`;

  const latestResult = await rpc("eth_blockNumber", []);
  if (!latestResult.ok) return { state: "unavailable", reason: latestResult.reason, chain_id: String(actualChain), block_number: blockNumberHex, block_hash: receiptBlockHash, ...policyEvidence };
  const latestBlock = hexBigInt(latestResult.result);
  if (latestBlock === null) return { state: "unavailable", reason: "invalid_latest_block_response", chain_id: String(actualChain), block_number: blockNumberHex, block_hash: receiptBlockHash, ...policyEvidence };
  const confirmations = safeConfirmations(latestBlock, receiptBlockNumber);
  if (confirmations === null) return { state: "pending", reason: "receipt_block_ahead_of_head", chain_id: String(actualChain), block_number: blockNumberHex, block_hash: receiptBlockHash, confirmations: 0, ...policyEvidence };
  if (confirmations < requiredConfirmations) {
    return { state: "pending", reason: "insufficient_confirmations", chain_id: String(actualChain), block_number: blockNumberHex, block_hash: receiptBlockHash, confirmations, ...policyEvidence };
  }

  const canonicalBlockResult = await rpc("eth_getBlockByNumber", [blockNumberHex, false]);
  if (!canonicalBlockResult.ok) return { state: "unavailable", reason: canonicalBlockResult.reason, chain_id: String(actualChain), block_number: blockNumberHex, block_hash: receiptBlockHash, confirmations, ...policyEvidence };
  const canonicalBlockHash = normalizeHash(canonicalBlockResult.result?.hash);
  if (!canonicalBlockHash) return { state: "unavailable", reason: "canonical_block_unavailable", chain_id: String(actualChain), block_number: blockNumberHex, block_hash: receiptBlockHash, confirmations, ...policyEvidence };
  if (canonicalBlockHash !== receiptBlockHash) {
    return { state: "failed", reason: "reorg_block_hash_mismatch", chain_id: String(actualChain), block_number: blockNumberHex, block_hash: receiptBlockHash, confirmations, ...policyEvidence };
  }

  const stableReceiptResult = await rpc("eth_getTransactionReceipt", [args.transaction]);
  if (!stableReceiptResult.ok) return { state: "unavailable", reason: stableReceiptResult.reason, chain_id: String(actualChain), block_number: blockNumberHex, block_hash: receiptBlockHash, confirmations, ...policyEvidence };
  const stableReceipt = stableReceiptResult.result;
  if (!stableReceipt) return { state: "failed", reason: "reorg_receipt_disappeared", chain_id: String(actualChain), block_number: blockNumberHex, block_hash: receiptBlockHash, confirmations, ...policyEvidence };
  const stableBlockNumber = hexBigInt(stableReceipt.blockNumber);
  const stableBlockHash = normalizeHash(stableReceipt.blockHash);
  if (stableBlockNumber !== receiptBlockNumber || stableBlockHash !== receiptBlockHash) {
    return { state: "failed", reason: "reorg_receipt_moved", chain_id: String(actualChain), block_number: blockNumberHex, block_hash: receiptBlockHash, confirmations, ...policyEvidence };
  }
  const stableStatus = stableReceipt.status;
  if (!(stableStatus === "0x1" || stableStatus === 1 || stableStatus === "1")) {
    return { state: "failed", reason: "reorg_receipt_status_changed", chain_id: String(actualChain), block_number: blockNumberHex, block_hash: receiptBlockHash, confirmations, ...policyEvidence };
  }

  const logs = Array.isArray(stableReceipt.logs) ? stableReceipt.logs : [];
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
    if (transferred === amount) {
      return {
        state: "verified",
        chain_id: String(actualChain),
        transfer_log_index: index,
        block_number: blockNumberHex,
        block_hash: receiptBlockHash,
        confirmations,
        ...policyEvidence,
      };
    }
  }

  const evidence = { chain_id: String(actualChain), block_number: blockNumberHex, block_hash: receiptBlockHash, confirmations, ...policyEvidence };
  if (!sawTransfer) return { state: "failed", reason: "erc20_transfer_missing", ...evidence };
  if (!sawAsset) return { state: "failed", reason: "asset_mismatch", ...evidence };
  if (!sawRecipient) return { state: "failed", reason: "recipient_mismatch", ...evidence };
  return { state: "failed", reason: "amount_mismatch", ...evidence };
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
