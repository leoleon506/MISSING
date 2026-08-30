import {readFile,writeFile} from "node:fs/promises";
import {deriveExperiment5b20PlannerSource} from "./experiment5b20PlannerDerivation.js";
import {deriveExperiment5b20Source} from "./experiment5b20Derivation.js";

const planner=await readFile(new URL("./experiment5b6Planner.ts",import.meta.url),"utf8");
await writeFile(new URL("./.generated-experiment5b20Planner.ts",import.meta.url),deriveExperiment5b20PlannerSource(planner));
const source=await readFile(new URL("./experiment4ar.ts",import.meta.url),"utf8");
const generated=deriveExperiment5b20Source(source).replace("async function rerank(async function rerank(","async function rerank(");
await writeFile(new URL("./.generated-experiment5b20.ts",import.meta.url),generated);
const generatedImport="./.generated-experiment5b20.js";
await import(generatedImport);
