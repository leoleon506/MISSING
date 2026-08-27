import {readFile,writeFile} from "node:fs/promises";
import {deriveExperiment4eSource} from "./experiment4eDerivation.js";
const source=await readFile(new URL("./experiment4ar.ts",import.meta.url),"utf8");
await writeFile(new URL("./.generated-experiment4e.ts",import.meta.url),deriveExperiment4eSource(source));
const generatedImport="./.generated-experiment4e.js";
await import(generatedImport);
