import type {Config} from "./config/index.js";
import type {DocEvidence,FrozenProvider,MicroContract} from "./experiment3wCore.js";
import {synthesizeContract} from "./experiment3wPlanner.js";

export function normalizeReject(raw:any,provider:FrozenProvider){if(!raw||typeof raw!=="object"||Array.isArray(raw))return {normalized:raw,changed:false};if(raw.decision!=="REJECT")return {normalized:raw,changed:false};if(raw.case_id!==provider.case_id||raw.provider_candidate_id!==provider.candidate_id||typeof raw.reason!=="string")return {normalized:raw,changed:false};const normalized={case_id:raw.case_id,provider_candidate_id:raw.provider_candidate_id,decision:"REJECT" as const,reason:raw.reason};return {normalized,changed:Object.keys(raw).some(k=>!["case_id","provider_candidate_id","decision","reason"].includes(k))};}

export async function synthesizeContract3wr(config:Config,provider:FrozenProvider,evidence:DocEvidence[],phase:"initial"|"repair",previousError?:string){const r=await synthesizeContract(config,provider,evidence,phase,previousError);if(r.parsed_json){const n=normalizeReject(r.parsed_json,provider);return {...r,parsed_json:n.normalized as MicroContract,reject_normalized:n.changed};}return {...r,reject_normalized:false};}
