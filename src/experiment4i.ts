import {readFile,writeFile} from "node:fs/promises";
import {deriveExperiment4iSource} from "./experiment4iDerivation.js";
const source=await readFile(new URL("./experiment4ar.ts",import.meta.url),"utf8");
await writeFile(new URL("./.generated-experiment4i.ts",import.meta.url),deriveExperiment4iSource(source));
const generatedImport="./.generated-experiment4i.js";
await import(generatedImport);
