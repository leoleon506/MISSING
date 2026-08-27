export const FOUR_AR6_REPLACEMENTS:ReadonlyArray<readonly [string,string]>=[
  [
    'import {resolveSelected,providerSelectionFingerprint} from "./experiment3vCore.js";',
    'import {resolveSelectedR5 as resolveSelected,providerSelectionFingerprintR5 as providerSelectionFingerprint,callProviderRerankerR5 as callProviderReranker,parseRerankAttemptR5 as parseRerankAttempt} from "./experiment4ar5Reranker.js";'
  ],
  [
    'import {callProviderReranker,parseRerankAttempt} from "./experiment3vPlanner.js";',
    ''
  ],
  [
    'import {extractFrontierLinks,frontierFingerprint} from "./experiment3wrCore.js";',
    'import {frontierFingerprint} from "./experiment3wrCore.js";\nimport {extractEvidenceFrontierR5 as extractFrontierLinks,specSummaryR6,auditProviderBlindSource} from "./experiment4ar6Runtime.js";'
  ],
  [
    'import {compile4ar,project4ar,scope4ar,validate4ar,validateProjected4ar} from "./experiment4arContract.js";',
    'import {compile4ar6 as compile4ar,project4ar6 as project4ar,scope4ar6 as scope4ar,validate4ar6 as validate4ar,validateProjected4ar6 as validateProjected4ar} from "./experiment4ar6Contract.js";'
  ],
  [
    'import {synthesize4ar} from "./experiment4arPlanner.js";',
    'import {synthesize4ar6 as synthesize4ar} from "./experiment4ar6Planner.js";'
  ],
  [
    'const OUT="results/experiment-4ar",MAX_BYTES=FOUR_A_BUDGET.max_bytes;',
    'const OUT="results/experiment-4ar6",MAX_BYTES=FOUR_A_BUDGET.max_bytes;'
  ],
  [
    'function recordUsage(kind:string,case_id:string,provider:string|null,body:any,latency_ms:number){const u=usageCost(body);llmUsage.push({kind,case_id,provider_candidate_id:provider,latency_ms,...u});}',
    'function recordUsage(kind:string,case_id:string,provider:string|null,body:any,latency_ms:number){if(body==null&&latency_ms===0)return;const u=usageCost(body);llmUsage.push({kind,case_id,provider_candidate_id:provider,latency_ms,...u});}'
  ],
  [
    'function specSummary(spec:any){const out:any[]=[];for(const [path,item] of Object.entries(spec?.paths||{}) as any[])for(const method of ["get"]){const op=item?.[method];if(!op)continue;out.push({method:"GET",path,parameters:op.parameters||item.parameters||[],responses:op.responses||{}});}return JSON.stringify({openapi:spec.openapi,swagger:spec.swagger,servers:spec.servers,host:spec.host,basePath:spec.basePath,schemes:spec.schemes,operations:out.slice(0,100)},null,2);}',
    'function specSummary(spec:any,caseId:string,resolvedUrl:string){return specSummaryR6(spec,caseId,resolvedUrl);}'
  ],
  [
    'const got=await fetchTextSafeR2(provider.start_url,item.url,MAX_BYTES,ledger),id=pushEvidence(item.url,got.final_url,got.content_type,got.text,"ok");if(/text\\/html/i.test(got.content_type)){const links=extractFrontierLinks(got.final_url,provider.start_url,got.text,id,scope4ar);frontier.push(...links);for(const l of links.filter(x=>x.accepted).slice(0,16))if(item.depth+1<=FOUR_A_BUDGET.max_doc_depth&&!seen.has(l.target_url))queue.push({url:l.target_url,depth:item.depth+1});}',
    'const got=await fetchTextSafeR2(provider.start_url,item.url,MAX_BYTES,ledger),parsedSpec=parseOpenApiText(got.text),evidenceText=parsedSpec?specSummary(parsedSpec,provider.case_id,got.final_url):got.text,id=pushEvidence(item.url,got.final_url,got.content_type,evidenceText,"ok");if(/text\\/html/i.test(got.content_type)){const links=extractFrontierLinks(got.final_url,provider.start_url,got.text,id,scope4ar,provider.case_id);frontier.push(...links);for(const l of links.filter(x=>x.accepted).slice(0,16))if(item.depth+1<=FOUR_A_BUDGET.max_doc_depth&&!seen.has(l.target_url))queue.push({url:l.target_url,depth:item.depth+1});}'
  ],
  [
    '`Verified API specification at ${got.final_url}\\n${specSummary(spec)}`',
    'specSummary(spec,provider.case_id,got.final_url)'
  ],
  [
    'evidence.push({case_id:p.case_id,provider_candidate_id:p.candidate_id,...a,static_errors:v.errors});',
    'evidence.push({case_id:p.case_id,provider_candidate_id:p.candidate_id,...a,static_errors:v.errors,validated_operation_proof:v.operation_proof??null});'
  ],
  [
    'if(a.parsed_json?.decision==="REJECT"&&!v.errors.length)return {contract:a.parsed_json,projection:null,error:null};',
    'if(a.parsed_json?.decision==="REJECT"&&!v.errors.length)return {contract:a.parsed_json,projection:null,error:null,operation_proof:null};'
  ],
  [
    'evidence.push({case_id:p.case_id,provider_candidate_id:p.candidate_id,...b,static_errors:v.errors});',
    'evidence.push({case_id:p.case_id,provider_candidate_id:p.candidate_id,...b,static_errors:v.errors,validated_operation_proof:v.operation_proof??null});'
  ],
  [
    'return {contract:v.errors.length?null:v.contract,projection:v.errors.length?null:v.projection,error:v.errors.join(",")||null};',
    'return {contract:v.errors.length?null:v.contract,projection:v.errors.length?null:v.projection,error:v.errors.join(",")||null,operation_proof:v.errors.length?null:(v.operation_proof??null)};'
  ],
  [
    'return {contract:v.contract,projection:v.projection,error:null};',
    'return {contract:v.contract,projection:v.projection,error:null,operation_proof:v.operation_proof??null};'
  ],
  [
    'frontier_fingerprint:frontierFingerprint(cr.frontier),contract,contract_fingerprint:sha3yr(contract)',
    'frontier_fingerprint:frontierFingerprint(cr.frontier),documented_operation_proof:syn.operation_proof,contract,contract_fingerprint:sha3yr(contract)'
  ],
  [
    'selected:selected.map((x:any)=>({candidate_id:x.candidate_id,name:x.name,rank:x.lexical_rank}))',
    'selected:selected.map((x:any)=>({candidate_id:x.candidate_id,name:x.name,rank:x.lexical_rank,r5_score:x.r5_score,r5_functional_fit:x.r5_functional_fit,r5_evidence_likelihood:x.r5_evidence_likelihood,r5_anonymous_get_likelihood:x.r5_anonymous_get_likelihood}))'
  ],
  [
    'coreSource=await readFile(new URL("./experiment4arCore.ts",import.meta.url),"utf8"),plannerSource=await readFile(new URL("./experiment4arPlanner.ts",import.meta.url),"utf8"),contractSource=await readFile(new URL("./experiment4arContract.ts",import.meta.url),"utf8"),seedFree=!/https?:\\/\\/(?!api\\.openai\\.com)/i.test(coreSource+plannerSource+contractSource)&&!/(if\\s*\\([^\\n]*case_id|switch\\s*\\([^\\n]*case_id)/.test(coreSource+plannerSource+contractSource)',
    'coreSource=(await readFile(new URL("./experiment4ar6Core.ts",import.meta.url),"utf8"))+"\\n"+(await readFile(new URL("./experiment4ar6Runtime.ts",import.meta.url),"utf8")),plannerSource=(await readFile(new URL("./experiment4ar6Planner.ts",import.meta.url),"utf8"))+"\\n"+(await readFile(new URL("./experiment4ar5Reranker.ts",import.meta.url),"utf8")),contractSource=await readFile(new URL("./experiment4ar6Contract.ts",import.meta.url),"utf8"),seedFree=auditProviderBlindSource([coreSource,plannerSource,contractSource]).clean'
  ],
  [
    'fingerprints_timestamps_present:recipes.every(r=>r.provider_selection_fingerprint&&r.documentation_fingerprint&&r.contract_fingerprint&&r.projection_fingerprint&&r.recipe_fingerprint&&r.first_verification?.requested_at&&r.confirmation_verification?.requested_at),real_3x_projection:recipes.every(r=>r.projection_kind==="3x_typed_program")',
    'fingerprints_timestamps_present:recipes.length>0&&recipes.every(r=>r.provider_selection_fingerprint&&r.documentation_fingerprint&&r.contract_fingerprint&&r.projection_fingerprint&&r.recipe_fingerprint&&r.first_verification?.requested_at&&r.confirmation_verification?.requested_at&&r.documented_operation_proof?.operation_id),real_3x_projection:recipes.length>0&&recipes.every(r=>r.projection_kind==="3x_typed_program")'
  ],
  [
    '"GO_4A_R_BREADTH_RECOVERY":"REASSESS_4A_R_BREADTH_RECOVERY"',
    '"GO_4A_R6_DOCUMENTED_OPERATION_IR_RECOVERY":"REASSESS_4A_R6_DOCUMENTED_OPERATION_IR_RECOVERY"'
  ],
  [
    'experiment:"4A-R",purpose:"development_breadth_recovery"',
    'experiment:"4A-R6",purpose:"development_documented_operation_ir_recovery"'
  ],
  [
    'base_sha:"9038f5591be396a44f1971520288ddec64098141"',
    'base_sha:"a5beb7049dcceadcd7e40b6190fa453ba22e4f79"'
  ]
];

export function deriveExperiment4ar6Source(source:string) {
  let result=source;
  for(const [from,to] of FOUR_AR6_REPLACEMENTS) {
    if(!result.includes(from)) throw new Error(`4ar6_derivation_anchor_missing:${from.slice(0,140)}`);
    result=result.replace(from,to);
  }
  return result;
}
