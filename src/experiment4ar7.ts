import {readFile,writeFile} from "node:fs/promises";
import {deriveExperiment4ar7Source} from "./experiment4ar7Derivation.js";

const sourceUrl=new URL("./experiment4ar.ts",import.meta.url);
const generatedUrl=new URL("./.generated-experiment4ar7.ts",import.meta.url);
const source=await readFile(sourceUrl,"utf8");
const generated=deriveExperiment4ar7Source(source);
await writeFile(generatedUrl,generated);
const generatedImport="./.generated-experiment4ar7.js";
await import(generatedImport);
