import type {RecoveryLedger} from "./experiment3yrCore.js";
import {fetchTextSafeR2} from "./experiment3yr2Core.js";

type Ok={ok:true;text:string;content_type:string;final_url:string};
type Err={ok:false;error:string};
type Entry=Ok|Err;
type Kind="acquisition"|"spec";
const CACHE=new Map<string,Entry>();
let acquisitionCacheHits=0,acquisitionNetworkFetches=0,specProbeCacheHits=0,specProbeNetworkFetches=0,duplicateAcquisitionNetworkFetches=0,duplicateSpecProbeNetworkFetches=0;

function key(startUrl:string,url:string){let normalized=url;try{normalized=new URL(url).toString()}catch{}return `${startUrl}\n${normalized}`}
export function resetAcquisitionCache4M(){CACHE.clear();acquisitionCacheHits=0;acquisitionNetworkFetches=0;specProbeCacheHits=0;specProbeNetworkFetches=0;duplicateAcquisitionNetworkFetches=0;duplicateSpecProbeNetworkFetches=0}
export function acquisitionCacheMetrics4M(){return {acquisitionCacheHits,acquisitionNetworkFetches,specProbeCacheHits,specProbeNetworkFetches,duplicateAcquisitionNetworkFetches,duplicateSpecProbeNetworkFetches}}
async function cached(kind:Kind,startUrl:string,url:string,maxBytes:number,ledger:RecoveryLedger){
  const k=key(startUrl,url),prior=CACHE.get(k);
  if(prior){if(kind==="spec")specProbeCacheHits++;else acquisitionCacheHits++;ledger.record("acquisition",kind==="spec"?"spec_cache_hit":"doc_cache_hit",true,{url});if(prior.ok)return {text:prior.text,content_type:prior.content_type,final_url:prior.final_url};throw new Error(prior.error)}
  if(kind==="spec")specProbeNetworkFetches++;else acquisitionNetworkFetches++;
  let entry:Entry;
  try{const got=await fetchTextSafeR2(startUrl,url,maxBytes,ledger);entry={ok:true,text:got.text,content_type:got.content_type,final_url:got.final_url}}catch(e){entry={ok:false,error:String(e).replace(/^Error:\s*/,"")}}
  if(CACHE.has(k)){if(kind==="spec")duplicateSpecProbeNetworkFetches++;else duplicateAcquisitionNetworkFetches++}
  CACHE.set(k,entry);ledger.record("acquisition",kind==="spec"?"spec_cache_store":"doc_cache_store",entry.ok,{url,final_url:entry.ok?entry.final_url:null});
  if(entry.ok)return {text:entry.text,content_type:entry.content_type,final_url:entry.final_url};throw new Error(entry.error)
}
export function fetchDocTextSafe4M(startUrl:string,url:string,maxBytes:number,ledger:RecoveryLedger){return cached("acquisition",startUrl,url,maxBytes,ledger)}
export function fetchSpecTextSafe4M(startUrl:string,url:string,maxBytes:number,ledger:RecoveryLedger){return cached("spec",startUrl,url,maxBytes,ledger)}
