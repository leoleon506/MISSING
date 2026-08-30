import {describe,expect,it} from "vitest";
import {buildFiveB14Report} from "../src/experiment5b14Decision.js";

function fixture(localSpan=true,sourceSpan="span",replaySuccess=true){
 const caseEvidence=Array.from({length:18},(_,i)=>({case_id:`c${i}`,family:i<6?`f${i}`:"f0",success:{host:`h${i}`}}));
 const documentary_witness_5b12={source_evidence_id:"e1",source_span_fingerprint:sourceSpan,template_fingerprint:"t1",candidate_id:"doc1",beam_position:2,rendered_build_url:"https://example.test/search?q=A"};
 const request_utility_5b14={hypothesis_id:"doc1",documentary:true,request_local_span_found:localSpan,binding_invalid_refs:0,binding_unresolved:0};
 const recipes=caseEvidence.map((c,i)=>i===0?{case_id:c.case_id,documentary_witness_5b12,request_utility_5b14}:{case_id:c.case_id});
 const replay=caseEvidence.map(c=>({case_id:c.case_id,success:c.case_id==="c0"?replaySuccess:true}));
 const synthesisEvidence=[{requestLocalSemanticEvaluations5b14:1,broadDocumentSemanticFallbackUses5b14:0,provenanceNeutralBindingEvaluations5b14:1,bindingProvenanceBonusUses5b14:0,invalidInputSlotReferences5b14:0,documentaryBeamEntries5b12:1,documentaryGeometryViolationsAccepted5b12:0,documentaryBoundExampleValuesRetained5b12:0,documentaryUngroundedRuntimeConstants5b12:0,documentaryRankingBonusUses5b12:0,globalBeamSizeMax5b10:2,requestOrderingNondeterminismRejects5b14:0}];
 return {caseEvidence,recipes,replay,synthesisEvidence,metrics:{replay_deltas:{},authLikeRenderedRequests:0,wrongTaskProbeAttempts:0,total_llm_cost_usd:0,mean_llm_cost_per_success_usd:0,median_success_latency_ms:1,p90_success_latency_ms:1}};
}

const integrity:any={ok:true};
const baseline={strict_success_families:["old1","old2","old3","old4","old5"]};

describe("Experiment 5B14 decision lineage completeness",()=>{
 it("requires source span, local semantic span, matching hypothesis, rendered build and successful replay",()=>{
  const ok=buildFiveB14Report(fixture(),integrity,baseline);
  expect(ok.gates.documentary_lineage_complete).toBe(true);
  expect(ok.metrics.documentary_end_to_end_lineage_complete).toBe(true);
  expect(buildFiveB14Report(fixture(false),integrity,baseline).gates.documentary_lineage_complete).toBe(false);
  expect(buildFiveB14Report(fixture(true,""),integrity,baseline).gates.documentary_lineage_complete).toBe(false);
  expect(buildFiveB14Report(fixture(true,"span",false),integrity,baseline).gates.documentary_lineage_complete).toBe(false);
 });
 it("exposes preregistered direct replay and safety instrumentation",()=>{
  const report=buildFiveB14Report(fixture(),integrity,baseline);
  expect(report.metrics.replay_catalog_fetches).toBe(0);
  expect(report.metrics.replay_reranker_calls).toBe(0);
  expect(report.metrics.replay_documentation_fetches).toBe(0);
  expect(report.metrics.replay_synthesis_calls).toBe(0);
  expect(report.metrics.replay_recovery_fetches).toBe(0);
  expect(report.metrics.auth_like_rendered_requests).toBe(0);
  expect(report.metrics.wrong_task_probe_attempts).toBe(0);
 });
});
