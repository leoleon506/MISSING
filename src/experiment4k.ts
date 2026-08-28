import {readFile,writeFile} from "node:fs/promises";
import {deriveExperiment4kSource} from "./experiment4kDerivation.js";
const source=await readFile(new URL("./experiment4ar.ts",import.meta.url),"utf8");
await writeFile(new URL("./.generated-experiment4k.ts",import.meta.url),deriveExperiment4kSource(source));
const generatedImport="./.generated-experiment4k.js";
await import(generatedImport);
