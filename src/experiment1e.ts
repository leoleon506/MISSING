import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

type Config={source_base_url:string;queries:string[];results_per_query:number;request_spacing_ms:number;min_paid_candidates_per_family:number;min_qualifying_families:number;min_spread_ratio:number;min_absolute_spread_usd:number};
type Service={slug?:string;name?:string;status?:string;payment_ready?:boolean;min_price_usd?:number|string;[key:string]:unknown};

const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));
const arr=(v:any):any[]=>Array.isArray(v)?v:Array.isArray(v?.data)?v.data:Array.isArray(v?.services)?v.services:Array.isArray(v?.items)?v.items:[];
async function getJson(url:string){const r=await fetch(url,{headers:{accept:"application/json","user-agent":"MISSING-Experiment-1E/0.1"}});if(!r.ok)throw new Error(`${r.status} ${r.statusText} for ${url}`);return r.json();}
function price(s:Service){const n=Number(s.min_price_usd);return Number.isFinite(n)&&n>0?n:null;}
function median(xs:number[]){if(!xs.length)return 0;const a=[...xs].sort((x,y)=>x-y),m=Math.floor(a.length/2);return a.length%2?a[m]:(a[m-1]+a[m])/2;}

const cfg=JSON.parse(await readFile(resolve("experiments/experiment-1e/config.json"),"utf8")) as Config;
const raw:any[]=[];const families:any[]=[];
for(const query of cfg.queries){
  const u=new URL(`${cfg.source_base_url}/services`);u.searchParams.set("q",query);u.searchParams.set("per_page",String(cfg.results_per_query));
  const services=arr(await getJson(u.toString())) as Service[];raw.push({query,services});
  const dedup=new Map<string,{slug:string;name:string;price:number}>();
  for(const s of services){const p=price(s);const slug=String(s.slug??s.name??"");if(!slug||p===null)continue;if(s.status&&s.status!=="online")continue;if(s.payment_ready===false)continue;dedup.set(slug,{slug,name:String(s.name??slug),price:p});}
  const candidates=[...dedup.values()].sort((a,b)=>a.price-b.price);const prices=candidates.map(x=>x.price);
  const cheapest=prices[0]??0,second=prices[1]??0,max=prices.at(-1)??0;const ratio=cheapest>0&&second>0?second/cheapest:0;const abs=second>0?second-cheapest:0;
  const spreadCandidate=candidates.length>=cfg.min_paid_candidates_per_family&&ratio>=cfg.min_spread_ratio&&abs>=cfg.min_absolute_spread_usd;
  families.push({query,candidate_count:candidates.length,cheapest_usd:cheapest,second_cheapest_usd:second,median_usd:median(prices),max_usd:max,second_to_cheapest_ratio:ratio,second_minus_cheapest_usd:abs,spread_candidate:spreadCandidate,candidates});
  await sleep(cfg.request_spacing_ms);
}
const qualifying=families.filter(x=>x.spread_candidate);
const criteria={enough_qualifying_families:qualifying.length>=cfg.min_qualifying_families,qualifying_families_have_supply:qualifying.every(x=>x.candidate_count>=cfg.min_paid_candidates_per_family),raw_evidence_persisted:true};
const decision=Object.values(criteria).every(Boolean)?"GO_SYNTHETIC_CAPABILITY_SPREAD":"NO_GO_SYNTHETIC_CAPABILITY_SPREAD";
const summary={experiment:"MISSING Experiment 1E — Synthetic Capability Market Spread",created_at:new Date().toISOString(),config:cfg,metrics:{query_families:families.length,qualifying_families:qualifying.length,total_paid_candidates:families.reduce((n,x)=>n+x.candidate_count,0)},criteria,decision,families};
const evidence={created_at:new Date().toISOString(),source:cfg.source_base_url,limitation:"Same-query results are candidate substitutes only; service min_price_usd may not be the exact matched endpoint price.",raw};
await mkdir("results/experiment-1e",{recursive:true});await writeFile("results/experiment-1e/evidence.json",JSON.stringify(evidence,null,2)+"\n");await writeFile("results/experiment-1e/summary.json",JSON.stringify(summary,null,2)+"\n");console.log(JSON.stringify(summary,null,2));
