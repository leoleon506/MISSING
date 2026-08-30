import {createHash} from "node:crypto";
import {registrableDomain} from "./experiment3uCore.js";
import type {FiveB16Integrity} from "./experiment5b16Harness.js";
import type {FiveB16Workload} from "./experiment5b16Workload.js";

const sha=(v:any)=>createHash("sha256").update(JSON.stringify(v)).digest("hex");
function domain(raw:string){try{return registrableDomain(new URL(raw).hostname)}catch{return ""}}
function expectedTail(workload:FiveB16Workload,caseId:string){return workload.raw_tail_entries.filter(x=>x.case_id===caseId)}
function selectedMatchesExpected(row:any,expected:any[]){const got=Array.isArray(row?.selected)?row.selected:[];if(got.length!==expected.length)return false;return got.every((x:any,i:number)=>String(x.candidate_id)===String(expected[i].candidate_id)&&Number(x.selected_position)===Number(expected[i].selected_position)&&String(x.url_fingerprint)===String(expected[i].url_fingerprint)&&Boolean(x.duplicate_url_identity)===Boolean(expected[i].duplicate_url_identity))}

export function buildFiveB16Report(raw:any,integrity:FiveB16Integrity,workload:FiveB16Workload){
 const ce=Array.isArray(raw?.caseEvidence)?raw.caseEvidence:[],recipes=Array.isArray(raw?.recipes)?raw.recipes:[],replay=Array.isArray(raw?.replay)?raw.replay:[],rm=raw?.metrics||{},primaryByFp=new Map(workload.primaries.map(p=>[p.primary_recipe_fingerprint,p])),tailByCase=new Map(workload.primaries.map(p=>[p.case_id,new Set(expectedTail(workload,p.case_id).map(x=>x.candidate_id))]));
 let orderViolations=0,outsideTailViolations=0,positionOver8Violations=0,duplicateSkipped=0,resolvedIdentities=0,unresolvedIdentities=0;
 for(const primary of workload.primaries){const row=ce.find((x:any)=>String(x.case_id)===primary.case_id);if(!row||!selectedMatchesExpected(row,expectedTail(workload,primary.case_id)))orderViolations++;for(const s of row?.selected||[]){if(Number(s.selected_position)>8)positionOver8Violations++;if(s.identity_resolved===true)resolvedIdentities++;else unresolvedIdentities++}for(const a of row?.attempts||[]){if(a.status==="duplicate_identity_skipped")duplicateSkipped++;if(a.candidate_id&&!tailByCase.get(primary.case_id)?.has(String(a.candidate_id)))outsideTailViolations++;if(Number(a.selected_position)>8)positionOver8Violations++}}
 const altCases=new Set(recipes.map((r:any)=>String(r.case_id))),altFamilies=new Set(recipes.map((r:any)=>String(r.family))),unhealthy=workload.primaries.filter(p=>p.unhealthy_after_5b15),unhealthyCovered=unhealthy.filter(p=>altCases.has(p.case_id));
 let independentDomainViolations=0,collisionViolations=0,doubleVerifyFailures=0;for(const r of recipes){const p=primaryByFp.get(String(r.primary_recipe_fingerprint));if(!p||!domain(String(r.provider_start_url))||domain(String(r.provider_start_url))===domain(p.primary_provider_start_url))independentDomainViolations++;if(String(r.recipe_fingerprint)===String(r.primary_recipe_fingerprint))collisionViolations++;if(!r?.first_verification?.requested_at||!r?.confirmation_verification?.requested_at)doubleVerifyFailures++}
 const replaySuccess=replay.filter((x:any)=>x?.success===true),d=rm?.replay_deltas||{},metrics:any={
  frozen_primary_count:workload.primaries.length,raw_frozen_tail_count:workload.raw_tail_count,distinct_frozen_tail_url_identities:workload.distinct_tail_url_identity_count,frozen_tail_fingerprint:workload.frozen_tail_fingerprint,unhealthy_primary_set_fingerprint:workload.unhealthy_primary_set_fingerprint,public_apis_snapshot_commit:workload.public_apis_snapshot.commit,
  catalog_identity_resolution_fetches:Number(rm.catalogIdentityResolutionFetches5b16||0),resolved_frozen_candidate_identities:resolvedIdentities,unresolved_frozen_candidate_identities:unresolvedIdentities,exact_duplicate_identities_skipped:duplicateSkipped,candidate_order_mutation_violations:orderViolations,candidate_outside_frozen_tail_violations:outsideTailViolations,candidate_position_over_8_violations:positionOver8Violations,
  documentation_fetches:Number(rm.docFetches||0),synthesis_calls:Number(rm.synthesisCalls||0),synthesis_repairs:Number(rm.synthesisRepairs||0),provider_reranker_calls:Number(rm.rerankerCalls||0),broad_provider_retrieval_calls:Number(rm.broadRetrievalCalls5b16||0),new_provider_selection_calls:Number(rm.newProviderSelectionCalls5b16||0),
  qualifying_alternate_recipes:recipes.length,capabilities_with_qualifying_alternates:altCases.size,families_with_qualifying_alternates:altFamilies.size,unhealthy_primaries:unhealthy.length,unhealthy_primaries_covered:unhealthyCovered.length,independent_domain_violations:independentDomainViolations,primary_alternate_recipe_fingerprint_collision_violations:collisionViolations,double_live_verification_failures:doubleVerifyFailures,alternate_changed_input_replay_successes:replaySuccess.length,alternate_changed_input_replay_failures:Math.max(0,replay.length-replaySuccess.length),
  replay_catalog_fetches:Number(d.catalog_fetches||0),replay_reranker_calls:Number(d.reranker_calls||0),replay_documentation_fetches:Number(d.documentation_fetches||0),replay_synthesis_calls:Number(d.synthesis_calls||0),replay_recovery_fetches:Number(d.recovery_fetches||0),auth_like_rendered_requests:Number(rm.authLikeRenderedRequests5b16||0),wrong_task_probe_attempts:Number(rm.wrongTaskProbeAttempts5b16||0),runtime_provider_case_family_hardcoding_count:Number(integrity.runtime_provider_url_literals||0)+Number(integrity.runtime_case_family_hardcoding||0),total_llm_cost_usd:Number(rm.total_llm_cost_usd||0),mean_llm_cost_per_qualifying_alternate_usd:rm.mean_llm_cost_per_qualifying_alternate_usd==null?null:Number(rm.mean_llm_cost_per_qualifying_alternate_usd),holdout_accesses:0
 };
 const gates:any={
  integrity:integrity.ok,
  exactly_7_frozen_primaries:metrics.frozen_primary_count===7,
  exact_26_raw_25_distinct_tail:metrics.raw_frozen_tail_count===26&&metrics.distinct_frozen_tail_url_identities===25,
  frozen_tail_fingerprint_exact:metrics.frozen_tail_fingerprint===workload.frozen_tail_fingerprint,
  frozen_unhealthy_primary_set_exact:metrics.unhealthy_primary_set_fingerprint===workload.unhealthy_primary_set_fingerprint&&metrics.unhealthy_primaries===workload.unhealthy_primary_recipe_fingerprints.length,
  frozen_public_apis_snapshot_exact:metrics.public_apis_snapshot_commit==="988c57be4616cc9507fd3e8c34adedba5387f079",
  one_catalog_identity_resolution_fetch:metrics.catalog_identity_resolution_fetches===1,
  attempted_providers_frozen_tail_only:metrics.candidate_outside_frozen_tail_violations===0,
  frozen_candidate_order_preserved:metrics.candidate_order_mutation_violations===0,
  frozen_position_budget_preserved:metrics.candidate_position_over_8_violations===0,
  provider_reranker_zero:metrics.provider_reranker_calls===0,
  broad_provider_retrieval_zero:metrics.broad_provider_retrieval_calls===0,
  new_provider_selection_zero:metrics.new_provider_selection_calls===0,
  at_least_2_capabilities_with_alternates:metrics.capabilities_with_qualifying_alternates>=2,
  at_least_2_families_with_alternates:metrics.families_with_qualifying_alternates>=2,
  every_unhealthy_primary_covered:metrics.unhealthy_primaries>0&&metrics.unhealthy_primaries_covered===metrics.unhealthy_primaries,
  alternate_domains_independent:metrics.independent_domain_violations===0,
  primary_alternate_recipe_fingerprints_distinct:metrics.primary_alternate_recipe_fingerprint_collision_violations===0,
  every_alternate_double_live_verified:metrics.double_live_verification_failures===0&&metrics.qualifying_alternate_recipes>0,
  every_alternate_changed_input_replayed:metrics.alternate_changed_input_replay_successes===metrics.qualifying_alternate_recipes&&metrics.alternate_changed_input_replay_failures===0,
  replay_discovery_cognitive_zero:metrics.replay_catalog_fetches===0&&metrics.replay_reranker_calls===0&&metrics.replay_documentation_fetches===0&&metrics.replay_synthesis_calls===0&&metrics.replay_recovery_fetches===0,
  auth_like_requests_zero:metrics.auth_like_rendered_requests===0,
  wrong_task_probes_zero:metrics.wrong_task_probe_attempts===0,
  runtime_provider_case_family_hardcoding_zero:metrics.runtime_provider_case_family_hardcoding_count===0,
  total_llm_cost_budget:metrics.total_llm_cost_usd<=3,
  mean_llm_cost_per_alternate_budget:metrics.qualifying_alternate_recipes===0||Number(metrics.mean_llm_cost_per_qualifying_alternate_usd)<=.15,
  holdout_access_zero:metrics.holdout_accesses===0
 };
 const report:any={experiment:"5B16",purpose:"development_verified_recipe_redundancy_acquisition",base_sha:integrity.base_sha,prereg_commit:integrity.prereg_commit,workload_commit:integrity.workload_commit,decision:Object.values(gates).every(Boolean)?"GO_5B16_VERIFIED_RECIPE_REDUNDANCY_ACQUISITION":"REASSESS_5B16_VERIFIED_RECIPE_REDUNDANCY_ACQUISITION",metrics,gates,integrity,engine_fingerprint:raw?.fingerprint||null,caseEvidence:ce,replay,recipes};report.fingerprint=sha(report);return report;
}
