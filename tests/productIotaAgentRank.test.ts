import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  agentRankSnapshot,
  configureAgentRankLedger,
  rankRecipesForExecution,
  recordAgentRankAttempt,
  reloadAgentRankFromLedger,
  resetAgentRankForTest,
} from "../src/runtime/agentRank.js";
import { recipesForCapability } from "../src/runtime/recipes.js";

let tempDir: string | null = null;

function useTempLedger() {
  tempDir = mkdtempSync(join(tmpdir(), "missing-iota-"));
  const ledger = join(tempDir, "agentrank.jsonl");
  configureAgentRankLedger(ledger);
  resetAgentRankForTest({ truncateLedger: true });
  return ledger;
}

afterEach(() => {
  delete process.env.MISSING_AGENTRANK_ENABLED;
  configureAgentRankLedger(null);
  resetAgentRankForTest();
  if (tempDir) rmSync(tempDir, { recursive: true, force: true });
  tempDir = null;
});

describe("MISSING Product Iota AgentRank", () => {
  it("preserves registry order during cold start", () => {
    useTempLedger();
    const recipes = recipesForCapability("country_alpha_metadata");
    expect(recipes).toHaveLength(2);
    expect(rankRecipesForExecution(recipes).map(recipe => recipe.provider)).toEqual(recipes.map(recipe => recipe.provider));

    const snapshot = agentRankSnapshot(recipes, "country_alpha_metadata");
    expect(snapshot.capabilities[0]?.routing_mode).toBe("registry_order");
    expect(snapshot.capabilities[0]?.rankings.every(item => item.routing_evidence === "cold_start")).toBe(true);
  });

  it("routes toward the provider with stronger observed reliability and latency", () => {
    useTempLedger();
    const recipes = recipesForCapability("country_alpha_metadata");
    const warnely = recipes.find(recipe => recipe.provider === "Warnely")!;
    const countries = recipes.find(recipe => recipe.provider === "countries.dev")!;

    recordAgentRankAttempt({
      capability: "country_alpha_metadata",
      attempt: { provider: warnely.provider, recipe_fingerprint: warnely.recipe_fingerprint, url: "https://example.test/a", ok: false, http_status: 500, latency_ms: 900, error: "HTTP 500" },
      attemptPosition: 0,
    });
    recordAgentRankAttempt({
      capability: "country_alpha_metadata",
      attempt: { provider: countries.provider, recipe_fingerprint: countries.recipe_fingerprint, url: "https://example.test/b", ok: true, http_status: 200, latency_ms: 120, error: null },
      attemptPosition: 1,
      rescue: true,
    });

    const ranked = rankRecipesForExecution(recipes);
    expect(ranked[0]?.provider).toBe("countries.dev");

    const snapshot = agentRankSnapshot(recipes, "country_alpha_metadata");
    expect(snapshot.capabilities[0]?.routing_mode).toBe("agentrank");
    expect(snapshot.capabilities[0]?.rankings[0]?.provider).toBe("countries.dev");
    expect(snapshot.capabilities[0]?.rankings[0]?.evidence.rescue_successes).toBe(1);
    expect(snapshot.capabilities[0]?.rankings[1]?.evidence.failures).toBe(1);
  });

  it("rehydrates routing evidence from the durable ledger", () => {
    useTempLedger();
    const recipes = recipesForCapability("country_alpha_metadata");
    const countries = recipes.find(recipe => recipe.provider === "countries.dev")!;

    recordAgentRankAttempt({
      capability: "country_alpha_metadata",
      attempt: { provider: countries.provider, recipe_fingerprint: countries.recipe_fingerprint, url: "https://example.test/b", ok: true, http_status: 200, latency_ms: 80, error: null },
      attemptPosition: 0,
    });

    resetAgentRankForTest();
    reloadAgentRankFromLedger();

    const snapshot = agentRankSnapshot(recipes, "country_alpha_metadata");
    const entry = snapshot.capabilities[0]?.rankings.find(item => item.provider === "countries.dev");
    expect(entry?.evidence.observations).toBe(1);
    expect(entry?.evidence.successes).toBe(1);
    expect(entry?.evidence.average_success_latency_ms).toBe(80);
  });

  it("can be disabled without deleting accumulated evidence", () => {
    useTempLedger();
    const recipes = recipesForCapability("country_alpha_metadata");
    const countries = recipes.find(recipe => recipe.provider === "countries.dev")!;
    recordAgentRankAttempt({
      capability: "country_alpha_metadata",
      attempt: { provider: countries.provider, recipe_fingerprint: countries.recipe_fingerprint, url: null, ok: true, http_status: 200, latency_ms: 50, error: null },
      attemptPosition: 0,
    });
    process.env.MISSING_AGENTRANK_ENABLED = "0";
    expect(rankRecipesForExecution(recipes).map(recipe => recipe.provider)).toEqual(recipes.map(recipe => recipe.provider));
    expect(agentRankSnapshot(recipes, "country_alpha_metadata").enabled).toBe(false);
  });
});
