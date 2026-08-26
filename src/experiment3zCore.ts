import {createHash} from "node:crypto";
import type {DocEvidence,MicroContract} from "./experiment3wCore.js";
import {compileMicroRequest,docScopeAllowed} from "./experiment3wCore.js";
import {executeProgram,type ProjectionExpr} from "./experiment3xCore.js";
import {RecoveryLedger} from "./experiment3yrCore.js";

export const Z_SELECTION_FREEZE_SHA="6b79298feb6288f843e0c11c04cfbe7cd4a1a794";
export const Z_POOL_IDS=["dictionary_word_metadata","public_ip_metadata","cryptocurrency_asset_metadata","postal_code_location","isbn_book_metadata","open_food_product_metadata","vehicle_vin_metadata","number_fact_metadata","language_code_metadata"] as const;
const sha=(s:string)=>createHash("sha256").update(s).digest("hex");
export const zSelectionHash=(id:string)=>sha(`${Z_SELECTION_FREEZE_SHA}|${id}`);
export const Z_SELECTED_IDS=[...Z_POOL_IDS].sort((a,b)=>zSelectionHash(a).localeCompare(zSelectionHash(b))).slice(0,3);

export type ZCase={case_id:string;intent:string;input_names:string[];required_output_leaf_names:string[];build:Record<string,unknown>;replay:Record<string,unknown>;required:readonly string[]};
export const Z_CASES:ZCase[]=[
 {case_id:"dictionary_word_metadata",intent:"Given an English word, identify a public machine-readable API operation that can return the queried word and a human-readable dictionary definition.",input_names:["word"],required_output_leaf_names:["word","definition"],build:{word:"hello"},replay:{word:"world"},required:["word","definition"]},
 {case_id:"public_ip_metadata",intent:"Given a public IPv4 address, identify a public machine-readable API operation that can return the queried IP address and a human-readable country name.",input_names:["ip"],required_output_leaf_names:["ip","country_name"],build:{ip:"8.8.8.8"},replay:{ip:"1.1.1.1"},required:["ip","country_name"]},
 {case_id:"cryptocurrency_asset_metadata",intent:"Given a cryptocurrency ticker symbol, identify a public machine-readable API operation that can return the canonical ticker symbol and human-readable asset name.",input_names:["asset_symbol"],required_output_leaf_names:["symbol","name"],build:{asset_symbol:"BTC"},replay:{asset_symbol:"ETH"},required:["symbol","name"]}
];
export const Z_CASE_BY_ID=Object.fromEntries(Z_CASES.map(x=>[x.case_id,x])) as Record<string,ZCase>;

function ciEqual(a:any,b:any){return typeof a==="string"&&a.toLowerCase()===String(b).toLowerCase();}
export function semanticValidateZ(caseId:string,input:Record<string,unknown>,out:Record<string,any>){
 if(caseId==="dictionary_word_metadata")return ciEqual(out.word,input.word)&&typeof out.definition==="string"&&out.definition.trim().length>0;
 if(caseId==="public_ip_metadata")return ciEqual(out.ip,input.ip)&&typeof out.country_name==="string"&&out.country_name.trim().length>0;
 if(caseId==="cryptocurrency_asset_metadata")return ciEqual(out.symbol,input.asset_symbol)&&typeof out.name==="string"&&out.name.trim().length>0;
 return false;
}

export type IntegrationProviderZ={case_id:string,candidate_id:string,name:string,start_url:string};
function evidenceText(ids:string[],all:DocEvidence[],providerId:string){const by=new Map(all.map(e=>[e.evidence_id,e]));const picked:DocEvidence[]=[];for(const id of ids){const e=by.get(id);if(!e)throw new Error(`unknown_evidence_id:${id}`);if(e.provider_candidate_id!==providerId)throw new Error(`cross_provider_evidence:${id}`);if(e.state!=="ok")throw new Error(`non_ok_evidence:${id}`);picked.push(e);}return picked.map(e=>e.text).join("\n");}
function sourceKey(v:string){return v.startsWith("$input.")?v.slice(7):null;}
function fieldGroundedInResponse(leaf:string,text:string){const t=text.toLowerCase(),needle=leaf.toLowerCase();let i=t.indexOf(needle);while(i>=0){const a=Math.max(0,i-700),b=Math.min(t.length,i+needle.length+700),ctx=t.slice(a,b);if(/response|returns?|returned|json|schema|example|sample|output|property|field/.test(ctx))return true;i=t.indexOf(needle,i+needle.length);}return false;}
function literalPathGrounded(path:string,text:string){if(text.includes(path))return true;const normalized=path.replace(/\{[^}]+\}/g,"{}");const candidates=[...text.matchAll(/\/[^\s"'<>`]*/g)].map(m=>m[0].replace(/\{[^}]+\}/g,"{}"));return candidates.some(x=>x===normalized||x.includes(normalized)||normalized.includes(x));}

export function validateIntegrationContractZ(c:any,provider:IntegrationProviderZ,evidence:DocEvidence[],ledger:RecoveryLedger){const errors:string[]=[],ec=Z_CASE_BY_ID[provider.case_id];if(!ec)return {errors:["unknown_case"]};if(!c||typeof c!=="object"||Array.isArray(c))return {errors:["contract_not_object"]};if(c.case_id!==provider.case_id)errors.push("case_id_mismatch");if(c.provider_candidate_id!==provider.candidate_id)errors.push("provider_id_mismatch");if(!["COMPILE","REJECT"].includes(c.decision))errors.push("decision_invalid");if(c.decision!=="COMPILE")return {errors,contract:c as MicroContract};if(c.method!=="GET"){errors.push("method_not_get");ledger.record("guard","non_get",false,c.method);}
 const ids=Array.isArray(c.evidence_ids)?c.evidence_ids:[];if(!ids.length)errors.push("empty_evidence_ids");let text="";try{text=evidenceText(ids,evidence,provider.candidate_id);}catch(e){errors.push(String(e).replace(/^Error:\s*/,""));}
 try{const base=new URL(String(c.base_url||""));if(base.username||base.password){errors.push("credential_bearing_base_url");ledger.record("guard","credentials",false);}if(base.protocol!=="https:"){errors.push("execution_base_non_https");ledger.record("guard","non_https",false,base.toString());}if(text&&!text.includes(base.origin)){errors.push("undocumented_base_url");ledger.record("guard","endpoint_mutations",false,base.origin);}}catch{errors.push("execution_base_invalid");}
 const path=String(c.path_template||"");if(!path.startsWith("/"))errors.push("path_not_absolute");if(text&&!literalPathGrounded(path,text)){errors.push("undocumented_path");ledger.record("guard","endpoint_mutations",false,path);}
 const pb=c.path_bindings&&typeof c.path_bindings==="object"&&!Array.isArray(c.path_bindings)?c.path_bindings:{};const qb=c.query_bindings&&typeof c.query_bindings==="object"&&!Array.isArray(c.query_bindings)?c.query_bindings:{};const op=c.output_paths&&typeof c.output_paths==="object"&&!Array.isArray(c.output_paths)?c.output_paths:{};
 for(const [providerParam,src] of Object.entries(pb)){if(!path.includes(`{${providerParam}}`))errors.push(`path_placeholder_missing:${providerParam}`);const k=sourceKey(String(src));if(!k||!(k in ec.build)){errors.push(`invalid_input_source:${providerParam}`);ledger.record("guard","invented_parameters",false,providerParam);}}
 for(const [providerParam,src] of Object.entries(qb)){const s=String(src);if(s.startsWith("$input.")){const k=sourceKey(s);if(!k||!(k in ec.build)){errors.push(`invalid_input_source:${providerParam}`);ledger.record("guard","invented_parameters",false,providerParam);}}if(text&&!text.toLowerCase().includes(providerParam.toLowerCase())){errors.push(`invented_query_parameter:${providerParam}`);ledger.record("guard","invented_parameters",false,providerParam);}}
 for(const req of ec.required){const p=op[req];if(typeof p!=="string"||!p)errors.push(`missing_output_path:${req}`);else{const leaf=p.split(".").filter(Boolean).pop()||p;if(text&&!fieldGroundedInResponse(leaf,text)){errors.push(`invented_output_field:${req}:${leaf}`);ledger.record("guard","invented_output_fields",false,leaf);}}}
 for(const ph of path.match(/\{([^}]+)\}/g)||[]){const n=ph.slice(1,-1);if(!(n in pb))errors.push(`unbound_path_placeholder:${n}`);}return {errors,contract:c as MicroContract};}

export function compileIntegrationRequestZ(c:MicroContract,input:Record<string,unknown>){return compileMicroRequest(c,input);}
export function contractTo3xProgramZ(c:MicroContract,required:readonly string[]){const outputs:Record<string,ProjectionExpr>={};for(const k of required){const path=String(c.output_paths?.[k]||"");if(!path)throw new Error(`missing_projection_path:${k}`);outputs[k]={op:"FIELD",path};}return outputs;}
export function executeIntegrationProjectionZ(c:MicroContract,caseId:string,body:any,input:Record<string,unknown>){const ec=Z_CASE_BY_ID[caseId];if(!ec)throw new Error("unknown_case");return executeProgram(contractTo3xProgramZ(c,ec.required),body,input);}
export function integrationScopeAllowedZ(start:string,target:string){return docScopeAllowed(start,target);}
export type FailureClassZ="SYSTEM_FAILURE"|"PROVIDER_INELIGIBLE"|"FIXTURE_STALE"|"LIVE_PROVIDER_FAILURE";
export function classifyFailureZ(error:string,status?:number):FailureClassZ{const e=error.toLowerCase();if(status===401||status===403||/auth|required|credential|api[_ -]?key|bearer/.test(e))return "PROVIDER_INELIGIBLE";if(status===404||/not[_ -]?found|fixture|identifier|semantic_validation/.test(e))return "FIXTURE_STALE";if((status!==undefined&&status>=500)||/timeout|fetch failed|dns_|econn|socket/.test(e))return "LIVE_PROVIDER_FAILURE";return "SYSTEM_FAILURE";}
