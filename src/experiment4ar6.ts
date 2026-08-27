import {readFile,writeFile} from "node:fs/promises";
import {deriveExperiment4ar6Source} from "./experiment4ar6Derivation.js";

const sourceUrl=new URL("./experiment4ar.ts",import.meta.url);
const generatedUrl=new URL("./.generated-experiment4ar6.ts",import.meta.url);
const source=await readFile(sourceUrl,"utf8");
const generated=deriveExperiment4ar6Source(source);
await writeFile(generatedUrl,generated);
await import("./.generated-experiment4ar6.js");
