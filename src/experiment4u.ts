import {readFile,writeFile} from "node:fs/promises";
import {deriveExperiment4uSource} from "./experiment4uDerivation.js";
const source=await readFile(new URL("./experiment4ar.ts",import.meta.url),"utf8");
await writeFile(new URL("./.generated-experiment4u.ts",import.meta.url),deriveExperiment4uSource(source));
const generatedImport="./.generated-experiment4u.js";
await import(generatedImport);
