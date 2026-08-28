import {readFile,writeFile} from "node:fs/promises";
import {deriveExperiment4hSource} from "./experiment4hDerivation.js";
const source=await readFile(new URL("./experiment4ar.ts",import.meta.url),"utf8");
await writeFile(new URL("./.generated-experiment4h.ts",import.meta.url),deriveExperiment4hSource(source));
await import("./.generated-experiment4h.js");
