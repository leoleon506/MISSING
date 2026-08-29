import {readFile,writeFile} from "node:fs/promises";
import {deriveExperiment5b8Source} from "./experiment5b8Derivation.js";
import {deriveExperiment5b8PlannerSource} from "./experiment5b8PlannerDerivation.js";
const planner=await readFile(new URL("./experiment5b6Planner.ts",import.meta.url),"utf8");
await writeFile(new URL("./.generated-experiment5b8Planner.ts",import.meta.url),deriveExperiment5b8PlannerSource(planner));
const source=await readFile(new URL("./experiment4ar.ts",import.meta.url),"utf8");
await writeFile(new URL("./.generated-experiment5b8.ts",import.meta.url),deriveExperiment5b8Source(source));
const generatedImport="./.generated-experiment5b8.js";
await import(generatedImport);
