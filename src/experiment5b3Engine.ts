import {readFile,writeFile} from "node:fs/promises";
import {deriveExperiment5b3Source} from "./experiment5b3Derivation.js";
const source=await readFile(new URL("./experiment4ar.ts",import.meta.url),"utf8");
await writeFile(new URL("./.generated-experiment5b3.ts",import.meta.url),deriveExperiment5b3Source(source));
const generatedImport="./.generated-experiment5b3.js";
await import(generatedImport);
