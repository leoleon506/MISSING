import {readFile,writeFile} from "node:fs/promises";
import {deriveExperiment4dSource} from "./experiment4dDerivation.js";
const source=await readFile(new URL("./experiment4ar.ts",import.meta.url),"utf8");
await writeFile(new URL("./.generated-experiment4d.ts",import.meta.url),deriveExperiment4dSource(source));
const generatedImport="./.generated-experiment4d.js";
await import(generatedImport);
