import { afterEach, describe, expect, it, vi } from "vitest";
import { projectRecipeOutput, renderRecipeUrl, resetRuntimeHealth, resolveCapability } from "../src/runtime/executor.js";
import { VERIFIED_RECIPES } from "../src/runtime/recipes.js";

afterEach(() => { vi.unstubAllGlobals(); resetRuntimeHealth(); });

describe("MISSING product alpha runtime", () => {
  it("seeds only replay-verified healthy recipes", () => {
    expect(VERIFIED_RECIPES).toHaveLength(6);
    expect(VERIFIED_RECIPES.some(r => r.capability === "english_word_definition_metadata")).toBe(false);
    expect(VERIFIED_RECIPES.every(r => r.verification.status === "replay_verified")).toBe(true);
  });

  it("renders path and query bindings deterministically", () => {
    const pokemon = VERIFIED_RECIPES.find(r => r.capability === "pokemon_name_metadata")!;
    expect(renderRecipeUrl(pokemon, { pokemon_name: "mr mime" })).toBe("https://pokeapi.co/api/v2/pokemon/mr%20mime");
    const tv = VERIFIED_RECIPES.find(r => r.capability === "television_show_metadata")!;
    expect(renderRecipeUrl(tv, { show_name: "Breaking Bad" })).toBe("https://api.tvmaze.com/search/shows?q=Breaking+Bad");
  });

  it("projects required outputs", () => {
    const ip = VERIFIED_RECIPES.find(r => r.capability === "ip_geolocation_metadata")!;
    expect(projectRecipeOutput(ip, { ip_address: "1.1.1.1" }, { country_code: "AU", country: "Australia" })).toEqual({ ip_address: "1.1.1.1", country_code: "AU", country_name: "Australia" });
  });

  it("returns unavailable instead of inventing an unverified recipe", async () => {
    const result = await resolveCapability("english_word_definition_metadata", { word: "world" });
    expect(result.status).toBe("unavailable");
    expect(result.attempts).toEqual([]);
  });

  it("executes a replay-verified recipe and returns projected data", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ id: 1, height: 7 }), { status: 200 })));
    const result = await resolveCapability("pokemon_name_metadata", { pokemon_name: "bulbasaur" });
    expect(result.status).toBe("resolved");
    if (result.status === "resolved") {
      expect(result.provider).toBe("Pokéapi");
      expect(result.output).toEqual({ name: "bulbasaur", id: 1, height: 7 });
      expect(result.attempts).toHaveLength(1);
    }
  });
});
