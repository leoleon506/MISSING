import {fiveB15Sha,FIVE_B15_MAX_ATTEMPTS,FIVE_B15_MAX_TOTAL_HTTP_ATTEMPTS} from "./experiment5b15Policy.js";
import type {FiveB15Integrity} from "./experiment5b15Harness.js";

export function buildFiveB15Report(metrics:any,integrity:FiveB15Integrity,attempts:any[],started_at:string,finished_at:string){
 const gates:any={
  integrity:integrity.ok,
  exactly_7_frozen_recipes:Number(metrics.frozen_recipe_count)===7,
  frozen_recipe_fingerprint_set_exact:integrity.recipe_fingerprint_set_matches&&String(metrics.recipe_fingerprint_set_fingerprint)===integrity.recipe_fingerprint_set_fingerprint,
  frozen_changed_input_workload_exact:integrity.changed_input_workload_matches&&String(metrics.changed_input_workload_fingerprint)===integrity.changed_input_workload_fingerprint,
  attempt1_recorded_for_all_before_retry:Number(metrics.attempt1_records)===7&&metrics.attempt1_all_recorded_before_retry===true,
  retries_only_after_eligible_failure:Number(metrics.non_retryable_retried_violations)===0,
  maximum_attempts_3:Number(metrics.maximum_attempts_used)<=FIVE_B15_MAX_ATTEMPTS,
  total_http_attempts_21:Number(metrics.total_http_attempts)<=FIVE_B15_MAX_TOTAL_HTTP_ATTEMPTS,
  logical_execution_attempts_21:Number(metrics.logical_execution_attempts)<=FIVE_B15_MAX_TOTAL_HTTP_ATTEMPTS,
  request_fingerprint_stable:Number(metrics.request_fingerprint_mismatch_violations)===0,
  changed_input_immutable:Number(metrics.changed_input_mutation_violations)===0,
  retry_budget_clean:Number(metrics.retry_budget_violations)===0,
  persisted_recipes_unchanged:Number(metrics.recipe_mutation_violations)===0,
  semantic_verifier_unchanged:integrity.semantic_verifier_unchanged&&String(metrics.semantic_verifier_source_fingerprint)===integrity.semantic_verifier_source_fingerprint,
  final_replay_rate_95:Number(metrics.final_replay_successes)===7&&Number(metrics.final_replay_rate)>=.95,
  documentary_replay_preserved:Number(metrics.documentary_recipe_count)>0&&Number(metrics.documentary_recipe_final_replay_successes)===Number(metrics.documentary_recipe_count),
  documentary_lineage_preserved:metrics.documentary_lineage_preserved===true,
  replay_discovery_cognitive_zero:Number(metrics.replay_catalog_fetches)===0&&Number(metrics.replay_reranker_calls)===0&&Number(metrics.replay_documentation_fetches)===0&&Number(metrics.replay_synthesis_calls)===0&&Number(metrics.replay_recovery_fetches)===0,
  recipe_generation_zero:Number(metrics.recipe_generation_calls)===0,
  auth_like_requests_zero:Number(metrics.auth_like_rendered_requests)===0,
  wrong_task_probes_zero:Number(metrics.wrong_task_probe_attempts)===0,
  stochastic_decisions_zero:Number(metrics.stochastic_decisions)===0,
  holdout_access_zero:Number(metrics.holdout_accesses)===0
 };
 const report:any={experiment:"5B15",purpose:"development_deterministic_replay_resilience",base_sha:integrity.base_sha,prereg_commit:integrity.prereg_commit,workload_commit:integrity.workload_commit,decision:Object.values(gates).every(Boolean)?"GO_5B15_DETERMINISTIC_REPLAY_RESILIENCE":"REASSESS_5B15_DETERMINISTIC_REPLAY_RESILIENCE",metrics,gates,integrity,attempts,started_at,finished_at};
 report.fingerprint=fiveB15Sha(report);return report;
}
