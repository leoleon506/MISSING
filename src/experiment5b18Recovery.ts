import {createHash} from "node:crypto";
import type {DocEvidence} from "./experiment3wCore.js";
import type {Provider4A} from "./experiment4aContract.js";
import {buildRecoveryLinkQueue5B9} from "./experiment5b9Recovery.js";

const sha=(v:any)=>createHash("sha256").update(typeof v==="string"?v:JSON.stringify(v)).digest("hex");
export const FIVE_B18_ORDINARY_FETCH_LIMIT=4;
export const FIVE_B18_RESERVED_RECOVERY_LIMIT=4;
export const FIVE_B18_TOTAL_FETCH_LIMIT=8;
export const RESERVED_STANDARD_PATHS_5B18=["/openapi.json","/swagger.json","/api/openapi.json","/v3/api-docs","/.well-known/openapi.json"] as const;
export type ReservedRecoveryCandidate5B18={kind:"evidence_link"|"standard_machine_contract";target_url:string;target_url_fingerprint:string;score:number;source_evidence_id:string|null;source_body_fingerprint:string|null;depth:number;reasons:string[];ordering_fingerprint:string};

export function buildReservedRecoveryQueue5B18(evidence:DocEvidence[],provider:Provider4A,seen:ReadonlySet<string>,depthByEvidence:ReadonlyMap<string,number>){
 const fromEvidence=buildRecoveryLinkQueue5B9(evidence,provider,seen,depthByEvidence),byUrl=new Map<string,ReservedRecoveryCandidate5B18>();
 for(const row of fromEvidence.queue){byUrl.set(row.target_url,{kind:"evidence_link",target_url:row.target_url,target_url_fingerprint:row.target_url_fingerprint,score:row.score,source_evidence_id:row.source_evidence_id,source_body_fingerprint:row.source_body_fingerprint,depth:row.depth,reasons:row.reasons,ordering_fingerprint:""})}
 let origin:string|null=null;try{origin=new URL(provider.start_url).origin}catch{}
 if(origin)for(const path of RESERVED_STANDARD_PATHS_5B18){const url=new URL(path,origin).toString();if(seen.has(url))continue;const row:ReservedRecoveryCandidate5B18={kind:"standard_machine_contract",target_url:url,target_url_fingerprint:sha(url),score:15,source_evidence_id:null,source_body_fingerprint:null,depth:1,reasons:["fixed_standard_machine_contract"],ordering_fingerprint:""},prior=byUrl.get(url);if(!prior||row.score>prior.score)byUrl.set(url,row)}
 let queue=[...byUrl.values()].filter(x=>x.depth<=2).sort((a,b)=>b.score-a.score||a.target_url.localeCompare(b.target_url)||(a.source_evidence_id||"").localeCompare(b.source_evidence_id||""));const fp=sha(queue.map(x=>({kind:x.kind,url:x.target_url,score:x.score,source:x.source_evidence_id,depth:x.depth,reasons:x.reasons})));queue=queue.map(x=>({...x,ordering_fingerprint:fp}));return {queue,fingerprint:fp,evidence_link_metrics:fromEvidence.metrics};
}
export function reservedRecoveryOrderingDeterminism5B18(evidence:DocEvidence[],provider:Provider4A,seen:ReadonlySet<string>,depthByEvidence:ReadonlyMap<string,number>){const a=buildReservedRecoveryQueue5B18(evidence,provider,seen,depthByEvidence),b=buildReservedRecoveryQueue5B18(evidence,provider,seen,depthByEvidence);return {ok:a.fingerprint===b.fingerprint&&JSON.stringify(a.queue)===JSON.stringify(b.queue),fingerprint:a.fingerprint}}
