import type {Config} from "./config/index.js";
import type {RecoveryLedger} from "./experiment3yrCore.js";
import type {DocEvidence} from "./experiment3wCore.js";
import {FOUR_A_CASES} from "./experiment4aCore.js";
import type {Provider4A} from "./experiment4aContract.js";
import {probeHypothesis4R,probeCacheMetrics4R} from "./experiment4rProbe.js";
import {deterministicPartialProjection4S,groundingStats4S,materialize4S} from "./experiment4sCore.js";
import {synthesize4t} from "./experiment4tPlanner.js";
import {buildNativeHypotheses4U,freezeRequestProof4U} from "./experiment4uNativeOperation.js";

const BY_ID=Object.fromEntries(FOUR_A_CASES.map(r=>[r.case_id,r]));
function defaults(){return {machineDocumentFetches4u:0,machineJsonParseSuccesses4u:0,machineYamlParseSuccesses4u:0,machineNonSpecJsonRejected4u:0,machineNonSpecYamlRejected4u:0,qualifiedOpenApi3Documents4u:0,qualifiedSwagger2Documents4u:0,operationLocalRefsResolved4u:0,operationLocalRefsRejected4u:0,operationExternalRefsRejected4u:0,operationExternalRefFetches4u:0,operationRefCyclesRejected4u:0,unrelatedRefFailuresIsolated4u:0,nativeOperationsDiscovered4u:0,nativeOperationsEligible4u:0,nativeOperationsRejectedAuth4u:0,nativeOperationsRejectedUnsupportedRequest4u:0,nativeOperationsRejectedSemanticMismatch4u:0,nativeOperationHypotheses4u:0,nativeOperationUniqueInputBindings4u:0,nativeOperationAmbiguousBindings4u:0,nativeOperationProbeCalls4u:0,nativeOperationProbeStructured2xx4u:0,nativeOperationResponseGroundings4u:0,frozenRequestProofs4u:0,frozenInheritedRequestProofs4u:0,frozenNativeRequestProofs4u:0}}
function merged(base:any,metrics:any,extra:any={}){return {...base,...defaults(),...metrics,...extra}}
export async function synthesize4u(config:Config,provider:Provider4A,evidence:DocEvidence[],ledger:RecoveryLedger){
  const base=await synthesize4t(config,provider,evidence,ledger);
  if(base?.parsed_json?.decision==="COMPILE"&&base?.probe_proof?.hypothesis){const proof=freezeRequestProof4U(base.probe_proof.hypothesis);return merged(base,{}, {parsed_json:{...base.parsed_json,frozen_request_proof_4u:proof},frozenRequestProofs4u:1,frozenInheritedRequestProofs4u:1});}
  const c=BY_ID[provider.case_id];if(!c)return merged(base,{});
  const native=await buildNativeHypotheses4U(evidence,provider,ledger);if(!native.hypotheses.length)return merged(base,native.metrics);
  const before=probeCacheMetrics4R(),h=native.hypotheses[0],row:any=await probeHypothesis4R(h,c.build,ledger),after=probeCacheMetrics4R(),success=row.proof.record.disposition==="success";
  const ground=success?groundingStats4S(row.proof,c.required):{semanticGroundingCandidates:0,semanticGroundingAccepted:0,semanticGroundingRejected:0};const nativeMetrics={...native.metrics,nativeOperationProbeCalls4u:1,nativeOperationProbeStructured2xx4u:success?1:0,nativeOperationResponseGroundings4u:success?ground.semanticGroundingAccepted:0,probeCacheHits:Number((after as any).probeCacheHits||0)-Number((before as any).probeCacheHits||0),probeNetworkFetches:Number((after as any).probeNetworkFetches||0)-Number((before as any).probeNetworkFetches||0),duplicateProbeNetworkFetches:Number((after as any).duplicateProbeNetworkFetches||0)-Number((before as any).duplicateProbeNetworkFetches||0)};
  if(!success)return merged(base,nativeMetrics,{request_hypotheses:[...(base.request_hypotheses||[]),h]});
  const d=deterministicPartialProjection4S(row.proof,row.relational_summary,c.input_names,c.required);if(d.unresolved.length)return merged(base,nativeMetrics,{request_hypotheses:[...(base.request_hypotheses||[]),h],probe_records:[...(base.probe_records||[]),row.proof.record]});
  const m=materialize4S(provider.case_id,provider.candidate_id,row.proof,d.projection,row.relational_summary);m.raw.reason=`4U_NATIVE_MACHINE_READABLE_OPERATION:${h.id}`;m.raw.frozen_request_proof_4u=freezeRequestProof4U(h);m.raw.native_operation_proof_4u=native.proofs.find(p=>p.hypothesis_id===h.id)||null;
  return merged(base,nativeMetrics,{http_status:0,http_ok:true,parsed_json:m.raw,parse_error:null,usage:null,latency_ms:0,probe_proof:row.proof,operation_proof:m.proof,planner_skipped:true,deterministic_mapping:true,row_lookup_selected:d.rowLookups>0,identity_projection_selected:d.identityInputs>0,selected_from_trace:false,selected_from_documented_role:false,selected_from_linked_contract:true,selected_from_native_contract:true,compositional_locked_bindings:d.locked.length,exact_relational_label_selections:d.exactRelationalLabels,structured_format:row.structured_format,request_hypotheses:[...(base.request_hypotheses||[]),h],probe_records:[...(base.probe_records||[]),row.proof.record],frozenRequestProofs4u:1,frozenNativeRequestProofs4u:1});
}
