import {readFile,writeFile} from "node:fs/promises";
import {deriveExperiment4ar6rSource} from "./experiment4ar6rDerivation.js";

const sourceUrl=new URL("./experiment4ar.ts",import.meta.url);
const generatedUrl=new URL("./.generated-experiment4ar6r.ts",import.meta.url);
const source=await readFile(sourceUrl,"utf8");
const generated=deriveExperiment4ar6rSource(source);
await writeFile(generatedUrl,generated);
const generatedImport="./.generated-experiment4ar6r.js";
await import(generatedImport);
