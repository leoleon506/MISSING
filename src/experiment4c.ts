import {readFile,writeFile} from "node:fs/promises";
import {deriveExperiment4cSource} from "./experiment4cDerivation.js";

const source=await readFile(new URL("./experiment4ar.ts",import.meta.url),"utf8");
await writeFile(new URL("./.generated-experiment4c.ts",import.meta.url),deriveExperiment4cSource(source));
const generatedImport="./.generated-experiment4c.js";
await import(generatedImport);
