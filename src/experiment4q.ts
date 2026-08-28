import {readFile,writeFile} from "node:fs/promises";
import {deriveExperiment4qSource} from "./experiment4qDerivation.js";
const source=await readFile(new URL("./experiment4ar.ts",import.meta.url),"utf8");
await writeFile(new URL("./.generated-experiment4q.ts",import.meta.url),deriveExperiment4qSource(source));
const generatedImport="./.generated-experiment4q.js";
await import(generatedImport);
