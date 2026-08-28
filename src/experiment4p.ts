import {readFile,writeFile} from "node:fs/promises";
import {deriveExperiment4pSource} from "./experiment4pDerivation.js";
const source=await readFile(new URL("./experiment4ar.ts",import.meta.url),"utf8");
await writeFile(new URL("./.generated-experiment4p.ts",import.meta.url),deriveExperiment4pSource(source));
await import("./.generated-experiment4p.js");
