import type {DocEvidence,MicroContract} from "./experiment3wCore.js";
import {BLIND_EXEC_CASES,semanticValidate3y} from "./experiment3yCore.js";
import {EXEC_CASES,semanticValidate,type ExecutionCase} from "./experiment3rCore.js";
import {executeProgram,type ProjectionExpr} from "./experiment3xCore.js";
import {RecoveryLedger} from "./experiment3yrCore.js";
import {compileMicroRequest,docScopeAllowed} from "./experiment3wCore.js";

export type FailureClass="SYSTEM_FAILURE"|"PROVIDER_INELIGIBLE"|"FIXTURE_STALE"|"LIVE_PROVIDER_FAILURE";
export type DevCase={case_id:string;build:Record<string,unknown>;replay:Record<string,unknown>;required:readonly string[];validator:"3y"|"3r"};
export type IntegrationProvider={case_id:string,candidate_id:string,name:string,start_url:string};

export function caseSpec(caseId:string):DevCase|null{
 const y=BLIND_EXEC_CASES[caseId];if(y)return {case_id:caseId,build:y.build,replay:y.replay,required:y.required,validator:"3y"};
 const r=EXEC_CASES[caseId];if(r)return {case_id:caseId,build:r.build,replay:r.replay,required:r.required,validator:"3r"};
 return null;
}
function evidenceText(ids:string[],all:DocEvidence[],providerId:string){const by=new Map(all.map(e=>[e.evidence_id,e]));const picked:DocEvidence[]=[];for(const id of ids){const e=by.get(id);if(!e)throw new Error(`unknown_evidence_id:${id}`);if(e.provider_candidate_id!==providerId)throw new Error(`cross_provider_evidence:${id}`);if(e.state!=="ok")throw new Error(`non_ok_evidence:${id}`);picked.push(e);}return picked.map(e=>e.text).join("\n");}
function sourceKey(v:string){return v.startsWith("$input.")?v.slice(7):null;}
function fieldGroundedInResponse(leaf:string,text:string){const t=text.toLowerCase(),needle=leaf.toLowerCase();let i=t.indexOf(needle);while(i>=0){const a=Math.max(0,i-700),b=Math.min(t.length,i+needle.length+700),ctx=t.slice(a,b);if(/response|returns?|returned|json|schema|example|sample|output|property|field/.test(ctx))return true;i=t.indexOf(needle,i+needle.length);}return false;}
function literalPathGrounded(path:string,text:string){if(text.includes(path))return true;const normalized=path.replace(/\{[^}]+\}/g,"{}");const candidates=[...text.matchAll(/\/[^\s"'<>`]*/g)].map(m=>m[0].replace(/\{[^}]+\}/g,"{}"));return candidates.some(x=>x===normalized||x.includes(normalized)||normalized.includes(x));}

export function validateIntegrationContractR(c:any,provider:IntegrationProvider,evidence:DocEvidence[],ledger:RecoveryLedger){const errors:string[]=[];const ec=caseSpec(provider.case_id);if(!ec)return {errors:["unknown_case"]};if(!c||typeof c!=="object"||Array.isArray(c))return {errors:["contract_not_object"]};if(c.case_id!==provider.case_id)errors.push("case_id_mismatch");if(c.provider_candidate_id!==provider.candidate_id)errors.push("provider_id_mismatch");if(!["COMPILE","REJECT"].includes(c.decision))errors.push("decision_invalid");if(c.decision!=="COMPILE")return {errors,contract:c as MicroContract};if(c.method!=="GET"){errors.push("method_not_get");ledger.record("guard","non_get",false,c.method);}
 const ids=Array.isArray(c.evidence_ids)?c.evidence_ids:[];if(!ids.length)errors.push("empty_evidence_ids");let text="";try{text=evidenceText(ids,evidence,provider.candidate_id);}catch(e){errors.push(String(e).replace(/^Error:\s*/,""));}
 try{const base=new URL(String(c.base_url||""));if(base.username||base.password){errors.push("credential_bearing_base_url");ledger.record("guard","credentials",false);}if(base.protocol!=="https:"){errors.push("execution_base_non_https");ledger.record("guard","non_https",false,base.toString());}if(text&&!text.includes(base.origin)){errors.push("undocumented_base_url");ledger.record("guard","endpoint_mutations",false,base.origin);}}catch{errors.push("execution_base_invalid");}
 const path=String(c.path_template||"");if(!path.startsWith("/"))errors.push("path_not_absolute");if(text&&!literalPathGrounded(path,text)){errors.push("undocumented_path");ledger.record("guard","endpoint_mutations",false,path);}
 const pb=c.path_bindings&&typeof c.path_bindings==="object"&&!Array.isArray(c.path_bindings)?c.path_bindings:{};const qb=c.query_bindings&&typeof c.query_bindings==="object"&&!Array.isArray(c.query_bindings)?c.query_bindings:{};const op=c.output_paths&&typeof c.output_paths==="object"&&!Array.isArray(c.output_paths)?c.output_paths:{};
 for(const [providerParam,src] of Object.entries(pb)){if(!path.includes(`{${providerParam}}`))errors.push(`path_placeholder_missing:${providerParam}`);const k=sourceKey(String(src));if(!k||!(k in ec.build)){errors.push(`invalid_input_source:${providerParam}`);ledger.record("guard","invented_parameters",false,providerParam);}/* provider parameter grounding is established by the documented path template, not by requiring the canonical input name to appear in provider docs */}
 for(const [providerParam,src] of Object.entries(qb)){const s=String(src);if(s.startsWith("$input.")){const k=sourceKey(s);if(!k||!(k in ec.build)){errors.push(`invalid_input_source:${providerParam}`);ledger.record("guard","invented_parameters",false,providerParam);}}if(text&&!text.toLowerCase().includes(providerParam.toLowerCase())){errors.push(`invented_query_parameter:${providerParam}`);ledger.record("guard","invented_parameters",false,providerParam);}}
 for(const req of ec.required){const p=op[req];if(typeof p!=="string"||!p)errors.push(`missing_output_path:${req}`);else{const leaf=p.split(".").filter(Boolean).pop()||p;if(text&&!fieldGroundedInResponse(leaf,text)){errors.push(`invented_output_field:${req}:${leaf}`);ledger.record("guard","invented_output_fields",false,leaf);}}}
 for(const ph of path.match(/\{([^}]+)\}/g)||[]){const n=ph.slice(1,-1);if(!(n in pb))errors.push(`unbound_path_placeholder:${n}`);}return {errors,contract:c as MicroContract};}

export function compileIntegrationRequestR(c:MicroContract,input:Record<string,unknown>){return compileMicroRequest(c,input);}
export function contractTo3xProgram(c:MicroContract,required:readonly string[]){const outputs:Record<string,ProjectionExpr>={};for(const k of required){const path=String(c.output_paths?.[k]||"");if(!path)throw new Error(`missing_projection_path:${k}`);outputs[k]={op:"FIELD",path};}return outputs;}
export function executeIntegrationProjectionR(c:MicroContract,caseId:string,body:any,input:Record<string,unknown>){const ec=caseSpec(caseId);if(!ec)throw new Error("unknown_case");return executeProgram(contractTo3xProgram(c,ec.required),body,input);}
export function validateIntegrationOutputR(caseId:string,input:Record<string,unknown>,out:Record<string,unknown>){const ec=caseSpec(caseId);if(!ec)return false;if(ec.validator==="3y")return semanticValidate3y(caseId,input,out);return semanticValidate(EXEC_CASES[caseId] as ExecutionCase,input,out);}
export function integrationScopeAllowedR(start:string,target:string){return docScopeAllowed(start,target);}
export function classifyFailure(error:string,status?:number):FailureClass{const e=error.toLowerCase();if(status===401||status===403||/auth|required|credential|api[_ -]?key|bearer/.test(e))return "PROVIDER_INELIGIBLE";if(status===404||/not[_ -]?found|fixture|identifier|id.*invalid|semantic_validation/.test(e))return "FIXTURE_STALE";if(status&&status>=500||/timeout|fetch failed|dns_|econn|socket/.test(e))return "LIVE_PROVIDER_FAILURE";return "SYSTEM_FAILURE";}
