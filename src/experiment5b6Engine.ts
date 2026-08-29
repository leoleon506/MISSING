import {readFile,writeFile} from "node:fs/promises";
import {deriveExperiment5b6Source} from "./experiment5b6Derivation.js";
const source=await readFile(new URL("./experiment4ar.ts",import.meta.url),"utf8");
await writeFile(new URL("./.generated-experiment5b6.ts",import.meta.url),deriveExperiment5b6Source(source));
const generatedImport="./.generated-experiment5b6.js";
await import(generatedImport);
