import {readFile,writeFile} from "node:fs/promises";
import {deriveExperiment4lSource} from "./experiment4lDerivation.js";
const source=await readFile(new URL("./experiment4ar.ts",import.meta.url),"utf8");
await writeFile(new URL("./.generated-experiment4l.ts",import.meta.url),deriveExperiment4lSource(source));
const generatedImport="./.generated-experiment4l.js";
await import(generatedImport);
