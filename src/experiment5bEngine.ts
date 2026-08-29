import {readFile,writeFile} from "node:fs/promises";
import {deriveExperiment5bSource} from "./experiment5bDerivation.js";
const source=await readFile(new URL("./experiment4ar.ts",import.meta.url),"utf8");
await writeFile(new URL("./.generated-experiment5b.ts",import.meta.url),deriveExperiment5bSource(source));
const generatedImport="./.generated-experiment5b.js";
await import(generatedImport);
