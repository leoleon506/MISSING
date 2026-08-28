import type {RecoveryLedger} from "./experiment3yrCore.js";
import {parseOpenApiText,sha3yr} from "./experiment3yrCore.js";
import {fetchTextSafeR2} from "./experiment3yr2Core.js";
import type {DocEvidence} from "./experiment3wCore.js";
import type {Provider4A} from "./experiment4aContract.js";
import {FOUR_A_BUDGET} from "./experiment4aCore.js";
import {extractLinkedContractCandidates4S,linkedSpecSummary4S} from "./experiment4sLinked.js";

export async function ingestLinkedContracts4S(evidence:DocEvidence[],provider:Provider4A,ledger:RecoveryLedger){
  const candidates=extractLinkedContractCandidates4S(evidence,provider.start_url),added:DocEvidence[]=[];let fetches=0,fetchSuccesses=0,parseSuccesses=0,rejectedCrossProvider=0,operations=0;
  let seq=0;
  for(const c of candidates.slice(0,6)){
    fetches++;
    try{
      const got=await fetchTextSafeR2(provider.start_url,c.target_url,FOUR_A_BUDGET.max_bytes,ledger);fetchSuccesses++;
      const spec=parseOpenApiText(got.text);if(!spec)continue;parseSuccesses++;
      const summary=linkedSpecSummary4S(spec);let opCount=0;try{opCount=JSON.parse(summary).operations?.length||0}catch{}operations+=opCount;
      const evidence_id=`${provider.candidate_id}-lc${String(++seq).padStart(2,"0")}`;
      added.push({evidence_id,provider_candidate_id:provider.candidate_id,requested_url:c.target_url,resolved_url:got.final_url,verified_at:new Date().toISOString(),status:200,content_type:got.content_type,body_fingerprint:sha3yr(got.text),text:`Explicitly linked machine-readable API contract. Source documentation: ${c.source_url}\nContract URL: ${got.final_url}\n${summary}`,state:"ok"});
    }catch{}
  }
  return {evidence:added,metrics:{linkedContractLinksDiscovered:candidates.length,linkedContractFetches:fetches,linkedContractFetchSuccesses:fetchSuccesses,linkedContractParseSuccesses:parseSuccesses,linkedContractRejectedCrossProvider:rejectedCrossProvider,linkedContractOperationsDiscovered:operations},linked_evidence_ids:added.map(e=>e.evidence_id)};
}
