import type {DocEvidence,MicroContract} from "./experiment3wCore.js";
import type {RecoveryLedger} from "./experiment3yrCore.js";
import type {Provider4A} from "./experiment4aContract.js";
import type {ProjectionPlan} from "./experiment4arCore.js";
import {validate4ar4,compile4ar4,project4ar4,validateProjected4ar4,scope4ar4} from "./experiment4ar4Contract.js";
import {composeVerifiedOpenApiServerPath,exactOriginGrounding} from "./experiment4ar5rCore.js";

export function validate4ar5r(raw:any,p:Provider4A,evidence:DocEvidence[],ledger:RecoveryLedger){
 const composition=composeVerifiedOpenApiServerPath(raw,evidence,p.candidate_id);const prepared=composition?{...raw,base_url:composition.base_url,path_template:composition.path_template}:raw;const grounding=exactOriginGrounding(prepared,evidence,p.candidate_id);const v=validate4ar4(prepared,p,evidence,ledger);let errors=[...v.errors];
 if(grounding&&errors.includes("undocumented_base_url")){errors=errors.filter(e=>e!=="undocumented_base_url");ledger.record("compiler","resolved_url_origin_grounding",true,grounding);}
 if(composition&&errors.includes("undocumented_path")){errors=errors.filter(e=>e!=="undocumented_path");ledger.record("compiler","openapi_server_path_composition",true,composition.proof);}
 return {...v,errors,contract:v.contract as MicroContract,grounding_source:grounding,openapi_composition_proof:composition?.proof??null};
}
export function compile4ar5r(c:MicroContract,input:Record<string,unknown>){return compile4ar4(c,input);}
export function project4ar5r(plan:ProjectionPlan,body:any,input:Record<string,unknown>){return project4ar4(plan,body,input);}
export function validateProjected4ar5r(caseId:string,input:Record<string,any>,out:Record<string,any>){return validateProjected4ar4(caseId,input,out);}
export function scope4ar5r(start:string,target:string){return scope4ar4(start,target);}
