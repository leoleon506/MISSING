import {readFileSync} from "node:fs";
import {parsePublicApis} from "./experiment3tCore.js";
import {registrableDomain} from "./experiment3uCore.js";
import {sha3yr} from "./experiment3yrCore.js";

const WORKLOAD_URL=new URL("../experiments/5b16/frozen-redundancy-workload.json",import.meta.url);
export const FIVE_B16_PUBLIC_APIS_COMMIT="988c57be4616cc9507fd3e8c34adedba5387f079";
export const FIVE_B16_FROZEN_TAIL_FINGERPRINT="a2a757710ec76658d9b87552c354d9823fe38a01153e7453c0172562678aae0f";
export const FIVE_B16_UNHEALTHY_SET_FINGERPRINT="611085fbb5c3286c058bfd4e42e99fd041a1a18eb8630ca72184561edfe9d0b5";
export const FIVE_B16_PRIMARY_SET_FINGERPRINT="9b2fb4684a32f481b5371d5ef5d4e4de0b7b1361a32656a5f65573abd8d62682";
const AUTH_KEY=/^(?:api[_-]?key|access[_-]?token|token|auth|authorization|key)$/i;

export type FiveB16TailEntry={family:string;case_id:string;primary_recipe_fingerprint:string;candidate_id:string;candidate_name:string;selected_position:number;deterministic_rank:number;url_fingerprint:string;duplicate_url_identity:boolean};
export type FiveB16Primary={family:string;case_id:string;primary_provider_candidate_id:string;primary_provider_name:string;primary_provider_start_url:string;primary_recipe_fingerprint:string;primary_selected_position:number;unhealthy_after_5b15:boolean};
export type FiveB16Workload={experiment:string;source_5b14_run_id:number;source_5b14_report_fingerprint:string;source_5b15_run_id:number;source_5b15_report_fingerprint:string;public_apis_snapshot:{repository:string;commit:string;raw_url:string};primaries:FiveB16Primary[];unhealthy_primary_recipe_fingerprints:string[];raw_tail_entries:FiveB16TailEntry[];raw_tail_count:number;distinct_tail_url_identity_count:number;frozen_tail_fingerprint:string;unhealthy_primary_set_fingerprint:string;primary_set_fingerprint:string};
export type FiveB16ResolvedTail=FiveB16TailEntry&{name:string;link:string|null;lexical_rank:number;identity_resolved:boolean;identity_match_count:number;identity_error:string|null};

export function loadFiveB16Workload():FiveB16Workload{return JSON.parse(readFileSync(WORKLOAD_URL,"utf8"))}
function candidateParts(id:string){const m=id.match(/^r2(\d{3})_([0-9a-f]{10})$/);return m?{rank:Number(m[1]),suffix:m[2]}:null}
export function resolveFrozenTail5b16(workload:FiveB16Workload,catalogText:string,caseId:string):FiveB16ResolvedTail[]{
 const catalog=parsePublicApis(catalogText),tail=workload.raw_tail_entries.filter(x=>x.case_id===caseId),linksByFp=new Map<string,string[]>();
 for(const e of catalog){const fp=sha3yr(e.link),rows=linksByFp.get(fp)||[];rows.push(e.link);linksByFp.set(fp,rows)}
 return tail.map(entry=>{const parts=candidateParts(entry.candidate_id),links=[...new Set(linksByFp.get(entry.url_fingerprint)||[])],valid=links.filter(link=>parts&&parts.rank===Number(entry.deterministic_rank)&&sha3yr(`${entry.case_id}|${entry.candidate_name}|${link}`).slice(0,10)===parts.suffix);return {...entry,name:entry.candidate_name,link:valid.length===1?valid[0]:null,lexical_rank:Number(entry.deterministic_rank),identity_resolved:valid.length===1,identity_match_count:valid.length,identity_error:valid.length===1?null:valid.length===0?"frozen_identity_not_resolved":"frozen_identity_ambiguous"}})
}
export function frozenTailForCase5b16(workload:FiveB16Workload,caseId:string){return workload.raw_tail_entries.filter(x=>x.case_id===caseId)}
export function independentProviderDomain5b16(primaryUrl:string,candidateUrl:string){try{return registrableDomain(new URL(primaryUrl).hostname)!==registrableDomain(new URL(candidateUrl).hostname)}catch{return false}}
export function authLikeRenderedUrl5b16(raw:string){try{const u=new URL(raw);if(u.username||u.password)return true;for(const [k] of u.searchParams)if(AUTH_KEY.test(k))return true;return false}catch{return true}}
export function workloadShapeValid5b16(w:FiveB16Workload){return w.experiment==="5B16"&&w.primaries.length===7&&w.raw_tail_entries.length===26&&w.raw_tail_count===26&&w.distinct_tail_url_identity_count===25&&w.public_apis_snapshot.commit===FIVE_B16_PUBLIC_APIS_COMMIT&&w.frozen_tail_fingerprint===FIVE_B16_FROZEN_TAIL_FINGERPRINT&&w.unhealthy_primary_set_fingerprint===FIVE_B16_UNHEALTHY_SET_FINGERPRINT&&w.primary_set_fingerprint===FIVE_B16_PRIMARY_SET_FINGERPRINT&&w.unhealthy_primary_recipe_fingerprints.length===w.primaries.filter(x=>x.unhealthy_after_5b15).length}
