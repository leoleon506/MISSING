import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { agentRankSnapshot, configureAgentRankLedger, resetAgentRankForTest } from "../src/runtime/agentRank.js";
import { resolveCapability, resetRuntimeHealth } from "../src/runtime/executor.js";
import { recipesForCapability } from "../src/runtime/recipes.js";

let tempDir: string | null = null;

function setupLedger() {
  tempDir = mkdtempSync(join(tmpdir(), "missing-iota1-"));
  configureAgentRankLedger(join(tempDir, "agentrank.jsonl"));
  resetAgentRankForTest({ truncateLedger: true });
}

async function flushExploration() {
  await new Promise(resolve => setTimeout(resolve, 0));
  await new Promise(resolve => setTimeout(resolve, 0));
}

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.MISSING_AGENTRANK_EXPLORATION_ENABLED;
  delete process.env.MISSING_AGENTRANK_MIN_OBSERVATIONS;
  configureAgentRankLedger(null);
  resetAgentRankForTest();
  resetRuntimeHealth();
  if (tempDir) rmSync(tempDir, { recursive: true, force: true });
  tempDir = null;
});

describe("Product Iota.1 safe provider exploration", () => {
  it("returns the primary result while probing the backup with its verified example input", async () => {
    setupLedger();
    process.env.MISSING_AGENTRANK_EXPLORATION_ENABLED = "1";

    const seen: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      seen.push(url);
      if (url.includes("warnely.com/api/v1/countries/US")) {
        return new Response(JSON.stringify({ country: { name: "United States", region: "North America" } }), { status: 200 });
      }
      if (url.includes("countries.dev/alpha/JP")) {
        return new Response(JSON.stringify({ name: "Japan", alpha2Code: "JP", region: "Asia" }), { status: 200 });
      }
      throw new Error(`Unexpected exploration URL ${url}`);
    }));

    const result = await resolveCapability("country_alpha_metadata", { country_code: "US" });
    expect(result.status).toBe("resolved");
    if (result.status !== "resolved") return;
    expect(result.provider).toBe("Warnely");
    expect(result.output.country_code).toBe("US");
    expect(result.attempts).toHaveLength(1);

    await flushExploration();
    expect(seen).toContain("https://www.warnely.com/api/v1/countries/US");
    expect(seen).toContain("https://countries.dev/alpha/JP");
    expect(seen.some(url => url.includes("countries.dev/alpha/US"))).toBe(false);

    const snapshot = agentRankSnapshot(recipesForCapability("country_alpha_metadata"), "country_alpha_metadata");
    const backup = snapshot.capabilities[0]?.rankings.find(item => item.provider === "countries.dev");
    expect(backup?.evidence.observations).toBe(1);
    expect(backup?.evidence.successes).toBe(1);
  });

  it("stops shadow traffic once the alternate reaches the evidence threshold while allowing mature AgentRank routing", async () => {
    setupLedger();
    process.env.MISSING_AGENTRANK_EXPLORATION_ENABLED = "1";
    process.env.MISSING_AGENTRANK_MIN_OBSERVATIONS = "2";

    const seen: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      seen.push(url);
      if (url.includes("warnely.com")) {
        return new Response(JSON.stringify({ country: { name: "United States", region: "North America" } }), { status: 200 });
      }
      if (url.includes("countries.dev/alpha/JP")) {
        return new Response(JSON.stringify({ name: "Japan", alpha2Code: "JP", region: "Asia" }), { status: 200 });
      }
      if (url.includes("countries.dev/alpha/US")) {
        return new Response(JSON.stringify({ name: "United States", alpha2Code: "US", region: "North America" }), { status: 200 });
      }
      throw new Error(`Unexpected URL ${url}`);
    }));

    await resolveCapability("country_alpha_metadata", { country_code: "US" });
    await flushExploration();
    await resolveCapability("country_alpha_metadata", { country_code: "US" });
    await flushExploration();

    const shadowProbesAfterMaturity = seen.filter(url => url.includes("countries.dev/alpha/JP")).length;
    expect(shadowProbesAfterMaturity).toBe(2);

    const snapshot = agentRankSnapshot(recipesForCapability("country_alpha_metadata"), "country_alpha_metadata");
    expect(snapshot.capabilities[0]?.routing_mode).toBe("agentrank");

    const third = await resolveCapability("country_alpha_metadata", { country_code: "US" });
    await flushExploration();
    expect(third.status).toBe("resolved");

    // No extra shadow example-input probe is allowed after both providers reach
    // the minimum evidence threshold. A later countries.dev /US call is normal
    // AgentRank routing, not exploration.
    expect(seen.filter(url => url.includes("countries.dev/alpha/JP")).length).toBe(2);
    expect(seen.some(url => url.includes("countries.dev/alpha/US"))).toBe(true);
  });
});
