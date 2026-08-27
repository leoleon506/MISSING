import {deriveExperiment4ar6Source} from "./experiment4ar6Derivation.js";

const REPLACEMENTS:ReadonlyArray<readonly [string,string]>=[
  ['import {extractEvidenceFrontierR5 as extractFrontierLinks,specSummaryR6,auditProviderBlindSource} from "./experiment4ar6Runtime.js";','import {extractFrontierLinks,specSummaryR6R,auditProviderBlindSource} from "./experiment4ar6rRuntime.js";'],
  ['import {compile4ar6 as compile4ar,project4ar6 as project4ar,scope4ar6 as scope4ar,validate4ar6 as validate4ar,validateProjected4ar6 as validateProjected4ar} from "./experiment4ar6Contract.js";','import {compile4ar6r as compile4ar,project4ar6r as project4ar,scope4ar6r as scope4ar,validate4ar6r as validate4ar,validateProjected4ar6r as validateProjected4ar} from "./experiment4ar6rContract.js";'],
  ['import {synthesize4ar6 as synthesize4ar} from "./experiment4ar6Planner.js";','import {synthesize4ar6r as synthesize4ar} from "./experiment4ar6rPlanner.js";'],
  ['const OUT="results/experiment-4ar6",MAX_BYTES=FOUR_A_BUDGET.max_bytes;','const OUT="results/experiment-4ar6r",MAX_BYTES=FOUR_A_BUDGET.max_bytes;'],
  ['function recordUsage(kind:string,case_id:string,provider:string|null,body:any,latency_ms:number){if(body==null&&latency_ms===0)return;const u=usageCost(body);llmUsage.push({kind,case_id,provider_candidate_id:provider,latency_ms,...u});}','function recordUsage(kind:string,case_id:string,provider:string|null,body:any,latency_ms:number){const parts=Array.isArray(body?.r6r_calls)?body.r6r_calls:[body];const valid=parts.filter((x:any)=>x!=null);if(!valid.length&&latency_ms===0)return;for(let i=0;i<valid.length;i++){const u=usageCost(valid[i]);llmUsage.push({kind:valid.length>1?`${kind}_stage_${i===0?"a":"b"}`:kind,case_id,provider_candidate_id:provider,latency_ms:valid.length?latency_ms/valid.length:latency_ms,...u});}}'],
  ['function specSummary(spec:any,caseId:string,resolvedUrl:string){return specSummaryR6(spec,caseId,resolvedUrl);}','function specSummary(spec:any,caseId:string,resolvedUrl:string){return specSummaryR6R(spec,caseId,resolvedUrl);}'],
  ['"./experiment4ar6Core.ts"','"./experiment4ar6rCore.ts"'],
  ['"./experiment4ar6Runtime.ts"','"./experiment4ar6rRuntime.ts"'],
  ['"./experiment4ar6Planner.ts"','"./experiment4ar6rPlanner.ts"'],
  ['"./experiment4ar6Contract.ts"','"./experiment4ar6rContract.ts"'],
  [
    'plannerSource=(await readFile(new URL("./experiment4ar6rPlanner.ts",import.meta.url),"utf8"))+"\\n"+(await readFile(new URL("./experiment4ar5Reranker.ts",import.meta.url),"utf8"))',
    'plannerSource=(await readFile(new URL("./experiment4ar6rPlanner.ts",import.meta.url),"utf8"))+"\\n"+(await readFile(new URL("./experiment4ar6rEvidence.ts",import.meta.url),"utf8"))+"\\n"+(await readFile(new URL("./experiment4ar6rModel.ts",import.meta.url),"utf8"))+"\\n"+(await readFile(new URL("./experiment4ar5Reranker.ts",import.meta.url),"utf8"))'
  ],
  ['"GO_4A_R6_DOCUMENTED_OPERATION_IR_RECOVERY":"REASSESS_4A_R6_DOCUMENTED_OPERATION_IR_RECOVERY"','"GO_4A_R6R_DETERMINISTIC_OPERATION_COMPILER_RECOVERY":"REASSESS_4A_R6R_DETERMINISTIC_OPERATION_COMPILER_RECOVERY"'],
  ['experiment:"4A-R6",purpose:"development_documented_operation_ir_recovery"','experiment:"4A-R6R",purpose:"development_deterministic_operation_compiler_recovery"'],
  ['base_sha:"a5beb7049dcceadcd7e40b6190fa453ba22e4f79"','base_sha:"f5c34c8598698ad9ee9e2cff856a298b7dd00690"']
];

export function deriveExperiment4ar6rSource(source:string){
  let result=deriveExperiment4ar6Source(source);
  for(const [from,to] of REPLACEMENTS){
    if(!result.includes(from))throw new Error(`4ar6r_derivation_anchor_missing:${from.slice(0,150)}`);
    result=result.replace(from,to);
  }
  return result;
}
