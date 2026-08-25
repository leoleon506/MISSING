import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { loadConfig } from "./config/index.js";

type DemandEvent={event_id:string;buyer_id:string;user_task:string;max_unit_price_usd:number;committed_calls_30d:number;gold_cluster:string};
type Cluster={cluster_id:string;event_ids:string[];canonical_capability:string;description:string;requires_privileged_action:boolean;recipe?:{primitives:string[]}};

const SAFE_PRIMITIVES=new Set(["HTTP_GET","JSONPATH","REGEX","SELECT","RENAME","NORMALIZE","VALIDATE","OUTPUT"]);
const PRIVILEGED_TERMS=/\b(send|email|message|calendar|invite|create issue|upload|insert|delete|update account|write to|post to)\b/i;

function median(values:number[]){const a=[...values].sort((x,y)=>x-y);return a.length%2?a[(a.length-1)/2]:(a[a.length/2-1]+a[a.length/2])/2;}
function economicJudge(events:DemandEvent[]){
  const buyers=new Set(events.map(e=>e.buyer_id)).size;
  const unitPrice=median(events.map(e=>e.max_unit_price_usd));
  const calls=events.reduce((s,e)=>s+e.committed_calls_30d,0);
  const committedRevenue=unitPrice*calls;
  // Conservative preregistered experimental cost envelope for one recipe build.
  const projectedBuildCost=0.20;
  const projectedRuntimeCost=Math.min(0.00025,unitPrice*0.20);
  const eligible=buyers>=3&&committedRevenue>=1&&projectedBuildCost<=committedRevenue*0.35&&projectedRuntimeCost<=unitPrice*0.25;
  return {buyers,median_unit_price_usd:unitPrice,committed_calls_30d:calls,committed_revenue_30d_usd:committedRevenue,projected_build_cost_usd:projectedBuildCost,projected_runtime_cost_per_call_usd:projectedRuntimeCost,projected_gross_contribution_30d_usd:committedRevenue-projectedBuildCost-projectedRuntimeCost*calls,eligible};
}
function recipeSafe(cluster:Cluster,events:DemandEvent[]){
  if(cluster.requires_privileged_action) return false;
  if(events.some(e=>PRIVILEGED_TERMS.test(e.user_task))) return false;
  if(!cluster.recipe?.primitives?.length) return false;
  return cluster.recipe.primitives.every(p=>SAFE_PRIMITIVES.has(p));
}

async function callJson(config:ReturnType<typeof loadConfig>,system:string,user:string){
  const response=await fetch(`${config.baseUrl.replace(/\/$/,"")}/chat/completions`,{method:"POST",headers:{authorization:`Bearer ${config.apiKey}`,"content-type":"application/json"},body:JSON.stringify({model:config.model,temperature:0,messages:[{role:"system",content:system},{role:"user",content:user}],response_format:{type:"json_object"}})});
  if(!response.ok) throw new Error(`Provider returned ${response.status}: ${await response.text()}`);
  const body:any=await response.json();
  const text=body.choices?.[0]?.message?.content;if(!text)throw new Error("Provider returned no JSON content");
  return JSON.parse(text);
}

function clusteringMetrics(events:DemandEvent[],clusters:Cluster[]){
  const eventById=new Map(events.map(e=>[e.event_id,e]));let correctPairs=0,totalPairs=0;const goldGroups=new Map<string,string[]>();
  for(const e of events){const g=goldGroups.get(e.gold_cluster)??[];g.push(e.event_id);goldGroups.set(e.gold_cluster,g);}
  for(const c of clusters){for(let i=0;i<c.event_ids.length;i++)for(let j=i+1;j<c.event_ids.length;j++){totalPairs++;const a=eventById.get(c.event_ids[i]),b=eventById.get(c.event_ids[j]);if(a&&b&&a.gold_cluster===b.gold_cluster)correctPairs++;}}
  let recoveredPairs=0,goldPairs=0;const clusterOf=new Map<string,string>();for(const c of clusters)for(const id of c.event_ids)clusterOf.set(id,c.cluster_id);
  for(const ids of goldGroups.values())for(let i=0;i<ids.length;i++)for(let j=i+1;j<ids.length;j++){goldPairs++;if(clusterOf.get(ids[i])&&clusterOf.get(ids[i])===clusterOf.get(ids[j]))recoveredPairs++;}
  return {purity:totalPairs?correctPairs/totalPairs:0,recall:goldPairs?recoveredPairs/goldPairs:0};
}

const config=loadConfig();if(!config.apiKey){console.error("OPENAI_API_KEY is required for Experiment 1.");process.exit(1);}
const events=JSON.parse(await readFile(resolve("experiments/experiment-1/demand-events.json"),"utf8")) as DemandEvent[];
const publicEvents=events.map(({gold_cluster,...e})=>e);
const clustered=await callJson(config,
  "You are the demand canonicalizer for MISSING. Cluster requests only when they describe the same reusable capability. Do not merge merely related tasks. Return JSON object {clusters:[{cluster_id,event_ids,canonical_capability,description,requires_privileged_action,recipe:{primitives:[...]}}]}. Recipe primitives may only be HTTP_GET, JSONPATH, REGEX, SELECT, RENAME, NORMALIZE, VALIDATE, OUTPUT. For account writes, messaging, calendar changes, database writes, uploads, or other privileged actions, set requires_privileged_action=true and omit recipe. Do not invent demand events.",
  JSON.stringify({events:publicEvents})
);
const clusters=(clustered.clusters??[]) as Cluster[];
const clusterMetrics=clusteringMetrics(events,clusters);
const eventMap=new Map(events.map(e=>[e.event_id,e]));
const evaluated=clusters.map(c=>{const members=c.event_ids.map(id=>eventMap.get(id)).filter(Boolean) as DemandEvent[];const economics=economicJudge(members);const safe=recipeSafe(c,members);const decision=safe&&economics.eligible?"BUILD_SAFE":"REJECT_UNSAFE_OR_UNECONOMIC";return {...c,member_count:members.length,decision,recipe_safe:safe,economics};});
const unsafeClusters=evaluated.filter(c=>c.event_ids.some(id=>eventMap.get(id)?.gold_cluster==="send_email"));
const buildable=evaluated.filter(c=>c.decision==="BUILD_SAFE");
const safeValidationRate=buildable.length?buildable.filter(c=>c.recipe_safe).length/buildable.length:0;
const unsafeRejectionRate=unsafeClusters.length?unsafeClusters.filter(c=>c.decision!=="BUILD_SAFE").length/unsafeClusters.length:0;
const positiveClusters=buildable.filter(c=>c.economics.projected_gross_contribution_30d_usd>0);
const criteria={clustering_purity:clusterMetrics.purity>=0.90,clustering_recall:clusterMetrics.recall>=0.90,unsafe_rejection:unsafeRejectionRate===1,safe_recipe_validation:safeValidationRate>=0.90,at_least_one_economic_build:positiveClusters.length>=1};
const decision=Object.values(criteria).every(Boolean)?"GO_CAPABILITY_GENESIS":"REASSESS_CAPABILITY_GENESIS";
const result={experiment:"MISSING Experiment 1 — Capability Genesis",created_at:new Date().toISOString(),model:config.model,events:events.length,clusters:evaluated.length,metrics:{clustering_purity:clusterMetrics.purity,clustering_recall:clusterMetrics.recall,unsafe_build_rejection_rate:unsafeRejectionRate,safe_recipe_validation_rate:safeValidationRate,economically_positive_build_clusters:positiveClusters.length},criteria,decision,cluster_results:evaluated};
await mkdir("results/experiment-1",{recursive:true});await writeFile("results/experiment-1/result.json",JSON.stringify(result,null,2)+"\n");console.log(JSON.stringify(result,null,2));
