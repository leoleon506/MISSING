import type {DocEvidence,MicroContract} from "./experiment3wCore.js";
import type {RecoveryLedger} from "./experiment3yrCore.js";
import type {Provider4A} from "./experiment4aContract.js";
import type {ProjectionPlan} from "./experiment4arCore.js";
import {validate4ar,compile4ar,project4ar,validateProjected4ar,scope4ar} from "./experiment4arContract.js";
import {normalizeDocumentedRelativeEndpoint} from "./experiment4ar4Core.js";

function citedText(raw:any,evidence:DocEvidence[],providerId:string){const ids=Array.isArray(raw?.evidence_ids)?raw.evidence_ids:[],by=new Map(evidence.map(e=>[e.evidence_id,e]));const texts:string[]=[];for(const id of ids){const e=by.get(id);if(e&&e.provider_candidate_id===providerId&&e.state==="ok")texts.push(e.text);}return texts.join("\n");}
export function validate4ar4(raw:any,p:Provider4A,evidence:DocEvidence[],ledger:RecoveryLedger){
 const proof=raw?.decision==="COMPILE"?normalizeDocumentedRelativeEndpoint(String(raw?.base_url||""),String(raw?.path_template||""),citedText(raw,evidence,p.candidate_id)):null;
 const v=validate4ar(raw,p,evidence,ledger);if(!proof||!v.contract)return {...v,relative_path_proof:null};
 const errors=v.errors.filter(e=>e!=="path_not_absolute");const contract:MicroContract={...v.contract,base_url:proof.base_url,path_template:proof.path_template};return {...v,errors,contract,relative_path_proof:proof.proof};
}
export function compile4ar4(c:MicroContract,input:Record<string,unknown>){return compile4ar(c,input);}
export function project4ar4(plan:ProjectionPlan,body:any,input:Record<string,unknown>){return project4ar(plan,body,input);}
export function validateProjected4ar4(caseId:string,input:Record<string,any>,out:Record<string,any>){return validateProjected4ar(caseId,input,out);}
export function scope4ar4(start:string,target:string){return scope4ar(start,target);}
