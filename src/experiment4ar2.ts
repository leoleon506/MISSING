import {readFile,writeFile} from "node:fs/promises";

const sourceUrl=new URL("./experiment4ar.ts",import.meta.url);
const generatedUrl=new URL("./.generated-experiment4ar2.ts",import.meta.url);
let s=await readFile(sourceUrl,"utf8");
const replace=(from:string,to:string)=>{if(!s.includes(from))throw new Error(`4ar2_derivation_anchor_missing:${from.slice(0,80)}`);s=s.replace(from,to);};
replace('import {synthesize4ar} from "./experiment4arPlanner.js";','import {synthesize4ar2} from "./experiment4ar2Planner.js";\nimport {auditProviderBlindSource} from "./experiment4ar2Core.js";');
replace('const OUT="results/experiment-4ar"','const OUT="results/experiment-4ar2"');
s=s.replaceAll('synthesize4ar(config','synthesize4ar2(config');
replace('plannerSource=await readFile(new URL("./experiment4arPlanner.ts",import.meta.url),"utf8")','plannerSource=await readFile(new URL("./experiment4ar2Planner.ts",import.meta.url),"utf8")');
replace('seedFree=!/https?:\\/\\/(?!api\\.openai\\.com)/i.test(coreSource+plannerSource+contractSource)&&!/(if\\s*\\([^\\n]*case_id|switch\\s*\\([^\\n]*case_id)/.test(coreSource+plannerSource+contractSource)','seedFree=auditProviderBlindSource([coreSource,plannerSource,contractSource]).clean');
replace('"GO_4A_R_BREADTH_RECOVERY":"REASSESS_4A_R_BREADTH_RECOVERY"','"GO_4A_R2_TYPED_IR_RECOVERY":"REASSESS_4A_R2_TYPED_IR_RECOVERY"');
replace('experiment:"4A-R",purpose:"development_breadth_recovery"','experiment:"4A-R2",purpose:"development_typed_ir_recovery"');
replace('base_sha:"9038f5591be396a44f1971520288ddec64098141"','base_sha:"d8b7b0f2b0d4269d6bd39a7509089e75fe41c596"');
await writeFile(generatedUrl,s);
await import("./.generated-experiment4ar2.js");
