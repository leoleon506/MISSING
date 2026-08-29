import type {Config} from "./config/index.js";
import type {RecoveryLedger} from "./experiment3yrCore.js";
import type {DocEvidence} from "./experiment3wCore.js";
import {FOUR_A_CASES} from "./experiment4aCore.js";
import type {Provider4A} from "./experiment4aContract.js";
import type {P1RequestHypothesis} from "./experiment4ap1Model.js";
import {prepareRequestGraph4Q} from "./experiment4qRequest.js";
import {probeHypothesis4R,probeCacheMetrics4R} from "./experiment4rProbe.js";
import {deterministicPartialProjection4S,groundingStats4S,materialize4S} from "./experiment4sCore.js";
import {ingestLinkedContracts4S} from "./experiment4sLinkedFetch.js";
import {freezeRequestProof4U} from "./experiment4uNativeOperation.js";
import {semanticErrorEnvelope4V,responseUsable4V} from "./experiment4vResponse.js";
import {buildNativeHypotheses5B} from "./experiment5bNativeOperation.js";
import {applyResponseRoleWitness5B,combineUsage5B,resolveResponseRoles5B} from "./experiment5bResponse.js";
import {deriveSemanticIdentityWitness5B2,sanitizeProjectionInputs5B2} from "./experiment5b2Semantics.js";
import {rankRequestBeam5B3,requestOrderingDeterminism5B3} from "./experiment5b3RequestUtility.js";
import {buildStructuredCollectionHypotheses5B4} from "./experiment5b4Collection.js";
import {sha4u} from "./experiment4uOpenApi.js";

const BY_ID=Object.fromEntries(FOUR_A_CASES.map(c=>[c.case_id,c]));
function defaults(){return {requestUtilityCandidates5b3:0,requestUtilityOutputCoverage5b3:0,requestUtilityBindingScore5b3:0,requestUtilityTaskScore5b3:0,requestUtilityStructuredEvidence5b3:0,requestUtilityPrimaryDisplaced5b3:0,requestUtilitySecondProbeCalls5b3:0,requestUtilityRecoveredRecipes5b3:0,requestUtilityThirdProbeRejects5b3:0,requestOrderingFingerprintCount5b3:0,requestOrderingNondeterminismRejects5b3:0,structuredCollectionsParsed5b4:0,structuredCollectionParseRejects5b4:0,structuredCollectionOperations5b4:0,structuredCollectionGetOperations5b4:0,structuredCollectionAuthRejects5b4:0,structuredCollectionBodyRejects5b4:0,structuredCollectionUnresolvedVariableRejects5b4:0,operationLocalCapsules5b4:0,operationLocalCapsuleBytes5b4:0,operationLocalSiblingLeakRejects5b4:0,operationLocalUtilityEvaluations5b4:0,collectionExemplarCandidates5b4:0,collectionRepeatedExemplarWitnesses5b4:0,collectionExplicitVariableWitnesses5b4:0,collectionExemplarSlotsAccepted5b4:0,collectionExemplarAmbiguousRejects5b4:0,collectionExemplarUnsafeRejects5b4:0,collectionOperationUtilityCandidates5b4:0,collectionOperationOutputCoverage5b4:0,collectionOperationTaskScore5b4:0,collectionOperationPrimarySelections5b4:0,collectionOperationSecondSelections5b4:0,collectionOperationConfirmedRecipes5b4:0,collectionOperationReplaySuccesses5b4:0,semanticWitnessCandidates5b2:0,semanticWitnessCompatible5b2:0,semanticWitnessRoleRejects5b2:0,semanticWitnessPaginationRejects5b2:0,semanticWitnessDescriptiveTextRejects5b2:0,semanticWitnessExactSelected5b2:0,semanticWitnessNumericExactSelected5b2:0,semanticWitnessCompositeSelected5b2:0,semanticWitnessContainmentSelected5b2:0,semanticWitnessStrongerCandidateSuperseded5b2:0,semanticIdentityValidationSuccesses5b2:0,semanticIdentityRejects5b2:0,projectionInputBindingsChecked5b2:0,projectionInputBindingsCompatible5b2:0,projectionInputRoleRejects5b2:0,projectionHumanNameFromCodeRejects5b2:0,strictInheritedRepairAttempts5b2:0,strictInheritedRepairSuccesses5b2:0,strictInheritedRepairResponseResolverCalls5b2:0,responseGroundedCandidateFields5b:0,responseGroundedResolverCalls5b:0,responseGroundedMappingsAccepted5b:0,responseGroundedNoValidSource5b:0,responseGroundedInventedPathRejects5b:0,responseGroundedAmbiguousRejects5b:0,responseGroundedValueGenerationRejects5b:0,outputCoverageCandidates5b:0,outputRolesDocumented5b:0,outputRolesUnsupported5b:0,operationsRankedByOutputCoverage5b:0,operationsRejectedNoOutputSupport5b:0,requestFirstProbeCalls5b:0,requestFirstStructured2xx5b:0,requestFirstTransport2xx5b:0,requestFirstUnusable2xx5b:0,requestFirstConfirmedRecipes5b:0,responseGroundedConfirmedRecipes5b:0,frozenRequestProofs4u:0,frozenInheritedRequestProofs4u:0,frozenNativeRequestProofs4u:0}}
function add(target:any,src:any){for(const [k,v] of Object.entries(src||{}))if(typeof v==="number")target[k]=(target[k]||0)+v;return target}
function shape(h:P1RequestHypothesis){return sha4u({origin:h.origin,path:h.full_path,input_bindings:h.input_bindings,literal_bindings:h.literal_bindings})}
function trace(h:any){return String(h?.proof_type||"").startsWith("4n_executed_trace_")}
function documentedRole(h:any){return String(h?.proof_type||"").startsWith("4n_executed_trace_documented_role_")}
function delta(a:any,b:any,k:string){return Number(b?.[k]||0)-Number(a?.[k]||0)}

export async function synthesize5b4(config:Config,provider:Provider4A,evidence:DocEvidence[],ledger:RecoveryLedger){
  const c=BY_ID[provider.case_id];if(!c)throw new Error(`5b4_unknown_case:${provider.case_id}`);
  const metrics:any=defaults(),usageHolder:{usage:any}={usage:null};
  const linked=await ingestLinkedContracts4S(evidence,provider,ledger),baseEvidence=[...evidence,...linked.evidence];
  const request=await prepareRequestGraph4Q(baseEvidence,provider.case_id,provider.candidate_id,ledger);
  const native=await buildNativeHypotheses5B(baseEvidence,provider,ledger);
  const collection=buildStructuredCollectionHypotheses5B4(baseEvidence,provider);
  const allEvidence=[...baseEvidence,...collection.capsules];
  const collectionSourceIds=new Set(collection.proofs.map(p=>p.source_evidence_id));
  const utilityEvidence=[...baseEvidence.filter(e=>!collectionSourceIds.has(e.evidence_id)),...collection.capsules];
  add(metrics,linked.metrics);add(metrics,native.metrics);add(metrics,collection.metrics);

  const nativeProofById=new Map((native.proofs||[]).map((p:any)=>[p.hypothesis_id,p]));
  const collectionProofById=new Map((collection.proofs||[]).map((p:any)=>[p.hypothesis_id,p]));
  const utilityProofById=new Map<string,any>([...(native.proofs||[]),...(collection.proofs||[])].map((p:any)=>[p.hypothesis_id,p]));
  const historicalPrimary=(request.probe_packet||[])[0] as P1RequestHypothesis|undefined;
  const all=[...(request.probe_packet||[]),...(native.hypotheses||[]),...(collection.hypotheses||[])];
  const det=requestOrderingDeterminism5B3(c,all,utilityEvidence,utilityProofById,historicalPrimary);if(!det.ok)metrics.requestOrderingNondeterminismRejects5b3++;
  const preliminary=rankRequestBeam5B3(c,all,utilityEvidence,utilityProofById,historicalPrimary);add(metrics,preliminary.metrics);
  for(const row of preliminary.ordering)if(collectionProofById.has(row.hypothesis_id))metrics.collectionOperationTaskScore5b4+=Number(row.task_score||0);

  const byId=new Map(preliminary.ordering.map((o:any)=>[o.hypothesis_id,o])),dedup:P1RequestHypothesis[]=[],seen=new Set<string>();
  for(const h of preliminary.hypotheses){const fp=shape(h);if(seen.has(fp))continue;seen.add(fp);dedup.push(h)}
  const finalOrdering=dedup.map((h,i)=>({rank:i+1,...(byId.get(h.id)||{hypothesis_id:h.id,request_fingerprint:shape(h)})})),finalFingerprint=sha4u(finalOrdering);
  const primaryFp=historicalPrimary?shape(historicalPrimary):null,primaryDisplaced=!!(primaryFp&&dedup.length&&shape(dedup[0])!==primaryFp);
  metrics.requestUtilityPrimaryDisplaced5b3=primaryDisplaced?1:0;metrics.requestOrderingFingerprintCount5b3=1;
  if(dedup.length>2)metrics.requestUtilityThirdProbeRejects5b3=dedup.length-2;
  const beam=dedup.slice(0,2);
  if(beam[0]&&collectionProofById.has(beam[0].id))metrics.collectionOperationPrimarySelections5b4++;
  if(beam[1]&&collectionProofById.has(beam[1].id))metrics.collectionOperationSecondSelections5b4++;

  const cacheBefore=probeCacheMetrics4R(),rows:any[]=[];let selected:any=null;
  for(let i=0;i<beam.length;i++){
    const h=beam[i],isNative=nativeProofById.has(h.id),isCollection=collectionProofById.has(h.id);
    if(i===1)metrics.requestUtilitySecondProbeCalls5b3++;metrics.requestFirstProbeCalls5b++;
    const row:any=await probeHypothesis4R(h,c.build,ledger);rows.push(row);
    const transport=row.proof.record.disposition==="success",structured=transport&&!!row.structured_format;
    metrics.requestFirstTransport2xx5b+=transport?1:0;metrics.requestFirstStructured2xx5b+=structured?1:0;if(!structured)continue;
    const ground=groundingStats4S(row.proof,c.required),errorEnvelope=semanticErrorEnvelope4V(row.decoded_body,ground.semanticGroundingAccepted);if(errorEnvelope){metrics.requestFirstUnusable2xx5b++;continue}
    const rawD=deterministicPartialProjection4S(row.proof,row.relational_summary,c.input_names,c.required),san=sanitizeProjectionInputs5B2(rawD.projection);add(metrics,san.metrics);
    let projection:any=san.projection,locked=rawD.locked.filter((x:string)=>!san.rejected.includes(x)),unresolved=[...new Set([...rawD.unresolved,...san.rejected])],responseWitness:any=null;
    const repairAttempt=san.rejected.length>0;if(repairAttempt)metrics.strictInheritedRepairAttempts5b2++;
    if(unresolved.length){
      const proofMeta:any=nativeProofById.get(h.id),resolved=await resolveResponseRoles5B(config,{intent:c.intent,root:proofMeta?.spec_root||{},op:proofMeta?.operation||{},proof:row.proof,unresolved});
      add(metrics,resolved.metrics);if(repairAttempt)metrics.strictInheritedRepairResponseResolverCalls5b2+=Number(resolved.metrics?.responseGroundedResolverCalls5b||0);usageHolder.usage=combineUsage5B(usageHolder.usage,resolved.usage);responseWitness=resolved.witness;
      if(responseWitness?.mappings?.length){projection=applyResponseRoleWitness5B(projection,responseWitness);const mapped=new Set<string>(responseWitness.mappings.map((m:any)=>String(m.output_role)));locked=[...locked,...mapped];unresolved=unresolved.filter((x:string)=>!mapped.has(x))}
    }
    if(unresolved.length){metrics.requestFirstUnusable2xx5b++;continue}
    const semantic=deriveSemanticIdentityWitness5B2({inputNames:c.input_names,input:c.build,projection,proof:row.proof});add(metrics,semantic.metrics);
    const usable=responseUsable4V({transport2xx:transport,structured,body:row.decoded_body,groundedRequired:ground.semanticGroundingAccepted,schemaWitnessAvailable:true}).usable&&semantic.ok;
    if(!usable){metrics.requestFirstUnusable2xx5b++;continue}
    if(repairAttempt)metrics.strictInheritedRepairSuccesses5b2++;
    const materialized=materialize4S(provider.case_id,provider.candidate_id,row.proof,projection,row.relational_summary),recoveredByUtility=!!(primaryFp&&shape(h)!==primaryFp);
    materialized.raw.reason=isCollection?`5B4_STRUCTURED_COLLECTION:${h.id}`:`5B4_OPERATION_LOCAL_BEAM:${h.id}`;
    materialized.raw.frozen_request_proof_4u=freezeRequestProof4U(h);materialized.raw.response_role_witness_5b=responseWitness;materialized.raw.semantic_identity_witness_5b2=semantic.witness;
    materialized.raw.input_output_compatibility_fingerprint_5b2=sha4u(Object.entries<any>(projection).filter(([,e])=>e?.op==="INPUT"));materialized.raw.request_utility_rank_5b3=i+1;materialized.raw.request_utility_primary_displaced_5b3=primaryDisplaced;materialized.raw.request_utility_recovered_5b3=recoveredByUtility;materialized.raw.request_ordering_fingerprint_5b3=finalFingerprint;
    materialized.raw.structured_collection_witness_5b4=isCollection?{...collectionProofById.get(h.id),request_ordering_fingerprint:finalFingerprint}:null;
    if(recoveredByUtility)metrics.requestUtilityRecoveredRecipes5b3++;if(isCollection)metrics.collectionOperationConfirmedRecipes5b4++;metrics.requestFirstConfirmedRecipes5b++;if(responseWitness?.mappings?.length)metrics.responseGroundedConfirmedRecipes5b++;metrics.frozenRequestProofs4u++;if(isNative)metrics.frozenNativeRequestProofs4u++;else if(!isCollection)metrics.frozenInheritedRequestProofs4u++;
    selected={row,h,isNative,isCollection,materialized,responseWitness,semantic,locked,rawD};break;
  }

  const cacheAfter=probeCacheMetrics4R();
  const probeMetrics={schemaProbeCalls:rows.length,schemaProbe2xxJson:rows.filter(r=>r.proof.record.disposition==="success"&&r.structured_format==="json").length,schemaProbe2xxStructured:rows.filter(r=>r.proof.record.disposition==="success").length,schemaProbeRejected:rows.filter(r=>r.proof.record.disposition!=="success").length,schemaProbeBytes:rows.filter(r=>r.proof.record.disposition==="success").reduce((n:number,r:any)=>n+Number(r.proof.record.bytes||0),0),probeCacheHits:delta(cacheBefore,cacheAfter,"probeCacheHits"),probeNetworkFetches:delta(cacheBefore,cacheAfter,"probeNetworkFetches"),duplicateProbeNetworkFetches:delta(cacheBefore,cacheAfter,"duplicateProbeNetworkFetches")};
  const common={validation_evidence:allEvidence,linked_contract_evidence_ids:linked.linked_evidence_ids,request_inventory_count:request.hypotheses.length,alignment_metrics:request.metrics,operation_semantics_fingerprint:request.semantics.fingerprint,request_graph_fingerprint:request.graph_fingerprint,request_hypotheses:beam,probe_records:rows.filter(r=>r.proof.record.disposition==="success").map(r=>r.proof.record),request_utility_ordering_5b3:finalOrdering,request_ordering_fingerprint_5b3:finalFingerprint,structured_collection_hypothesis_ids_5b4:collection.hypotheses.map(h=>h.id),structured_collection_proofs_5b4:collection.proofs,...probeMetrics,...metrics};
  if(!selected)return {http_status:0,http_ok:true,parsed_json:{case_id:provider.case_id,provider_candidate_id:provider.candidate_id,decision:"REJECT",reason:"5B4_BEAM_EXHAUSTED"},parse_error:null,usage:usageHolder.usage,latency_ms:0,probe_proof:null,planner_skipped:true,deterministic_mapping:false,row_lookup_selected:false,identity_projection_selected:false,compositional_locked_bindings:0,exact_relational_label_selections:0,structured_format:null,...common};
  const {row,h,isNative,isCollection,materialized,responseWitness,semantic,locked,rawD}=selected;
  return {http_status:0,http_ok:true,parsed_json:materialized.raw,parse_error:null,usage:usageHolder.usage,latency_ms:0,probe_proof:row.proof,operation_proof:materialized.proof,planner_skipped:true,deterministic_mapping:true,row_lookup_selected:rawD.rowLookups>0,identity_projection_selected:rawD.identityInputs>0,selected_from_trace:trace(h),selected_from_documented_role:documentedRole(h),selected_from_linked_contract:(h.evidence_ids||[]).some((id:string)=>linked.linked_evidence_ids.includes(id)),selected_from_native_contract:isNative,selected_from_structured_collection:isCollection,compositional_locked_bindings:locked.length,exact_relational_label_selections:rawD.exactRelationalLabels,structured_format:row.structured_format,response_role_witness_5b:responseWitness,semantic_identity_witness_5b2:semantic.witness,request_utility_recovered_5b3:materialized.raw.request_utility_recovered_5b3,structured_collection_witness_5b4:materialized.raw.structured_collection_witness_5b4,...common};
}
