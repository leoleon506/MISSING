import {readFileSync} from "node:fs";
import {parsePublicApis} from "./experiment3tCore.js";
import {registrableDomain} from "./experiment3uCore.js";
import {sha3yr} from "./experiment3yrCore.js";

const WORKLOAD_URL=new URL("../experiments/5b19/frozen-selected-provider-workload.json",import.meta.url);
export const FIVE_B19_BASE_SHA="c34be729b6f67dc460ed669ebb8fdf534589fddb";
export const FIVE_B19_PREREG_COMMIT="c47f9f325496678782128bc049b5f18bdfeb9276";
export const FIVE_B19_WORKLOAD_COMMIT="c1e95a350504392f72e9b117c4cbfe21d51fcdb1";
export const FIVE_B19_PUBLIC_APIS_COMMIT="988c57be4616cc9507fd3e8c34adedba5387f079";
export const FIVE_B19_WORKLOAD_FINGERPRINT="c1c58704416e27de80348868d7bde518bfc4696ef05faa187616c05f89f2b3bb";
const AUTH_KEY=/^(?:api[_-]?key|access[_-]?token|token|auth|authorization|key)$/i;

export type FiveB19Primary={family:string;case_id:string;primary_provider_start_url:string;primary_recipe_fingerprint:string;unhealthy_after_5b15:boolean};
export type FiveB19Candidate={family:string;case_id:string;primary_recipe_fingerprint:string;unhealthy_after_5b15:boolean;candidate_id:string;candidate_name:string;selected_position:number;equivalence_reason:string;input_roles_supported:string[];output_roles_supported:string[];historical_5b17_status:string};
export type FiveB19Workload={experiment:string;source_5b17_run_id:number;source_5b17_report_fingerprint:string;source_5b17_engine_fingerprint:string;public_apis_snapshot:{repository:string;commit:string;raw_url:string};primaries:FiveB19Primary[];candidates:FiveB19Candidate[];workload_fingerprint:string};

export function loadFiveB19Workload():FiveB19Workload{return JSON.parse(readFileSync(WORKLOAD_URL,"utf8"))}
export function recomputeFiveB19WorkloadFingerprint(w:FiveB19Workload){return sha3yr({primaries:w.primaries,candidates:w.candidates})}
export function workloadShapeValid5b19(w:FiveB19Workload){const cases=new Set(w.primaries.map(x=>x.case_id));return w.experiment==="5B19"&&w.primaries.length===7&&w.candidates.length===21&&cases.size===7&&w.candidates.every(x=>cases.has(x.case_id)&&x.selected_position>=1)&&w.public_apis_snapshot.commit===FIVE_B19_PUBLIC_APIS_COMMIT&&w.workload_fingerprint===FIVE_B19_WORKLOAD_FINGERPRINT&&recomputeFiveB19WorkloadFingerprint(w)===FIVE_B19_WORKLOAD_FINGERPRINT}
function suffix(id:string){const p=String(id).split("_");return p.length===2?p[1]:""}
export function resolveFrozenCandidates5b19(w:FiveB19Workload,catalogMarkdown:string){const entries=parsePublicApis(catalogMarkdown);return w.candidates.map(row=>{const expected=suffix(row.candidate_id),matches=entries.filter(e=>e.name===row.candidate_name&&sha3yr(`${row.case_id}|${e.name}|${e.link}`).slice(0,10)===expected);return {...row,identity_resolved:matches.length===1,identity_match_count:matches.length,identity_error:matches.length===1?null:matches.length===0?"catalog_identity_not_found":"catalog_identity_ambiguous",link:matches.length===1?matches[0].link:null,auth:matches.length===1?matches[0].auth:null,https:matches.length===1?matches[0].https:null,category:matches.length===1?matches[0].category:null,description:matches.length===1?matches[0].description:null}})}
export function frozenCandidatesForCase5b19(resolved:any[],caseId:string){return resolved.filter(x=>x.case_id===caseId).sort((a,b)=>Number(a.selected_position)-Number(b.selected_position)||String(a.candidate_id).localeCompare(String(b.candidate_id)))}
export function frozenAttemptOrderingFingerprint5b19(rows:any[]){return sha3yr(rows.map(x=>({case_id:x.case_id,candidate_id:x.candidate_id,selected_position:x.selected_position})))}
export function independentPrimaryDomain5b19(primaryUrl:string,candidateUrl:string){try{return registrableDomain(new URL(primaryUrl).hostname)!==registrableDomain(new URL(candidateUrl).hostname)}catch{return false}}
export function authLikeRenderedUrl5b19(raw:string){try{const u=new URL(raw);if(u.username||u.password)return true;for(const [k] of u.searchParams)if(AUTH_KEY.test(k))return true;return false}catch{return true}}
