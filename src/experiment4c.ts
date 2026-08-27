import {readFile,writeFile} from "node:fs/promises";
import {deriveExperiment4cSource} from "./experiment4cDerivation.js";
const source=await readFile(new URL("./experiment4ar.ts",import.meta.url),"utf8");
const generated=deriveExperiment4cSource(source);
const generatedUrl=new URL("./.generated-experiment4c.ts",import.meta.url);
await writeFile(generatedUrl,generated);
await import("./.generated-experiment4c.js");
