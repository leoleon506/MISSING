import {readFile,writeFile} from "node:fs/promises";
import {deriveExperiment4fSource} from "./experiment4fDerivation.js";
const source=await readFile(new URL("./experiment4ar.ts",import.meta.url),"utf8");
await writeFile(new URL("./.generated-experiment4f.ts",import.meta.url),deriveExperiment4fSource(source));
const generatedImport="./.generated-experiment4f.js";
await import(generatedImport);
