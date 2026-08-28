import {readFile,writeFile} from "node:fs/promises";
import {deriveExperiment4oSource} from "./experiment4oDerivation.js";
const source=await readFile(new URL("./experiment4ar.ts",import.meta.url),"utf8");
await writeFile(new URL("./.generated-experiment4o.ts",import.meta.url),deriveExperiment4oSource(source));
const generatedImport="./.generated-experiment4o.js";
await import(generatedImport);
