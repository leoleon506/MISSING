import { appendFileSync } from "node:fs";
import {
  closeDistributedMoney,
  distributedPayment,
  markDistributedPaymentSettling,
  markDistributedSettlementPending,
  reserveDistributedPayment,
  settleDistributedPayment,
} from "./runtime/distributedMoney.js";
import { x402SettlementProof } from "./runtime/x402Reconciliation.js";

const [mode, paymentHash, requestHash, executionId, capability, probePath, transaction, asset, payTo, amount] = process.argv.slice(2);
if (!mode || !paymentHash || !requestHash || !executionId || !capability || !probePath) {
  throw new Error("usage: experimentKappa57Worker <mode> <paymentHash> <requestHash> <executionId> <capability> <probePath> [transaction] [asset] [payTo] [amount]");
}

async function reserve() {
  return reserveDistributedPayment({ paymentHash, requestHash, executionId, capability });
}

function providerEffect() {
  appendFileSync(probePath, `${paymentHash}\t${executionId}\n`, { encoding: "utf8", flag: "a" });
}

async function toSettling() {
  const changed = await markDistributedPaymentSettling({
    paymentHash,
    executionId,
    customerPriceMicrousd: Number(amount ?? "5000"),
    providerCostMicrousd: 1000,
    grossMarginMicrousd: Number(amount ?? "5000") - 1000,
    providerAttempts: 1,
    unknownProviderCostAttempts: 0,
    resolution: { status: "resolved", recipe_fingerprint: "kappa57-crash-proof" },
    network: "eip155:84532",
  });
  if (!changed.changed) throw new Error("unable to move payment to settling");
}

if (mode === "crash_reserved") {
  const reservation = await reserve();
  if (!reservation.reserved) throw new Error("crash_reserved did not win reservation");
  process.exit(91);
}

if (mode === "crash_after_provider") {
  const reservation = await reserve();
  if (!reservation.reserved) throw new Error("crash_after_provider did not win reservation");
  providerEffect();
  process.exit(92);
}

if (mode === "crash_settling") {
  const reservation = await reserve();
  if (!reservation.reserved) throw new Error("crash_settling did not win reservation");
  providerEffect();
  await toSettling();
  process.exit(93);
}

if (mode === "crash_pending_tx") {
  if (!transaction) throw new Error("crash_pending_tx requires transaction");
  const reservation = await reserve();
  if (!reservation.reserved) throw new Error("crash_pending_tx did not win reservation");
  providerEffect();
  await toSettling();
  const pending = await markDistributedSettlementPending({ paymentHash, executionId, transactionReference: transaction, reason: "kappa57_crash_window" });
  if (!pending.changed) throw new Error("unable to persist settlement transaction");
  process.exit(94);
}

if (mode === "crash_after_commit") {
  if (!transaction || !asset || !payTo || !amount) throw new Error("crash_after_commit requires settlement proof inputs");
  const reservation = await reserve();
  if (!reservation.reserved) throw new Error("crash_after_commit did not win reservation");
  providerEffect();
  await toSettling();
  const pending = await markDistributedSettlementPending({ paymentHash, executionId, transactionReference: transaction, reason: "kappa57_before_commit" });
  if (!pending.changed) throw new Error("unable to persist settlement transaction before commit");
  const proof = await x402SettlementProof({ transaction, network: "eip155:84532", asset, payTo, amount });
  if (proof.state !== "verified") throw new Error(`settlement proof was ${proof.state}:${proof.reason ?? ""}`);
  const committed = await settleDistributedPayment({
    paymentHash,
    executionId,
    transactionReference: transaction,
    responseStatus: 200,
    responseHeaders: {},
    responseBody: { status: "resolved", crash_window: "after_commit_before_response" },
  });
  if (!committed.changed) throw new Error("authoritative settlement commit failed");
  process.exit(95);
}

if (mode === "retry") {
  const reservation = await reserve();
  const row = await distributedPayment(paymentHash);
  process.stdout.write(JSON.stringify({ reserved: reservation.reserved, state: row?.state ?? null, transaction: row?.transaction_reference ?? null }));
  closeDistributedMoney();
  process.exit(0);
}

if (mode === "reconcile") {
  if (!asset || !payTo || !amount) throw new Error("reconcile requires asset/payTo/amount");
  const row = await distributedPayment(paymentHash);
  if (!row || row.state !== "settling" || !row.transaction_reference) throw new Error("reconcile requires a persisted settling transaction");
  const proof = await x402SettlementProof({ transaction: row.transaction_reference, network: row.network ?? "eip155:84532", asset, payTo, amount });
  let changed = false;
  if (proof.state === "verified") {
    const committed = await settleDistributedPayment({
      paymentHash,
      executionId: row.execution_id,
      transactionReference: row.transaction_reference,
      responseStatus: 200,
      responseHeaders: {},
      responseBody: { status: "resolved", recovery: "kappa57" },
    });
    changed = committed.changed;
  }
  process.stdout.write(JSON.stringify({ proof: proof.state, reason: proof.reason ?? null, changed }));
  closeDistributedMoney();
  process.exit(0);
}

throw new Error(`unknown Kappa.5.7 worker mode: ${mode}`);
