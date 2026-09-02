import { createHash } from "node:crypto";
import type { ProviderRecoveryMode } from "./distributedMoney.js";
import type { VerifiedRecipe } from "./types.js";

export interface ProviderRecoveryPolicy {
  mode: ProviderRecoveryMode;
  idempotency_header: string | null;
  reason: string;
}

export function providerRecoveryPolicy(recipe: VerifiedRecipe): ProviderRecoveryPolicy {
  if (recipe.method === "GET") {
    return { mode: "read_only", idempotency_header: null, reason: "GET recipe is replayable without creating a provider-side write" };
  }

  // Fail closed: an idempotency-shaped header is not evidence that the provider
  // deduplicates writes. Only sufficient product_live safe_post evidence may
  // authorize automatic replay of a POST after an ambiguous outcome.
  const safePost = recipe.verification.source === "product_live" ? recipe.verification.safe_post : undefined;
  const explicit = safePost?.signals.find(signal =>
    signal.kind === "idempotency_key"
    && signal.sufficient
    && signal.location === "header"
    && signal.name?.trim(),
  );
  if (explicit?.name) {
    return { mode: "idempotent", idempotency_header: explicit.name, reason: "Verified POST recipe exposes a sufficient provider idempotency header" };
  }

  return { mode: "ambiguous", idempotency_header: null, reason: "POST recipe has no verified idempotency or reconciliation contract" };
}

export function stableProviderIdempotencyKey(paymentHash: string, recipeFingerprint: string): string {
  return createHash("sha256").update(`MISSING:provider-idempotency:v1\n${paymentHash}\n${recipeFingerprint}`, "utf8").digest("hex");
}

export function stableSettlementIntentId(paymentHash: string, requestHash: string): string {
  return createHash("sha256").update(`MISSING:settlement-intent:v1\n${paymentHash}\n${requestHash}`, "utf8").digest("hex");
}
