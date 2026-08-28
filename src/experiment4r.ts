import {readFile,writeFile} from "node:fs/promises";
import {deriveExperiment4rSource} from "./experiment4rDerivation.js";
const source=await readFile(new URL("./experiment4ar.ts",import.meta.url),"utf8");
await writeFile(new URL("./.generated-experiment4r.ts",import.meta.url),deriveExperiment4rSource(source));
await import("./.generated-experiment4r.js");
