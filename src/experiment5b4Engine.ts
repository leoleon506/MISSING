import {readFile,writeFile} from "node:fs/promises";
import {deriveExperiment5b4Source} from "./experiment5b4Derivation.js";
const source=await readFile(new URL("./experiment4ar.ts",import.meta.url),"utf8");
await writeFile(new URL("./.generated-experiment5b4.ts",import.meta.url),deriveExperiment5b4Source(source));
const generatedImport="./.generated-experiment5b4.js";
await import(generatedImport);
