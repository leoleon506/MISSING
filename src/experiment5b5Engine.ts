import {readFile,writeFile} from "node:fs/promises";
import {deriveExperiment5b5Source} from "./experiment5b5Derivation.js";
const source=await readFile(new URL("./experiment4ar.ts",import.meta.url),"utf8");
await writeFile(new URL("./.generated-experiment5b5.ts",import.meta.url),deriveExperiment5b5Source(source));
const generatedImport="./.generated-experiment5b5.js";
await import(generatedImport);
