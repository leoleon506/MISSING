import {readFile,writeFile} from "node:fs/promises";
import {deriveExperiment4gSource} from "./experiment4gDerivation.js";
const source=await readFile(new URL("./experiment4ar.ts",import.meta.url),"utf8");
await writeFile(new URL("./.generated-experiment4g.ts",import.meta.url),deriveExperiment4gSource(source));
const generatedImport="./.generated-experiment4g.js";
await import(generatedImport);
