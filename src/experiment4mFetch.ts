import type {RecoveryLedger} from "./experiment3yrCore.js";
import {fetchTextSafeR2} from "./experiment3yr2Core.js";
import {registrableDomain} from "./experiment3uCore.js";

type Ok={ok:true;text:string;content_type:string;final_url:string};
type Err={ok:false;error:string};
type Entry=Ok|Err;
type Kind="acquisition"|"spec";
type Fetcher=typeof fetchTextSafeR2;
const CACHE=new Map<string,Entry>();
let acquisitionCacheHits=0,acquisitionNetworkFetches=0,specProbeCacheHits=0,specProbeNetworkFetches=0,duplicateAcquisitionNetworkFetches=0,duplicateSpecProbeNetworkFetches=0;

function key(url:string){try{return new URL(url).toString()}catch{return url}}
function sameScope(startUrl:string,targetUrl:string,finalUrl:string|null,ledger:RecoveryLedger){try{const start=registrableDomain(new URL(startUrl).hostname),target=registrableDomain(new URL(targetUrl).hostname),final=finalUrl?registrableDomain(new URL(finalUrl).hostname):target;if(start!==target||start!==final){ledger.record("guard","cross_domain_docs",false,{start_url:startUrl,target_url:targetUrl,final_url:finalUrl});throw new Error("cross_domain")}}catch(e){if(String(e).includes("cross_domain"))throw e;ledger.record("guard","invalid_url",false,{start_url:startUrl,target_url:targetUrl,final_url:finalUrl});throw new Error("invalid_url")}}
export function resetAcquisitionCache4M(){CACHE.clear();acquisitionCacheHits=0;acquisitionNetworkFetches=0;specProbeCacheHits=0;specProbeNetworkFetches=0;duplicateAcquisitionNetworkFetches=0;duplicateSpecProbeNetworkFetches=0}
export function acquisitionCacheMetrics4M(){return {acquisitionCacheHits,acquisitionNetworkFetches,specProbeCacheHits,specProbeNetworkFetches,duplicateAcquisitionNetworkFetches,duplicateSpecProbeNetworkFetches}}
async function cached(kind:Kind,startUrl:string,url:string,maxBytes:number,ledger:RecoveryLedger,fetcher:Fetcher){
  const k=key(url),prior=CACHE.get(k);
  if(prior){sameScope(startUrl,url,prior.ok?prior.final_url:null,ledger);if(kind==="spec")specProbeCacheHits++;else acquisitionCacheHits++;ledger.record("acquisition",kind==="spec"?"spec_cache_hit":"doc_cache_hit",true,{url:k});if(prior.ok)return {text:prior.text,content_type:prior.content_type,final_url:prior.final_url};throw new Error(prior.error)}
  if(kind==="spec")specProbeNetworkFetches++;else acquisitionNetworkFetches++;
  let entry:Entry;
  try{const got=await fetcher(startUrl,url,maxBytes,ledger);entry={ok:true,text:got.text,content_type:got.content_type,final_url:got.final_url}}catch(e){entry={ok:false,error:String(e).replace(/^Error:\s*/,"")}}
  if(CACHE.has(k)){if(kind==="spec")duplicateSpecProbeNetworkFetches++;else duplicateAcquisitionNetworkFetches++}
  CACHE.set(k,entry);ledger.record("acquisition",kind==="spec"?"spec_cache_store":"doc_cache_store",entry.ok,{url:k,final_url:entry.ok?entry.final_url:null});
  if(entry.ok)return {text:entry.text,content_type:entry.content_type,final_url:entry.final_url};throw new Error(entry.error)
}
export function fetchDocTextSafe4M(startUrl:string,url:string,maxBytes:number,ledger:RecoveryLedger,fetcher:Fetcher=fetchTextSafeR2){return cached("acquisition",startUrl,url,maxBytes,ledger,fetcher)}
export function fetchSpecTextSafe4M(startUrl:string,url:string,maxBytes:number,ledger:RecoveryLedger,fetcher:Fetcher=fetchTextSafeR2){return cached("spec",startUrl,url,maxBytes,ledger,fetcher)}
