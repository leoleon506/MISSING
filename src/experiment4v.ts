import {readFile,writeFile} from "node:fs/promises";
import {deriveExperiment4vSource} from "./experiment4vDerivation.js";
const source=await readFile(new URL("./experiment4ar.ts",import.meta.url),"utf8");
await writeFile(new URL("./.generated-experiment4v.ts",import.meta.url),deriveExperiment4vSource(source));
const generatedImport="./.generated-experiment4v.js";
await import(generatedImport);
