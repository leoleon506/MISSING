import {isIP} from "node:net";
import {runNegativeControls as run3rControls,type NegativeControl as CoreControl,type Recipe} from "./experiment3rCore.js";
import type {Candidate,LiveContract} from "./experiment3qCore.js";

export const MAX_SUPPLIERS_PER_CASE=5;
export type SupplierCandidate={supplier_rank:number;candidate:Candidate;contract:LiveContract};
export type RedirectDecision={ok:boolean;reason:string|null;target_url:string|null;canonical_base:string|null;canonical_host:string|null};

export function buildSupplierCandidates(candidates:Candidate[],contracts:LiveContract[]):SupplierCandidate[]{
  const rows=candidates.filter(c=>c.input_hits>=1&&c.output_hits>=1).sort((a,b)=>b.score-a.score||a.api_key.localeCompare(b.api_key)||a.path.localeCompare(b.path));
  const seen=new Set<string>(),out:SupplierCandidate[]=[];
  for(const candidate of rows){if(seen.has(candidate.api_key))continue;const contract=contracts.find(x=>x.api_key===candidate.api_key&&x.operations.some(o=>o.path===candidate.path&&o.method==="GET"));if(!contract)continue;seen.add(candidate.api_key);out.push({supplier_rank:out.length+1,candidate,contract});if(out.length>=MAX_SUPPLIERS_PER_CASE)break;}
  return out;
}

function normalizePathQuery(u:URL){return `${u.pathname}${u.search}`;}
export function validateRedirect(originalUrl:string,location:string,redirectCount:number):RedirectDecision{
  if(redirectCount>=1)return {ok:false,reason:"redirect_chain_rejected",target_url:null,canonical_base:null,canonical_host:null};
  let original:URL,target:URL;try{original=new URL(originalUrl);target=new URL(location,original);}catch{return {ok:false,reason:"redirect_invalid_location",target_url:null,canonical_base:null,canonical_host:null};}
  if(target.protocol!=="https:")return {ok:false,reason:"redirect_non_https",target_url:null,canonical_base:null,canonical_host:null};
  if(isIP(target.hostname))return {ok:false,reason:"redirect_ip_literal",target_url:null,canonical_base:null,canonical_host:null};
  if(normalizePathQuery(original)!==normalizePathQuery(target))return {ok:false,reason:"redirect_path_changed",target_url:null,canonical_base:null,canonical_host:null};
  const suffix=original.pathname;let basePath=target.pathname.slice(0,Math.max(0,target.pathname.length-suffix.length));if(!basePath||basePath==="/")basePath="";const canonicalBase=`${target.protocol}//${target.host}${basePath}`.replace(/\/$/,"");
  return {ok:true,reason:null,target_url:target.toString(),canonical_base:canonicalBase,canonical_host:target.hostname};
}

export function verificationTraceFingerprint(trace:any){return JSON.stringify(trace).length?import("node:crypto").then(({createHash})=>createHash("sha256").update(JSON.stringify(trace)).digest("hex")):Promise.resolve("");}

export function recipeHas3SFingerprintEvidence(recipes:Array<Recipe&{verification_trace_fingerprint?:string}>){return recipes.length>=2&&recipes.every(r=>Boolean(r.spec_fingerprint&&r.discovery_descriptor_fingerprint&&r.verification_trace_fingerprint&&r.recipe_fingerprint));}

export function runNegativeControls():CoreControl[]{
  const controls=[...run3rControls()];
  const base="https://api.example.test/v1/items?id=1";
  let d=validateRedirect(base,"http://api2.example.test/v1/items?id=1",0);controls.push({control:"redirect_to_http",executed:true,rejected:!d.ok&&d.reason==="redirect_non_https",evidence:d});
  d=validateRedirect(base,"https://127.0.0.1/v1/items?id=1",0);controls.push({control:"redirect_to_ip_literal",executed:true,rejected:!d.ok&&d.reason==="redirect_ip_literal",evidence:d});
  d=validateRedirect(base,"https://api2.example.test/v2/items?id=1",0);controls.push({control:"redirect_path_change",executed:true,rejected:!d.ok&&d.reason==="redirect_path_changed",evidence:d});
  d=validateRedirect(base,"https://api2.example.test/v1/items?id=1",1);controls.push({control:"second_redirect",executed:true,rejected:!d.ok&&d.reason==="redirect_chain_rejected",evidence:d});
  return controls;
}
