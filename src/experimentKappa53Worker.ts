import { appendFileSync } from "node:fs";
import { agentRequestHash } from "./runtime/requestBinding.js";
import { closeDistributedMoney, reserveDistributedPayment } from "./runtime/distributedMoney.js";

const [raceId, replicaId, paymentHash, capability, inputB64, probePath] = process.argv.slice(2);
if (!raceId || !replicaId || !paymentHash || !capability || !inputB64 || !probePath) {
  throw new Error("usage: experimentKappa53Worker <raceId> <replicaId> <paymentHash> <capability> <inputB64> <probePath>");
}

const input = JSON.parse(Buffer.from(inputB64, "base64").toString("utf8"));
const requestHash = agentRequestHash(capability, input);
const executionId = `${raceId}-${replicaId}-${process.pid}`;

const reservation = await reserveDistributedPayment({ paymentHash, requestHash, executionId, capability });
if (reservation.reserved) {
  appendFileSync(probePath, `${raceId}\t${replicaId}\t${executionId}\n`, { encoding: "utf8", flag: "a" });
}

process.stdout.write(JSON.stringify({
  race_id: raceId,
  replica: replicaId,
  pid: process.pid,
  payment_hash_prefix: paymentHash.slice(0, 12),
  request_hash_prefix: requestHash.slice(0, 12),
  reservation_won: reservation.reserved,
  prior_state: reservation.prior?.state ?? null,
  execution_id: reservation.reserved ? executionId : null,
}));
closeDistributedMoney();
