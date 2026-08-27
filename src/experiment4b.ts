import {readFile,writeFile} from "node:fs/promises";
import {deriveExperiment4bSource} from "./experiment4bDerivation.js";

const source=await readFile(new URL("./experiment4ar.ts",import.meta.url),"utf8");
await writeFile(new URL("./.generated-experiment4b.ts",import.meta.url),deriveExperiment4bSource(source));
const generatedImport="./.generated-experiment4b.js";
await import(generatedImport);
