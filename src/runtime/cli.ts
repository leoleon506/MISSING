import { pathToFileURL } from "node:url";
import { VERIFIED_RECIPES } from "./recipes.js";
import { resolveCapability, runtimeHealth } from "./executor.js";

function usage() {
  console.error(`MISSING Product Alpha\n\nCommands:\n  list\n  health\n  resolve <capability> '<json-input>'\n\nExample:\n  npm run missing -- resolve ip_geolocation_metadata '{"ip_address":"1.1.1.1"}'`);
}

export async function main(argv = process.argv.slice(2)) {
  const [command, capability, rawInput] = argv;
  if (command === "list") {
    console.log(JSON.stringify({ capabilities: VERIFIED_RECIPES.map(r => ({ capability: r.capability, family: r.family, provider: r.provider, example_input: r.example_input })) }, null, 2));
    return;
  }
  if (command === "health") {
    console.log(JSON.stringify({ health: runtimeHealth() }, null, 2));
    return;
  }
  if (command === "resolve" && capability && rawInput) {
    let input: Record<string, unknown>;
    try { input = JSON.parse(rawInput); } catch { throw new Error("Input must be valid JSON"); }
    const result = await resolveCapability(capability, input);
    console.log(JSON.stringify(result, null, 2));
    if (result.status !== "resolved") process.exitCode = 2;
    return;
  }
  usage();
  process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
