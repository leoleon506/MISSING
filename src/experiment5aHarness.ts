import {createHash} from "node:crypto";
import {execFileSync} from "node:child_process";
import {readFileSync} from "node:fs";
import {FIVE_A_CASES,FOUR_A_BUDGET,fiveAWorkloadFingerprint,type FiveACase} from "./experiment5aCore.js";

export const FIVE_A_FROZEN_ENGINE_SHA="a0ae7506df5c9be386e8be6a72fce8526aca1e11";
export const FIVE_A_PREREG_COMMIT="32cef9733580c3163d0952f483c027281bc5457e";
const DEV_CASE_IDS=new Set([
  "pypi_package_metadata","npm_package_metadata","wikipedia_page_metadata","postal_code_location","coordinate_timezone","coordinate_weather_metadata","doi_publication_metadata","isbn_title_metadata","open_library_work_metadata","food_barcode_metadata","meal_name_metadata","cocktail_name_metadata","age_estimate_by_name","gender_estimate_by_name","nationality_estimate_by_name","artwork_object_metadata","fictional_character_metadata","anime_title_metadata","vin_vehicle_metadata","aircraft_registration_metadata","airport_iata_metadata","chemical_element_metadata","protein_identifier_metadata","taxon_name_metadata"
]);

export function fiveAPathAllowed(path:string){
  return path.startsWith("experiments/5a/")
    || /^src\/experiment5a[^/]*\.(?:ts|mjs)$/.test(path)
    || /^tests\/experiment5a[^/]*\.test\.ts$/.test(path)
    || path===".github/workflows/run-experiment-5a.yml";
}
function git(args:string[],cwd=process.cwd()){
  return execFileSync("git",args,{cwd,encoding:"utf8",stdio:["ignore","pipe","pipe"]}).trim();
}
function lines(v:string){return v.split(/\r?\n/).map(x=>x.trim()).filter(Boolean)}

export type FiveAIntegrity={
  ok:boolean;base_sha:string;prereg_commit:string;head_sha:string;base_is_ancestor:boolean;
  changed_files:string[];unexpected_files:string[];first_5a_commit:string|null;prereg_unchanged:boolean;
  case_count:number;family_count:number;unique_case_ids:boolean;development_case_overlap:string[];
  all_build_replay_changed:boolean;workload_fingerprint:string;runtime_provider_url_literals:number;errors:string[];
};

export function inspectFiveAIntegrity(cwd=process.cwd()):FiveAIntegrity{
  const errors:string[]=[];
  let head="",baseAncestor=false,changed:string[]=[],first:string|null=null,preregUnchanged=false,urlLiterals=0;
  try{head=git(["rev-parse","HEAD"],cwd)}catch(e){errors.push(`head_unavailable:${String(e)}`)}
  try{
    execFileSync("git",["merge-base","--is-ancestor",FIVE_A_FROZEN_ENGINE_SHA,"HEAD"],{cwd,stdio:"ignore"});
    baseAncestor=true;
  }catch{errors.push("frozen_base_not_ancestor")}
  try{changed=lines(git(["diff","--name-only",`${FIVE_A_FROZEN_ENGINE_SHA}..HEAD`],cwd))}
  catch(e){errors.push(`diff_unavailable:${String(e)}`)}
  const unexpected=changed.filter(p=>!fiveAPathAllowed(p));
  if(unexpected.length)errors.push(`unexpected_changed_files:${unexpected.join(",")}`);
  try{
    const commits=lines(git([
      "log","--reverse","--format=%H",`${FIVE_A_FROZEN_ENGINE_SHA}..HEAD`,"--",
      "experiments/5a","src","tests",".github/workflows/run-experiment-5a.yml"
    ],cwd));
    first=commits[0]||null;
    if(first!==FIVE_A_PREREG_COMMIT)errors.push(`prereg_not_first:${first||"none"}`);
  }catch(e){errors.push(`history_unavailable:${String(e)}`)}
  try{
    preregUnchanged=!git(["diff","--name-only",`${FIVE_A_PREREG_COMMIT}..HEAD`,"--","experiments/5a/README.md"],cwd);
    if(!preregUnchanged)errors.push("prereg_modified_after_freeze");
  }catch(e){errors.push(`prereg_diff_unavailable:${String(e)}`)}
  const ids=FIVE_A_CASES.map(c=>c.case_id);
  const families=new Set(FIVE_A_CASES.map(c=>c.family));
  const unique=new Set(ids).size===ids.length;
  const overlap=ids.filter(id=>DEV_CASE_IDS.has(id));
  const buildReplayChanged=FIVE_A_CASES.every(c=>JSON.stringify(c.build)!==JSON.stringify(c.replay));
  if(FIVE_A_CASES.length!==18)errors.push(`case_count:${FIVE_A_CASES.length}`);
  if(families.size!==11)errors.push(`family_count:${families.size}`);
  if(!unique)errors.push("duplicate_case_id");
  if(overlap.length)errors.push(`development_case_overlap:${overlap.join(",")}`);
  if(!buildReplayChanged)errors.push("unchanged_replay_input");
  for(const file of changed.filter(p=>/^src\/experiment5a.*\.(?:ts|mjs)$/.test(p))){
    try{
      const text=readFileSync(`${cwd}/${file}`,"utf8");
      urlLiterals+=(text.match(/https?:\/\/[A-Za-z0-9]/g)||[]).length;
    }catch{}
  }
  if(urlLiterals>0)errors.push(`runtime_provider_url_literals:${urlLiterals}`);
  return {
    ok:errors.length===0,base_sha:FIVE_A_FROZEN_ENGINE_SHA,prereg_commit:FIVE_A_PREREG_COMMIT,head_sha:head,
    base_is_ancestor:baseAncestor,changed_files:changed,unexpected_files:unexpected,first_5a_commit:first,
    prereg_unchanged:preregUnchanged,case_count:FIVE_A_CASES.length,family_count:families.size,unique_case_ids:unique,
    development_case_overlap:overlap,all_build_replay_changed:buildReplayChanged,workload_fingerprint:fiveAWorkloadFingerprint(),
    runtime_provider_url_literals:urlLiterals,errors
  };
}

function hostOf(url:any){try{return new URL(String(url)).hostname.toLowerCase().replace(/^www\./,"")}catch{return null}}
function pct(xs:number[],p:number){if(!xs.length)return null;const s=[...xs].sort((a,b)=>a-b),i=Math.min(s.length-1,Math.max(0,Math.ceil(p*s.length)-1));return s[i]}
function sameSet(a:Set<string>,b:Set<string>){return a.size===b.size&&[...a].every(x=>b.has(x))}
function sha(v:any){return createHash("sha256").update(JSON.stringify(v)).digest("hex")}
function failureStage(row:any,reranked:boolean){
  if(row?.success)return "success";
  if(!reranked)return "rerank";
  if(Number(row?.broad_count||0)===0)return "provider_discovery";
  const attempts=Array.isArray(row?.attempts)?row.attempts:[];
  if(!attempts.length)return "provider_selection";
  const statuses=attempts.map((a:any)=>String(a?.status||""));
  if(statuses.some((s:string)=>/probe|http|transport/i.test(s)))return "probe_or_transport";
  if(statuses.some((s:string)=>/contract_reject|reject/i.test(s)))return "contract_or_semantic_validation";
  return "documentation_or_construction";
}
function witnessSafe(recipe:any){
  const mappings=recipe?.schema_role_witness_4w?.mappings;
  if(!Array.isArray(mappings))return true;
  return mappings.every((m:any)=>m&&typeof m.observed_path==="string"
    &&!Object.prototype.hasOwnProperty.call(m,"value")
    &&!Object.prototype.hasOwnProperty.call(m,"literal")
    &&!Object.prototype.hasOwnProperty.call(m,"output_value"));
}

export function buildFiveAReport(raw:any,integrity:FiveAIntegrity,cases:FiveACase[]=FIVE_A_CASES){
  const caseById=new Map(cases.map(c=>[c.case_id,c]));
  const expectedIds=new Set<string>(cases.map(c=>String(c.case_id)));
  const caseEvidence=Array.isArray(raw?.caseEvidence)?raw.caseEvidence:[];
  const recipes=Array.isArray(raw?.recipes)?raw.recipes:[];
  const replay=Array.isArray(raw?.replay)?raw.replay:[];
  const rerank=Array.isArray(raw?.rerankEvidence)?raw.rerankEvidence:[];
  const llm=Array.isArray(raw?.llmUsage)?raw.llmUsage:[];
  const m=raw?.metrics||{};
  const evidenceIds:string[]=caseEvidence.map((r:any)=>String(r.case_id));
  const evidenceSet=new Set<string>(evidenceIds);
  const successRows=caseEvidence.filter((r:any)=>!!r?.success&&caseById.has(String(r.case_id)));
  const successIds=new Set<string>(successRows.map((r:any)=>String(r.case_id)));
  const recipeIds=new Set<string>(recipes.filter((r:any)=>caseById.has(String(r.case_id))).map((r:any)=>String(r.case_id)));
  const rerankIds=new Set<string>(rerank.filter((r:any)=>caseById.has(String(r.case_id))).map((r:any)=>String(r.case_id)));
  const replaySuccessIds=new Set<string>(replay.filter((r:any)=>r?.success&&caseById.has(String(r.case_id))).map((r:any)=>String(r.case_id)));
  const successfulFamilies=new Set([...successIds].map(id=>caseById.get(id)!.family));
  const providerHosts=new Set(recipes.filter((r:any)=>successIds.has(String(r.case_id))).map((r:any)=>hostOf(r.provider_start_url)).filter(Boolean) as string[]);
  const latencies=successRows.map((r:any)=>Number(r.elapsed_ms)).filter(Number.isFinite);
  const totalCost=llm.reduce((n:number,r:any)=>n+Number(r?.cost_usd||0),0);
  const meanCost=successIds.size?totalCost/successIds.size:null;
  const replayRate=recipeIds.size?replaySuccessIds.size/recipeIds.size:0;
  const replayDeltas=m?.replay_deltas&&typeof m.replay_deltas==="object"?m.replay_deltas:{};
  const replayCognitiveZero=Object.values(replayDeltas).every(v=>Number(v||0)===0)&&Number(m.schemaRoleResolverReplayLlmCalls4w||0)===0;
  const allCaseRowsExactlyOnce=evidenceIds.length===cases.length&&evidenceSet.size===cases.length&&sameSet(evidenceSet,expectedIds);
  const allReranked=sameSet(rerankIds,expectedIds);
  const allSuccessPersisted=sameSet(successIds,recipeIds);
  const allWitnessesSafe=recipes.every(witnessSafe);
  const median=pct(latencies,0.5),p90=pct(latencies,0.9);
  const metrics={
    holdout_cases:cases.length,holdout_families:new Set(cases.map(c=>c.family)).size,
    successful_manufactures:successIds.size,success_rate:successIds.size/cases.length,
    families_with_success:successfulFamilies.size,distinct_provider_hosts:providerHosts.size,
    persisted_recipes:recipeIds.size,replay_successes:replaySuccessIds.size,replay_rate:replayRate,
    total_llm_cost_usd:totalCost,mean_llm_cost_per_success_usd:meanCost,
    median_success_latency_ms:median,p90_success_latency_ms:p90,reranked_cases:rerankIds.size,
    schema_role_resolver_replay_llm_calls:Number(m.schemaRoleResolverReplayLlmCalls4w||0),
    validator_graph_mismatch_rejects:Number(m.validatorGraphMismatchRejects||0),
    auth_like_rendered_requests:Number(m.authLikeRenderedRequests||0),known_auth_probe_attempts:Number(m.knownAuthProbeAttempts||0),
    wrong_task_probe_attempts:Number(m.wrongTaskProbeAttempts||0),entity_incompatible_structural_probe_attempts:Number(m.entityIncompatibleStructuralProbeAttempts||0),
    confirmed_origin_drift_rejects:Number(m.executedTraceOriginDriftRejects||0),confirmed_request_mutation_rejects:Number(m.executedTraceRequestMutationRejects||0),
    non_auth_request_text_mutations:Number(m.nonAuthRequestTextMutations||0),external_openapi_ref_fetches:Number(m.operationExternalRefFetches4u||0),
    duplicate_probe_network_fetches:Number(m.duplicateProbeNetworkFetches||0),duplicate_acquisition_network_fetches:Number(m.duplicateAcquisitionNetworkFetches||0),
    duplicate_spec_probe_network_fetches:Number(m.duplicateSpecProbeNetworkFetches||0),frozen_request_proof_mutation_rejects:Number(m.frozenRequestProofMutationRejects4u||0)
  };
  const gates={
    frozen_engine_integrity:integrity.ok,exact_18_case_holdout:allCaseRowsExactlyOnce,all_18_cases_reranked:allReranked,
    at_least_6_manufactures:successIds.size>=6,at_least_6_families:successfulFamilies.size>=6,at_least_6_distinct_providers:providerHosts.size>=6,
    every_success_persists_recipe:allSuccessPersisted,replay_rate_95:replayRate>=0.95,replay_cognitive_deltas_zero:replayCognitiveZero,
    auth_like_rendered_requests_zero:metrics.auth_like_rendered_requests===0,known_auth_probe_attempts_zero:metrics.known_auth_probe_attempts===0,
    wrong_task_probe_attempts_zero:metrics.wrong_task_probe_attempts===0,entity_incompatible_structural_probes_zero:metrics.entity_incompatible_structural_probe_attempts===0,
    confirmed_request_origin_and_mutation_zero:metrics.confirmed_origin_drift_rejects===0&&metrics.confirmed_request_mutation_rejects===0&&metrics.non_auth_request_text_mutations===0&&metrics.frozen_request_proof_mutation_rejects===0,
    external_openapi_refs_not_fetched:metrics.external_openapi_ref_fetches===0,
    schema_role_outputs_closed_world:allWitnessesSafe&&Number(m.schemaRoleResolverWitnessMutationRejects4w||0)===0,
    validator_graph_mismatch_zero:metrics.validator_graph_mismatch_rejects===0,
    duplicate_network_fetch_regressions_zero:metrics.duplicate_probe_network_fetches===0&&metrics.duplicate_acquisition_network_fetches===0&&metrics.duplicate_spec_probe_network_fetches===0,
    total_llm_cost_within_budget:totalCost<=FOUR_A_BUDGET.max_total_llm_cost_usd,
    mean_llm_cost_within_budget:meanCost!==null&&meanCost<=FOUR_A_BUDGET.max_mean_llm_cost_per_success_usd,
    median_latency_within_budget:median!==null&&median<=FOUR_A_BUDGET.max_median_success_latency_ms,
    p90_latency_within_budget:p90!==null&&p90<=FOUR_A_BUDGET.max_p90_success_latency_ms
  };
  const invalid=!integrity.ok,go=!invalid&&Object.values(gates).every(Boolean);
  const near=cases.filter(c=>c.holdout_stratum==="near"),far=cases.filter(c=>c.holdout_stratum==="far");
  const nearSuccess=near.filter(c=>successIds.has(c.case_id)).length,farSuccess=far.filter(c=>successIds.has(c.case_id)).length;
  const case_results=cases.map(c=>{
    const ev=caseEvidence.find((r:any)=>r.case_id===c.case_id),recipe=recipes.find((r:any)=>r.case_id===c.case_id),rep=replay.find((r:any)=>r.case_id===c.case_id);
    return {case_id:c.case_id,family:c.family,holdout_stratum:c.holdout_stratum,success:successIds.has(c.case_id),recipe_persisted:recipeIds.has(c.case_id),replay_success:rep?.success===true,provider_host:recipe?hostOf(recipe.provider_start_url):null,request_proof_type:recipe?.active_schema_proof?.request_proof_type||null,schema_role_witness:!!recipe?.schema_role_witness_4w,elapsed_ms:Number.isFinite(Number(ev?.elapsed_ms))?Number(ev.elapsed_ms):null,failure_stage:failureStage(ev,rerankIds.has(c.case_id))};
  });
  const family_results=[...new Set(cases.map(c=>c.family))].sort().map(f=>{const rows=cases.filter(c=>c.family===f),s=rows.filter(c=>successIds.has(c.case_id)).length;return {family:f,cases:rows.length,successes:s,success_rate:s/rows.length}});
  const diagnostic={
    near_transfer:{cases:near.length,successes:nearSuccess,success_rate:near.length?nearSuccess/near.length:0},
    far_transfer:{cases:far.length,successes:farSuccess,success_rate:far.length?farSuccess/far.length:0},
    family_results,
    native_4w_recipes:recipes.filter((r:any)=>String(r?.active_schema_proof?.request_proof_type||"")==="4w_linked_native_openapi_operation").length,
    schema_witness_recipes:recipes.filter((r:any)=>!!r?.schema_role_witness_4w).length,
    engine_decision:raw?.decision||null,engine_report_fingerprint:raw?.fingerprint||null
  };
  const report:any={experiment:"5A",purpose:"preregistered_blind_generalization_holdout",frozen_engine_sha:FIVE_A_FROZEN_ENGINE_SHA,prereg_commit:FIVE_A_PREREG_COMMIT,workload_fingerprint:fiveAWorkloadFingerprint(),decision:invalid?"INVALID_5A_ENGINE_INTEGRITY":go?"GO_5A_BLIND_GENERALIZATION_HOLDOUT":"REASSESS_5A_BLIND_GENERALIZATION_HOLDOUT",metrics,gates,integrity,diagnostic,case_results};
  report.fingerprint=sha(report);
  return report;
}
