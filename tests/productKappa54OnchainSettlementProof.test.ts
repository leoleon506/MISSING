import { afterEach, describe, expect, it, vi } from "vitest";
import { configureX402RpcFetch, x402SettlementProof } from "../src/runtime/x402Reconciliation.js";

const ASSET = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
const PAY_TO = "0x209693Bc6afc0C5328bA36FaF03C514EF312287C";
const OTHER = "0x1111111111111111111111111111111111111111";
const TX = `0x${"a".repeat(64)}`;
const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

function topic(address: string) {
  return `0x${"0".repeat(24)}${address.slice(2).toLowerCase()}`;
}

function word(value: bigint) {
  return `0x${value.toString(16).padStart(64, "0")}`;
}

function receipt(args: { asset?: string; recipient?: string; amount?: bigint; status?: string; includeTransfer?: boolean } = {}) {
  const includeTransfer = args.includeTransfer ?? true;
  return {
    status: args.status ?? "0x1",
    logs: includeTransfer ? [{
      address: args.asset ?? ASSET,
      topics: [TRANSFER_TOPIC, topic(OTHER), topic(args.recipient ?? PAY_TO)],
      data: word(args.amount ?? 5000n),
      logIndex: "0x0",
    }] : [],
  };
}

function rpcFixture(chainId: string, txReceipt: unknown) {
  return vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? "{}"));
    if (body.method === "eth_chainId") return new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result: chainId }), { status: 200 });
    if (body.method === "eth_getTransactionReceipt") return new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result: txReceipt }), { status: 200 });
    throw new Error(`Unexpected RPC method ${body.method}`);
  });
}

async function prove() {
  return x402SettlementProof({
    transaction: TX,
    network: "eip155:84532",
    asset: ASSET,
    payTo: PAY_TO,
    amount: "5000",
  });
}

afterEach(() => {
  delete process.env.MISSING_X402_RPC_URL;
  configureX402RpcFetch();
});

describe("Product Kappa.5.4 exact on-chain x402 settlement proof", () => {
  it("verifies only the exact ERC20 Transfer on the expected chain", async () => {
    process.env.MISSING_X402_RPC_URL = "https://rpc.test";
    const rpc = rpcFixture("0x14a34", receipt());
    configureX402RpcFetch(rpc as typeof fetch);
    await expect(prove()).resolves.toEqual({ state: "verified", chain_id: "84532", transfer_log_index: 0 });
    expect(rpc).toHaveBeenCalledTimes(2);
  });

  it("fails closed on network mismatch", async () => {
    process.env.MISSING_X402_RPC_URL = "https://rpc.test";
    configureX402RpcFetch(rpcFixture("0x1", receipt()) as typeof fetch);
    await expect(prove()).resolves.toMatchObject({ state: "failed", reason: "network_mismatch", chain_id: "1" });
  });

  it("fails closed when the successful transaction transferred another asset", async () => {
    process.env.MISSING_X402_RPC_URL = "https://rpc.test";
    configureX402RpcFetch(rpcFixture("0x14a34", receipt({ asset: OTHER })) as typeof fetch);
    await expect(prove()).resolves.toMatchObject({ state: "failed", reason: "asset_mismatch" });
  });

  it("fails closed when the recipient differs", async () => {
    process.env.MISSING_X402_RPC_URL = "https://rpc.test";
    configureX402RpcFetch(rpcFixture("0x14a34", receipt({ recipient: OTHER })) as typeof fetch);
    await expect(prove()).resolves.toMatchObject({ state: "failed", reason: "recipient_mismatch" });
  });

  it("fails closed when the amount differs", async () => {
    process.env.MISSING_X402_RPC_URL = "https://rpc.test";
    configureX402RpcFetch(rpcFixture("0x14a34", receipt({ amount: 4999n })) as typeof fetch);
    await expect(prove()).resolves.toMatchObject({ state: "failed", reason: "amount_mismatch" });
  });

  it("does not treat receipt status 1 without a Transfer as payment", async () => {
    process.env.MISSING_X402_RPC_URL = "https://rpc.test";
    configureX402RpcFetch(rpcFixture("0x14a34", receipt({ includeTransfer: false })) as typeof fetch);
    await expect(prove()).resolves.toMatchObject({ state: "failed", reason: "erc20_transfer_missing" });
  });

  it("distinguishes reverted, pending and unavailable settlement evidence", async () => {
    process.env.MISSING_X402_RPC_URL = "https://rpc.test";
    configureX402RpcFetch(rpcFixture("0x14a34", receipt({ status: "0x0" })) as typeof fetch);
    await expect(prove()).resolves.toMatchObject({ state: "failed", reason: "transaction_reverted" });

    configureX402RpcFetch(rpcFixture("0x14a34", null) as typeof fetch);
    await expect(prove()).resolves.toMatchObject({ state: "pending" });

    delete process.env.MISSING_X402_RPC_URL;
    await expect(prove()).resolves.toMatchObject({ state: "unavailable", reason: "rpc_not_configured" });
  });
});
