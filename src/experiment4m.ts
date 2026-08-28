import {readFile,writeFile} from "node:fs/promises";
import {deriveExperiment4mSource} from "./experiment4mDerivation.js";
const source=await readFile(new URL("./experiment4ar.ts",import.meta.url),"utf8");
await writeFile(new URL("./.generated-experiment4m.ts",import.meta.url),deriveExperiment4mSource(source));
const generatedImport="./.generated-experiment4m.js";
await import(generatedImport);
