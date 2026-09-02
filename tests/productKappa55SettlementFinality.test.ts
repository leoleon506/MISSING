import { afterEach, describe, expect, it, vi } from "vitest";
import { configureX402RpcFetch, x402FinalityPolicy, x402MinConfirmations, x402SettlementProof } from "../src/runtime/x402Reconciliation.js";

const ASSET = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
const PAY_TO = "0x209693Bc6afc0C5328bA36FaF03C514EF312287C";
const FROM = "0x1111111111111111111111111111111111111111";
const TX = `0x${"a".repeat(64)}`;
const BLOCK_HASH = `0x${"b".repeat(64)}`;
const REORG_HASH = `0x${"c".repeat(64)}`;
const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

function topic(address: string) {
  return `0x${"0".repeat(24)}${address.slice(2).toLowerCase()}`;
}

function word(value: bigint) {
  return `0x${value.toString(16).padStart(64, "0")}`;
}

function receipt(blockHash = BLOCK_HASH, blockNumber = "0x64") {
  return {
    status: "0x1",
    blockNumber,
    blockHash,
    logs: [{
      address: ASSET,
      topics: [TRANSFER_TOPIC, topic(FROM), topic(PAY_TO)],
      data: word(5000n),
      logIndex: "0x0",
    }],
  };
}

type Scenario = {
  firstReceipt?: unknown;
  secondReceipt?: unknown;
  latestBlock?: string;
  canonicalHash?: string | null;
};

function rpcScenario(scenario: Scenario = {}) {
  let receiptReads = 0;
  return vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? "{}"));
    if (body.method === "eth_chainId") return new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result: "0x14a34" }), { status: 200 });
    if (body.method === "eth_getTransactionReceipt") {
      receiptReads += 1;
      const result = receiptReads === 1 ? (scenario.firstReceipt ?? receipt()) : (scenario.secondReceipt === undefined ? (scenario.firstReceipt ?? receipt()) : scenario.secondReceipt);
      return new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result }), { status: 200 });
    }
    if (body.method === "eth_blockNumber") return new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result: scenario.latestBlock ?? "0x68" }), { status: 200 });
    if (body.method === "eth_getBlockByNumber") {
      const result = scenario.canonicalHash === null ? null : { hash: scenario.canonicalHash ?? BLOCK_HASH };
      return new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result }), { status: 200 });
    }
    throw new Error(`Unexpected RPC method ${body.method}`);
  });
}

async function prove() {
  return x402SettlementProof({ transaction: TX, network: "eip155:84532", asset: ASSET, payTo: PAY_TO, amount: "5000" });
}

afterEach(() => {
  delete process.env.MISSING_X402_RPC_URL;
  delete process.env.MISSING_X402_MIN_CONFIRMATIONS;
  delete process.env.MISSING_X402_FINALITY_POLICIES;
  configureX402RpcFetch();
});

describe("Product Kappa.5.5 settlement finality and reorg resistance", () => {
  it("requires the configured confirmation depth before verification", async () => {
    process.env.MISSING_X402_RPC_URL = "https://rpc.test";
    process.env.MISSING_X402_MIN_CONFIRMATIONS = "6";
    configureX402RpcFetch(rpcScenario({ latestBlock: "0x68" }) as typeof fetch);

    await expect(prove()).resolves.toMatchObject({
      state: "pending",
      reason: "insufficient_confirmations",
      confirmations: 5,
      required_confirmations: 6,
      finality_policy_source: "legacy_global_env",
      block_number: "0x64",
      block_hash: BLOCK_HASH,
    });
  });

  it("verifies after enough confirmations and a stable canonical anchor", async () => {
    process.env.MISSING_X402_RPC_URL = "https://rpc.test";
    process.env.MISSING_X402_MIN_CONFIRMATIONS = "5";
    const rpc = rpcScenario({ latestBlock: "0x68" });
    configureX402RpcFetch(rpc as typeof fetch);

    await expect(prove()).resolves.toMatchObject({
      state: "verified",
      confirmations: 5,
      required_confirmations: 5,
      finality_policy_source: "legacy_global_env",
      block_number: "0x64",
      block_hash: BLOCK_HASH,
    });
    expect(rpc).toHaveBeenCalledTimes(5);
  });

  it("fails closed when the canonical block hash no longer matches the receipt", async () => {
    process.env.MISSING_X402_RPC_URL = "https://rpc.test";
    process.env.MISSING_X402_MIN_CONFIRMATIONS = "2";
    configureX402RpcFetch(rpcScenario({ latestBlock: "0x65", canonicalHash: REORG_HASH }) as typeof fetch);

    await expect(prove()).resolves.toMatchObject({
      state: "failed",
      reason: "reorg_block_hash_mismatch",
      confirmations: 2,
      block_hash: BLOCK_HASH,
    });
  });

  it("fails closed when a previously observed receipt disappears", async () => {
    process.env.MISSING_X402_RPC_URL = "https://rpc.test";
    configureX402RpcFetch(rpcScenario({ secondReceipt: null }) as typeof fetch);

    await expect(prove()).resolves.toMatchObject({ state: "failed", reason: "reorg_receipt_disappeared" });
  });

  it("fails closed when the receipt moves to another block during the proof", async () => {
    process.env.MISSING_X402_RPC_URL = "https://rpc.test";
    configureX402RpcFetch(rpcScenario({ secondReceipt: receipt(REORG_HASH, "0x65") }) as typeof fetch);

    await expect(prove()).resolves.toMatchObject({ state: "failed", reason: "reorg_receipt_moved" });
  });

  it("never verifies a successful receipt without a block anchor", async () => {
    process.env.MISSING_X402_RPC_URL = "https://rpc.test";
    const unanchored = { ...receipt(), blockHash: undefined };
    configureX402RpcFetch(rpcScenario({ firstReceipt: unanchored }) as typeof fetch);

    await expect(prove()).resolves.toMatchObject({ state: "unavailable", reason: "receipt_block_anchor_missing" });
  });

  it("never converts missing or invalid legacy confirmation configuration into 1", () => {
    expect(x402MinConfirmations()).toBeNull();
    expect(x402FinalityPolicy("eip155:84532")).toMatchObject({ ok: true, required_confirmations: 1, source: "builtin" });

    process.env.MISSING_X402_MIN_CONFIRMATIONS = "0";
    expect(x402MinConfirmations()).toBeNull();
    expect(x402FinalityPolicy("eip155:84532")).toEqual({ ok: false, network: "eip155:84532", reason: "invalid_legacy_confirmation_config" });

    process.env.MISSING_X402_MIN_CONFIRMATIONS = "abc";
    expect(x402MinConfirmations()).toBeNull();

    process.env.MISSING_X402_MIN_CONFIRMATIONS = "12";
    expect(x402MinConfirmations()).toBe(12);
    expect(x402FinalityPolicy("eip155:84532")).toMatchObject({ ok: true, required_confirmations: 12, source: "legacy_global_env" });
  });
});
