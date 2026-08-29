import {readFile,writeFile} from "node:fs/promises";
import {deriveExperiment5b2Source} from "./experiment5b2Derivation.js";
const source=await readFile(new URL("./experiment4ar.ts",import.meta.url),"utf8");
await writeFile(new URL("./.generated-experiment5b2.ts",import.meta.url),deriveExperiment5b2Source(source));
const generatedImport="./.generated-experiment5b2.js";
await import(generatedImport);
