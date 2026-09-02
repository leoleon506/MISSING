import { mkdir, writeFile } from "node:fs/promises";
import {
  configureX402RpcFetch,
  x402FinalityPolicy,
  x402SettlementProof,
} from "./runtime/x402Reconciliation.js";

const ASSET = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
const PAY_TO = "0x209693Bc6afc0C5328bA36FaF03C514EF312287C";
const TX = `0x${"a".repeat(64)}`;
const BLOCK_HASH = `0x${"b".repeat(64)}`;
const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const FROM = "0x1111111111111111111111111111111111111111";

function topic(address: string) {
  return `0x${"0".repeat(24)}${address.slice(2).toLowerCase()}`;
}

function word(value: bigint) {
  return `0x${value.toString(16).padStart(64, "0")}`;
}

function successfulReceipt() {
  return {
    status: "0x1",
    blockNumber: "0x64",
    blockHash: BLOCK_HASH,
    logs: [{
      address: ASSET,
      topics: [TRANSFER_TOPIC, topic(FROM), topic(PAY_TO)],
      data: word(5000n),
    }],
  };
}

let rpcCalls = 0;
configureX402RpcFetch((async (_input: string | URL | Request, init?: RequestInit) => {
  rpcCalls += 1;
  const body = JSON.parse(String(init?.body ?? "{}"));
  const result = body.method === "eth_chainId" ? "0x14a34"
    : body.method === "eth_getTransactionReceipt" ? successfulReceipt()
    : body.method === "eth_blockNumber" ? "0x68"
    : body.method === "eth_getBlockByNumber" ? { hash: BLOCK_HASH }
    : null;
  return new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result }), { status: 200 });
}) as typeof fetch);

process.env.MISSING_X402_RPC_URL = "https://rpc.kappa516.test";
delete process.env.MISSING_X402_MIN_CONFIRMATIONS;
delete process.env.MISSING_X402_FINALITY_POLICIES;

const builtin = x402FinalityPolicy("eip155:84532");
const unsupported = x402FinalityPolicy("eip155:1");
const callsBeforeUnsupportedProof = rpcCalls;
const unsupportedProof = await x402SettlementProof({ transaction: TX, network: "eip155:1", asset: ASSET, payTo: PAY_TO, amount: "5000" });
const unsupportedMadeNoRpc = rpcCalls === callsBeforeUnsupportedProof;

process.env.MISSING_X402_MIN_CONFIRMATIONS = "0";
const invalidLegacy = x402FinalityPolicy("eip155:84532");
const callsBeforeInvalidLegacyProof = rpcCalls;
const invalidLegacyProof = await x402SettlementProof({ transaction: TX, network: "eip155:84532", asset: ASSET, payTo: PAY_TO, amount: "5000" });
const invalidLegacyMadeNoRpc = rpcCalls === callsBeforeInvalidLegacyProof;

delete process.env.MISSING_X402_MIN_CONFIRMATIONS;
process.env.MISSING_X402_FINALITY_POLICIES = "not-json";
const invalidMap = x402FinalityPolicy("eip155:84532");
const callsBeforeInvalidMapProof = rpcCalls;
const invalidMapProof = await x402SettlementProof({ transaction: TX, network: "eip155:84532", asset: ASSET, payTo: PAY_TO, amount: "5000" });
const invalidMapMadeNoRpc = rpcCalls === callsBeforeInvalidMapProof;

process.env.MISSING_X402_FINALITY_POLICIES = JSON.stringify({ "eip155:1": 12 });
const missingNetwork = x402FinalityPolicy("eip155:84532");
const callsBeforeMissingNetworkProof = rpcCalls;
const missingNetworkProof = await x402SettlementProof({ transaction: TX, network: "eip155:84532", asset: ASSET, payTo: PAY_TO, amount: "5000" });
const missingNetworkMadeNoRpc = rpcCalls === callsBeforeMissingNetworkProof;

process.env.MISSING_X402_FINALITY_POLICIES = JSON.stringify({ "eip155:84532": 5, "eip155:1": 12 });
const explicitPolicy = x402FinalityPolicy("eip155:84532");
const explicitProof = await x402SettlementProof({ transaction: TX, network: "eip155:84532", asset: ASSET, payTo: PAY_TO, amount: "5000" });

const assertions = {
  builtin_policy_is_chain_scoped: builtin.ok === true && builtin.required_confirmations === 1 && builtin.source === "builtin",
  unknown_chain_without_policy_fails_closed_before_rpc:
    unsupported.ok === false && unsupported.reason === "finality_policy_missing_for_network" && unsupportedProof.state === "unavailable" && unsupportedProof.reason === "finality_policy_missing_for_network" && unsupportedMadeNoRpc,
  invalid_legacy_zero_never_falls_back_to_one:
    invalidLegacy.ok === false && invalidLegacy.reason === "invalid_legacy_confirmation_config" && invalidLegacyProof.state === "unavailable" && invalidLegacyMadeNoRpc,
  malformed_policy_map_fails_closed_before_rpc:
    invalidMap.ok === false && invalidMap.reason === "invalid_finality_policy_config" && invalidMapProof.state === "unavailable" && invalidMapMadeNoRpc,
  configured_map_must_cover_exact_network:
    missingNetwork.ok === false && missingNetwork.reason === "finality_policy_missing_for_network" && missingNetworkProof.state === "unavailable" && missingNetworkMadeNoRpc,
  explicit_chain_policy_drives_verification:
    explicitPolicy.ok === true && explicitPolicy.required_confirmations === 5 && explicitPolicy.source === "per_chain_env" && explicitProof.state === "verified" && explicitProof.required_confirmations === 5 && explicitProof.finality_policy_source === "per_chain_env",
};

const passed = Object.values(assertions).every(Boolean);
const artifact = {
  product: "Kappa.5.16",
  invariant: "x402 settlement finality is explicit and chain-scoped; missing or invalid policy never silently degrades to one confirmation and blocks proof before RPC",
  cases: {
    builtin,
    unsupported: { policy: unsupported, proof: unsupportedProof, no_rpc: unsupportedMadeNoRpc },
    invalid_legacy: { policy: invalidLegacy, proof: invalidLegacyProof, no_rpc: invalidLegacyMadeNoRpc },
    invalid_map: { policy: invalidMap, proof: invalidMapProof, no_rpc: invalidMapMadeNoRpc },
    missing_network: { policy: missingNetwork, proof: missingNetworkProof, no_rpc: missingNetworkMadeNoRpc },
    explicit: { policy: explicitPolicy, proof: explicitProof },
  },
  assertions,
  result: passed ? "GO_STRICT_CHAIN_FINALITY_POLICY" : "NO_GO_STRICT_CHAIN_FINALITY_POLICY",
};

await mkdir("artifacts", { recursive: true });
await writeFile("artifacts/product-kappa516-strict-chain-finality-policy.json", `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ result: artifact.result, assertions, rpc_calls: rpcCalls }, null, 2));
configureX402RpcFetch();
if (!passed) process.exitCode = 1;
