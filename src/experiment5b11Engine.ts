import {readFile,writeFile} from "node:fs/promises";
import {deriveExperiment5b11Source} from "./experiment5b11Derivation.js";
import {deriveExperiment5b11PlannerSource} from "./experiment5b11PlannerDerivation.js";
const planner=await readFile(new URL("./experiment5b6Planner.ts",import.meta.url),"utf8");
await writeFile(new URL("./.generated-experiment5b11Planner.ts",import.meta.url),deriveExperiment5b11PlannerSource(planner));
const source=await readFile(new URL("./experiment4ar.ts",import.meta.url),"utf8");
const generated=deriveExperiment5b11Source(source).replace("async function rerank(async function rerank(","async function rerank(");
await writeFile(new URL("./.generated-experiment5b11.ts",import.meta.url),generated);
await import("./.generated-experiment5b11.js");
