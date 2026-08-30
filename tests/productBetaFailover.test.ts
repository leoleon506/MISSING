import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resolveCapability, resetRuntimeHealth, runtimeHealth } from "../src/runtime/executor.js";
import { recipesForCapability } from "../src/runtime/recipes.js";

const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "content-type": "application/json" },
});

describe("Product Beta provider failover", () => {
  beforeEach(() => resetRuntimeHealth());
  afterEach(() => vi.unstubAllGlobals());

  it("registers an independent backup for country_alpha_metadata", () => {
    const recipes = recipesForCapability("country_alpha_metadata");
    expect(recipes.map(r => r.provider)).toEqual(["Warnely", "countries.dev"]);
    expect(new URL(recipes[0].base_url).hostname).not.toBe(new URL(recipes[1].base_url).hostname);
    expect(recipes[1].verification.source).toBe("product_live");
  });

  it("fails over from Warnely to countries.dev in the same resolution", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("warnely.com")) return new Response("upstream unavailable", { status: 503 });
      if (url.includes("countries.dev")) return jsonResponse({ name: "Japan", alpha2Code: "JP", region: "Asia" });
      throw new Error(`Unexpected URL ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await resolveCapability("country_alpha_metadata", { country_code: "JP" });
    expect(result.status).toBe("resolved");
    if (result.status !== "resolved") return;
    expect(result.provider).toBe("countries.dev");
    expect(result.output).toEqual({ country_code: "JP", region: "Asia", country_name: "Japan" });
    expect(result.attempts).toHaveLength(2);
    expect(result.attempts[0]).toMatchObject({ provider: "Warnely", ok: false, http_status: 503 });
    expect(result.attempts[1]).toMatchObject({ provider: "countries.dev", ok: true, http_status: 200 });
  });

  it("opens the failing primary circuit and routes subsequent calls directly to backup", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("warnely.com")) return new Response("upstream unavailable", { status: 503 });
      return jsonResponse({ name: "Japan", alpha2Code: "JP", region: "Asia" });
    });
    vi.stubGlobal("fetch", fetchMock);

    await resolveCapability("country_alpha_metadata", { country_code: "JP" });
    await resolveCapability("country_alpha_metadata", { country_code: "JP" });
    const third = await resolveCapability("country_alpha_metadata", { country_code: "JP" });

    expect(runtimeHealth().find(x => x.provider === "Warnely")?.state).toBe("open");
    expect(third.status).toBe("resolved");
    if (third.status !== "resolved") return;
    expect(third.provider).toBe("countries.dev");
    expect(third.attempts).toHaveLength(1);
    expect(third.attempts[0].provider).toBe("countries.dev");
  });
});
