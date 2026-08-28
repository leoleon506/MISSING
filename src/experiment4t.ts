import {readFile,writeFile} from "node:fs/promises";
import {deriveExperiment4tSource} from "./experiment4tDerivation.js";
const source=await readFile(new URL("./experiment4ar.ts",import.meta.url),"utf8");
await writeFile(new URL("./.generated-experiment4t.ts",import.meta.url),deriveExperiment4tSource(source));
const generatedImport="./.generated-experiment4t.js";
await import(generatedImport);
