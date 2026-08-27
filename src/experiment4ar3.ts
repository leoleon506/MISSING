import {readFile,writeFile} from "node:fs/promises";

const sourceUrl=new URL("./experiment4ar.ts",import.meta.url);
const generatedUrl=new URL("./.generated-experiment4ar3.ts",import.meta.url);
let s=await readFile(sourceUrl,"utf8");
const replace=(from:string,to:string)=>{if(!s.includes(from))throw new Error(`4ar3_derivation_anchor_missing:${from.slice(0,100)}`);s=s.replace(from,to);};
replace('import {synthesize4ar} from "./experiment4arPlanner.js";','import {synthesize4ar3} from "./experiment4ar3Planner.js";\nimport {auditProviderBlindSource} from "./experiment4ar3Core.js";');
replace('const OUT="results/experiment-4ar"','const OUT="results/experiment-4ar3"');
s=s.replaceAll('synthesize4ar(config','synthesize4ar3(config');
replace('plannerSource=await readFile(new URL("./experiment4arPlanner.ts",import.meta.url),"utf8")','plannerSource=await readFile(new URL("./experiment4ar3Planner.ts",import.meta.url),"utf8")');
replace('seedFree=!/https?:\\/\\/(?!api\\.openai\\.com)/i.test(coreSource+plannerSource+contractSource)&&!/(if\\s*\\([^\\n]*case_id|switch\\s*\\([^\\n]*case_id)/.test(coreSource+plannerSource+contractSource)','seedFree=auditProviderBlindSource([coreSource,plannerSource,contractSource]).clean');
replace('fingerprints_timestamps_present:recipes.every(r=>r.provider_selection_fingerprint&&r.documentation_fingerprint&&r.contract_fingerprint&&r.projection_fingerprint&&r.recipe_fingerprint&&r.first_verification?.requested_at&&r.confirmation_verification?.requested_at),real_3x_projection:recipes.every(r=>r.projection_kind==="3x_typed_program")','fingerprints_timestamps_present:recipes.length>0&&recipes.every(r=>r.provider_selection_fingerprint&&r.documentation_fingerprint&&r.contract_fingerprint&&r.projection_fingerprint&&r.recipe_fingerprint&&r.first_verification?.requested_at&&r.confirmation_verification?.requested_at),real_3x_projection:recipes.length>0&&recipes.every(r=>r.projection_kind==="3x_typed_program")');
replace('"GO_4A_R_BREADTH_RECOVERY":"REASSESS_4A_R_BREADTH_RECOVERY"','"GO_4A_R3_TYPED_BINDING_RECOVERY":"REASSESS_4A_R3_TYPED_BINDING_RECOVERY"');
replace('experiment:"4A-R",purpose:"development_breadth_recovery"','experiment:"4A-R3",purpose:"development_typed_binding_recovery"');
replace('base_sha:"9038f5591be396a44f1971520288ddec64098141"','base_sha:"2b6718b8625eb257291bcb6df9d2a586f5126346"');
await writeFile(generatedUrl,s);
const generatedImport="./.generated-experiment4ar3.js";
await import(generatedImport);
