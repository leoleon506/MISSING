import {readFile,writeFile} from "node:fs/promises";
import {deriveExperiment4sSource} from "./experiment4sDerivation.js";
const source=await readFile(new URL("./experiment4ar.ts",import.meta.url),"utf8");
await writeFile(new URL("./.generated-experiment4s.ts",import.meta.url),deriveExperiment4sSource(source));
const generatedImport="./.generated-experiment4s.js";
await import(generatedImport);
