import {readFile,writeFile} from "node:fs/promises";
import {deriveExperiment5b10Source} from "./experiment5b10Derivation.js";
import {deriveExperiment5b10PlannerSource} from "./experiment5b10PlannerDerivation.js";

const planner=await readFile(new URL("./experiment5b6Planner.ts",import.meta.url),"utf8");
await writeFile(new URL("./.generated-experiment5b10Planner.ts",import.meta.url),deriveExperiment5b10PlannerSource(planner));
const source=await readFile(new URL("./experiment4ar.ts",import.meta.url),"utf8");
const generated=deriveExperiment5b10Source(source).replace("async function rerank(async function rerank(","async function rerank(");
await writeFile(new URL("./.generated-experiment5b10.ts",import.meta.url),generated);
const generatedImport="./.generated-experiment5b10.js";
await import(generatedImport);
