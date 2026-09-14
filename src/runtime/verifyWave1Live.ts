import { attemptRecipe } from "./executor.js";
import { WAVE1_VERIFIED_RECIPES } from "./wave1Recipes.js";

const TIMEOUT_MS = 12_000;

async function main() {
  let runs = 0;
  for (const recipe of WAVE1_VERIFIED_RECIPES) {
    if (recipe.verification.source !== "product_live") {
      throw new Error(`${recipe.capability}: Wave 1 recipe must carry product_live verification evidence`);
    }
    const inputs = recipe.verification.verification_inputs;
    if (inputs.length < 2) throw new Error(`${recipe.capability}: at least two live replay inputs are required`);

    for (const input of inputs) {
      const result = await attemptRecipe(recipe, input, TIMEOUT_MS);
      runs += 1;
      if (!result.attempt.ok || !result.output) {
        throw new Error(`${recipe.capability}/${recipe.provider} live replay failed for ${JSON.stringify(input)}: ${result.attempt.error ?? "missing projected output"}`);
      }
      console.log(JSON.stringify({
        capability: recipe.capability,
        provider: recipe.provider,
        input,
        http_status: result.attempt.http_status,
        latency_ms: result.attempt.latency_ms,
        projected_keys: Object.keys(result.output),
      }));
    }
  }

  console.log(JSON.stringify({ status: "GO_CAPABILITY_EXPANSION_WAVE1", recipes: WAVE1_VERIFIED_RECIPES.length, live_replays: runs }));
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
