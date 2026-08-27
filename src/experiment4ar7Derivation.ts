import {deriveExperiment4ar6rSource} from "./experiment4ar6rDerivation.js";

const REPLACEMENTS:ReadonlyArray<readonly [string,string]>=[
  ['import {extractFrontierLinks,specSummaryR6R,auditProviderBlindSource} from "./experiment4ar6rRuntime.js";','import {extractFrontierLinks,specSummaryR7,auditProviderBlindSource} from "./experiment4ar7Runtime.js";'],
  ['import {compile4ar6r as compile4ar,project4ar6r as project4ar,scope4ar6r as scope4ar,validate4ar6r as validate4ar,validateProjected4ar6r as validateProjected4ar} from "./experiment4ar6rContract.js";','import {compile4ar7 as compile4ar,project4ar7 as project4ar,scope4ar7 as scope4ar,validate4ar7 as validate4ar,validateProjected4ar7 as validateProjected4ar} from "./experiment4ar7Contract.js";'],
  ['import {synthesize4ar6r as synthesize4ar} from "./experiment4ar6rPlanner.js";','import {synthesize4ar7 as synthesize4ar} from "./experiment4ar7Planner.js";'],
  ['const OUT="results/experiment-4ar6r",MAX_BYTES=FOUR_A_BUDGET.max_bytes;','const OUT="results/experiment-4ar7",MAX_BYTES=FOUR_A_BUDGET.max_bytes;'],
  ['function recordUsage(kind:string,case_id:string,provider:string|null,body:any,latency_ms:number){const parts=Array.isArray(body?.r6r_calls)?body.r6r_calls:[body];const valid=parts.filter((x:any)=>x!=null);if(!valid.length&&latency_ms===0)return;for(let i=0;i<valid.length;i++){const u=usageCost(valid[i]);llmUsage.push({kind:valid.length>1?`${kind}_stage_${i===0?"a":"b"}`:kind,case_id,provider_candidate_id:provider,latency_ms:valid.length?latency_ms/valid.length:latency_ms,...u});}}','function recordUsage(kind:string,case_id:string,provider:string|null,body:any,latency_ms:number){if(body==null&&latency_ms===0)return;const u=usageCost(body);llmUsage.push({kind,case_id,provider_candidate_id:provider,latency_ms,...u});}'],
  ['function specSummary(spec:any,caseId:string,resolvedUrl:string){return specSummaryR6R(spec,caseId,resolvedUrl);}','function specSummary(spec:any,caseId:string,resolvedUrl:string){return specSummaryR7(spec,caseId,resolvedUrl);}'],
  ['"./experiment4ar6rCore.ts"','"./experiment4ar7Core.ts"'],
  ['"./experiment4ar6rRuntime.ts"','"./experiment4ar7Runtime.ts"'],
  ['"./experiment4ar6rPlanner.ts"','"./experiment4ar7Planner.ts"'],
  ['"./experiment4ar6rContract.ts"','"./experiment4ar7Contract.ts"'],
  ['"./experiment4ar6rEvidence.ts"','"./experiment4ar7Graph.ts"'],
  ['"./experiment4ar6rModel.ts"','"./experiment4ar7Model.ts"'],
  [
    'plannerSource=(await readFile(new URL("./experiment4ar7Planner.ts",import.meta.url),"utf8"))+"\\n"+(await readFile(new URL("./experiment4ar7Graph.ts",import.meta.url),"utf8"))+"\\n"+(await readFile(new URL("./experiment4ar7Model.ts",import.meta.url),"utf8"))+"\\n"+(await readFile(new URL("./experiment4ar5Reranker.ts",import.meta.url),"utf8"))',
    'plannerSource=(await readFile(new URL("./experiment4ar7Planner.ts",import.meta.url),"utf8"))+"\\n"+(await readFile(new URL("./experiment4ar7Graph.ts",import.meta.url),"utf8"))+"\\n"+(await readFile(new URL("./experiment4ar7Model.ts",import.meta.url),"utf8"))+"\\n"+(await readFile(new URL("./experiment4ar6rEvidence.ts",import.meta.url),"utf8"))+"\\n"+(await readFile(new URL("./experiment4ar6rModel.ts",import.meta.url),"utf8"))+"\\n"+(await readFile(new URL("./experiment4ar5Reranker.ts",import.meta.url),"utf8"))'
  ],
  ['"GO_4A_R6R_DETERMINISTIC_OPERATION_COMPILER_RECOVERY":"REASSESS_4A_R6R_DETERMINISTIC_OPERATION_COMPILER_RECOVERY"','"GO_4A_R7_PROOF_GRAPH_FEASIBILITY_SOLVER":"REASSESS_4A_R7_PROOF_GRAPH_FEASIBILITY_SOLVER"'],
  ['experiment:"4A-R6R",purpose:"development_deterministic_operation_compiler_recovery"','experiment:"4A-R7",purpose:"development_proof_graph_feasibility_solver"'],
  ['base_sha:"f5c34c8598698ad9ee9e2cff856a298b7dd00690"','base_sha:"aa661eb494a2d1bf4c50ee2987da518d8713ed09"']
];

export function deriveExperiment4ar7Source(source:string){
  let result=deriveExperiment4ar6rSource(source);
  for(const [from,to] of REPLACEMENTS){
    if(!result.includes(from))throw new Error(`4ar7_derivation_anchor_missing:${from.slice(0,160)}`);
    result=result.replace(from,to);
  }
  return result;
}
