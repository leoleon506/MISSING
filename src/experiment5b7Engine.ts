import {readFile,writeFile} from "node:fs/promises";
import {deriveExperiment5b7Source} from "./experiment5b7Derivation.js";
import {deriveExperiment5b7PlannerSource} from "./experiment5b7PlannerDerivation.js";
const planner=await readFile(new URL("./experiment5b6Planner.ts",import.meta.url),"utf8");
await writeFile(new URL("./.generated-experiment5b7Planner.ts",import.meta.url),deriveExperiment5b7PlannerSource(planner));
const source=await readFile(new URL("./experiment4ar.ts",import.meta.url),"utf8");
await writeFile(new URL("./.generated-experiment5b7.ts",import.meta.url),deriveExperiment5b7Source(source));
await import("./.generated-experiment5b7.js");
