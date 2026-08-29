import type {DocEvidence} from "./experiment3wCore.js";
import {sha} from "./experiment3wCore.js";
import type {Provider4A} from "./experiment4aContract.js";
import {extractOperationInventoryR6R} from "./experiment4ar6rEvidence.js";
import {buildQueryHypotheses5B6 as buildRawQueryHypotheses5B6} from "./experiment5b6Query.js";

function escapeRegex(value:string){return value.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}
function pathMention(text:string,path:string){
  const p=String(path||"").trim();
  if(!p||p==="/"||p.length<3)return false;
  return new RegExp(`${escapeRegex(p)}(?=$|[?&#\\s\"'<>])`,"i").test(text);
}

export function buildQueryHypotheses5B6(evidence:DocEvidence[],provider:Provider4A){
  const base=buildRawQueryHypotheses5B6(evidence,provider);
  const inventory=extractOperationInventoryR6R(evidence,provider.case_id).inventory;
  const proofById=new Map(base.proofs.map(p=>[p.hypothesis_id,p]));
  const kept=base.hypotheses.filter(h=>{
    const proof=proofById.get(h.id);if(!proof)return false;
    const capsule=base.capsules.find(e=>h.evidence_ids.includes(e.evidence_id));if(!capsule)return false;
    const siblings=inventory.filter(op=>op.evidence_ids.includes(proof.source_evidence_id)&&sha({origin:op.origin,path:op.full_path})!==proof.original_endpoint_fingerprint);
    return !siblings.some(op=>pathMention(capsule.text,op.full_path));
  });
  const keepIds=new Set(kept.map(h=>h.id));
  const rejected=base.hypotheses.length-kept.length;
  const capsules=base.capsules.filter(e=>kept.some(h=>h.evidence_ids.includes(e.evidence_id)));
  const proofs=base.proofs.filter(p=>keepIds.has(p.hypothesis_id));
  const fingerprint=sha({hypotheses:kept.map(h=>({id:h.id,origin:h.origin,path:h.full_path,inputs:h.input_bindings,score:h.score})),proofs:proofs.map(p=>p.query_compiler_fingerprint)});
  return {hypotheses:kept,capsules,proofs,metrics:{...base.metrics,querySiblingLeakCandidateRejects5b6:rejected,querySiblingLeakRejects5b6:0,queryHypotheses5b6:kept.length},fingerprint};
}

export function queryCompilerDeterminism5B6(evidence:DocEvidence[],provider:Provider4A){
  const a=buildQueryHypotheses5B6(evidence,provider),b=buildQueryHypotheses5B6(evidence,provider);
  return {ok:a.fingerprint===b.fingerprint&&JSON.stringify(a.hypotheses)===JSON.stringify(b.hypotheses)&&JSON.stringify(a.proofs)===JSON.stringify(b.proofs),fingerprint:a.fingerprint};
}
