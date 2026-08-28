import {readFile,writeFile} from "node:fs/promises";
import {deriveExperiment4nSource} from "./experiment4nDerivation.js";
const source=await readFile(new URL("./experiment4ar.ts",import.meta.url),"utf8");
await writeFile(new URL("./.generated-experiment4n.ts",import.meta.url),deriveExperiment4nSource(source));
const generatedImport="./.generated-experiment4n.js";
await import(generatedImport);
