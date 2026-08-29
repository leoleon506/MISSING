import {readFile,writeFile} from "node:fs/promises";
import {deriveExperiment4wSource} from "./experiment4wDerivation.js";
const source=await readFile(new URL("./experiment4ar.ts",import.meta.url),"utf8");
await writeFile(new URL("./.generated-experiment4w.ts",import.meta.url),deriveExperiment4wSource(source));
const generatedImport="./.generated-experiment4w.js";
await import(generatedImport);
