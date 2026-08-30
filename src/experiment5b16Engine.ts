import {readFile,writeFile} from "node:fs/promises";
import {deriveExperiment5b14PlannerSource} from "./experiment5b14PlannerDerivation.js";
import {deriveExperiment5b16Source} from "./experiment5b16Derivation.js";

const planner=await readFile(new URL("./experiment5b6Planner.ts",import.meta.url),"utf8");
await writeFile(new URL("./.generated-experiment5b14Planner.ts",import.meta.url),deriveExperiment5b14PlannerSource(planner));
const source=await readFile(new URL("./experiment4ar.ts",import.meta.url),"utf8");
const generated=deriveExperiment5b16Source(source).replace("async function rerank(async function rerank(","async function rerank(");
await writeFile(new URL("./.generated-experiment5b16.ts",import.meta.url),generated);
const generatedImport="./.generated-experiment5b16.js";
await import(generatedImport);
