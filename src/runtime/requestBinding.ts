import { createHash } from "node:crypto";
import type { RuntimeInput } from "./types.js";

const DOMAIN = "MISSING:x402-request:v1\n";

function canonicalValue(value: unknown): unknown {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Request binding cannot hash non-finite numbers");
    return Object.is(value, -0) ? 0 : value;
  }
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (value && typeof value === "object") {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) throw new Error("Request binding accepts JSON objects only");
    const source = value as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(source).sort()) {
      if (source[key] === undefined) throw new Error(`Request binding cannot hash undefined field: ${key}`);
      result[key] = canonicalValue(source[key]);
    }
    return result;
  }
  throw new Error(`Request binding cannot hash value of type ${typeof value}`);
}

export function canonicalAgentRequest(capability: string, input: RuntimeInput): string {
  if (!capability.trim()) throw new Error("Request binding requires capability");
  return JSON.stringify(canonicalValue({ capability, input }));
}

export function agentRequestHash(capability: string, input: RuntimeInput): string {
  return createHash("sha256").update(DOMAIN, "utf8").update(canonicalAgentRequest(capability, input), "utf8").digest("hex");
}

export type RequestBindingStatus = "match" | "mismatch" | "legacy_unbound";

export function requestBindingStatus(storedRequestHash: string | null | undefined, currentRequestHash: string): RequestBindingStatus {
  if (!storedRequestHash) return "legacy_unbound";
  return storedRequestHash === currentRequestHash ? "match" : "mismatch";
}
