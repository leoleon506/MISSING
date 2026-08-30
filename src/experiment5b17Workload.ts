import {readFileSync} from "node:fs";
import {registrableDomain} from "./experiment3uCore.js";
import {sha3yr} from "./experiment3yrCore.js";

const WORKLOAD_URL=new URL("../experiments/5b17/frozen-capability-workload.json",import.meta.url);
export const FIVE_B17_BASE_SHA="e0be1ee904141604b977ac2402585d3da88fc497";
export const FIVE_B17_PREREG_COMMIT="0ec11dbe6c814c8f06c6d5355d36e2240290f045";
export const FIVE_B17_WORKLOAD_COMMIT="869e9f75193075d37b8e6e91c018e8689ae0f4bb";
export const FIVE_B17_PUBLIC_APIS_COMMIT="988c57be4616cc9507fd3e8c34adedba5387f079";
export const FIVE_B17_WORKLOAD_FINGERPRINT="3a4b7ec1a8686c25e692a391839b6bcab685ff55abd815c5d740aa98b3c8e8d6";
const AUTH_KEY=/^(?:api[_-]?key|access[_-]?token|token|auth|authorization|key)$/i;

export type FiveB17Primary={family:string;case_id:string;primary_provider_candidate_id:string;primary_provider_name:string;primary_provider_start_url:string;primary_recipe_fingerprint:string;unhealthy_after_5b15:boolean};
export type FiveB17Workload={experiment:string;source_5b14_run_id:number;source_5b14_report_fingerprint:string;source_5b15_run_id:number;source_5b15_report_fingerprint:string;source_5b16_run_id:number;source_5b16_report_fingerprint:string;public_apis_snapshot:{repository:string;commit:string;raw_url:string};primaries:FiveB17Primary[];unhealthy_primary_recipe_fingerprints:string[];workload_fingerprint:string};

export function loadFiveB17Workload():FiveB17Workload{return JSON.parse(readFileSync(WORKLOAD_URL,"utf8"))}
export function recomputeFiveB17WorkloadFingerprint(w:FiveB17Workload){return sha3yr(w.primaries.map(p=>({family:p.family,case_id:p.case_id,primary_provider_candidate_id:p.primary_provider_candidate_id,primary_provider_name:p.primary_provider_name,primary_provider_start_url:p.primary_provider_start_url,primary_recipe_fingerprint:p.primary_recipe_fingerprint,unhealthy_after_5b15:p.unhealthy_after_5b15})))}
export function workloadShapeValid5b17(w:FiveB17Workload){return w.experiment==="5B17"&&w.primaries.length===7&&w.unhealthy_primary_recipe_fingerprints.length===w.primaries.filter(x=>x.unhealthy_after_5b15).length&&w.public_apis_snapshot.commit===FIVE_B17_PUBLIC_APIS_COMMIT&&w.workload_fingerprint===FIVE_B17_WORKLOAD_FINGERPRINT&&recomputeFiveB17WorkloadFingerprint(w)===FIVE_B17_WORKLOAD_FINGERPRINT}
export function independentPrimaryDomain5b17(primaryUrl:string,candidateUrl:string){try{return registrableDomain(new URL(primaryUrl).hostname)!==registrableDomain(new URL(candidateUrl).hostname)}catch{return false}}
export function authLikeRenderedUrl5b17(raw:string){try{const u=new URL(raw);if(u.username||u.password)return true;for(const [k] of u.searchParams)if(AUTH_KEY.test(k))return true;return false}catch{return true}}
