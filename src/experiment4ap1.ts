import {readFile,writeFile} from "node:fs/promises";
import {deriveExperiment4ap1Source} from "./experiment4ap1Derivation.js";

const sourceUrl=new URL("./experiment4ar.ts",import.meta.url);
const generatedUrl=new URL("./.generated-experiment4ap1.ts",import.meta.url);
const source=await readFile(sourceUrl,"utf8");
const generated=deriveExperiment4ap1Source(source);
await writeFile(generatedUrl,generated);
const generatedImport="./.generated-experiment4ap1.js";
await import(generatedImport);
