import type {DocEvidence} from "./experiment3wCore.js";
import type {RecoveryLedger} from "./experiment3yrCore.js";
import {sha3yr} from "./experiment3yrCore.js";
import {fetchTextSafeR2} from "./experiment3yr2Core.js";
import {discoverReferenceLinks4E} from "./experiment4eRequest.js";
import {recordReferenceExpansionTrace4N,setCurrentTraceContext4N,clearCurrentTraceContext4N} from "./experiment4nTrace.js";

export async function expandReferenceEvidence4N(evidence:DocEvidence[],caseId:string,providerCandidateId:string,ledger:RecoveryLedger,maxFetches=3){
  const links=discoverReferenceLinks4E(evidence),seen=new Set(evidence.map(e=>e.resolved_url||e.requested_url));
  let fetches=0,successes=0,added=0;
  setCurrentTraceContext4N(caseId,providerCandidateId);
  try{
    for(const link of links.slice(0,maxFetches)){
      if(seen.has(link.target))continue;
      fetches++;
      const requested_at=new Date().toISOString();
      try{
        const got=await fetchTextSafeR2(link.sourceUrl,link.target,200000,ledger);
        const text=got.text.slice(0,200000),bytes=Buffer.byteLength(text),ev:any={evidence_id:`4n_ref_${sha3yr({source:link.sourceEvidenceId,target:got.final_url,text:text.slice(0,256)}).slice(0,16)}`,provider_candidate_id:providerCandidateId,requested_url:link.target,resolved_url:got.final_url,verified_at:new Date().toISOString(),status:200,content_type:got.content_type,body_fingerprint:sha3yr(text),text,state:"ok",bytes,source_kind:"4n_reference_expansion",parent_evidence_id:link.sourceEvidenceId};
        evidence.push(ev as DocEvidence);seen.add(got.final_url);successes++;added++;
        recordReferenceExpansionTrace4N({parent_evidence_id:link.sourceEvidenceId,requested_url:link.target,final_url:got.final_url,requested_at,status:200,content_type:got.content_type,text});
        ledger.record("documentation","4n_reference_expansion",true,{source_evidence_id:link.sourceEvidenceId,source_url:link.sourceUrl,target_url:link.target,resolved_url:got.final_url,status:200,bytes,evidence_id:ev.evidence_id});
      }catch(err){
        recordReferenceExpansionTrace4N({parent_evidence_id:link.sourceEvidenceId,requested_url:link.target,final_url:null,requested_at,status:0,content_type:null,text:"",error:String(err).slice(0,200)});
        ledger.record("documentation","4n_reference_expansion",false,{source_evidence_id:link.sourceEvidenceId,target_url:link.target,error:String(err).slice(0,200)});
      }
    }
  }finally{clearCurrentTraceContext4N()}
  return {referenceLinksDiscovered4n:links.length,referenceExpansionFetches4n:fetches,referenceExpansionSuccesses4n:successes,referenceExpansionEvidenceAdded4n:added};
}
