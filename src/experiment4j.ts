import {readFile,writeFile} from "node:fs/promises";
import {deriveExperiment4jSource} from "./experiment4jDerivation.js";
const source=await readFile(new URL("./experiment4ar.ts",import.meta.url),"utf8");
await writeFile(new URL("./.generated-experiment4j.ts",import.meta.url),deriveExperiment4jSource(source));
const generatedImport="./.generated-experiment4j.js";
await import(generatedImport);
