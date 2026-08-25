import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

type Provider={id:string;cost_usd:number;success_rate:number;latency_ms:number};
type Scenario={id:string;intent:string;buyer_max_price_usd:number;target_success_rate:number;max_total_latency_ms:number;uninsurable:boolean;providers:Provider[]};
type Quote={decision:"ACCEPT"|"REJECT";portfolio:Provider[];predicted_success_rate:number;expected_cost_usd:number;quote_price_usd:number;reason:string};

const CALLS_PER_SCENARIO=10_000;
const TARGET_GROSS_MARGIN=0.40;
const SEED=20250825;

function predictedSuccess(portfolio:Provider[]){return 1-portfolio.reduce((q,p)=>q*(1-p.success_rate),1);}
function expectedCost(portfolio:Provider[]){let reach=1,total=0;for(const p of portfolio){total+=reach*p.cost_usd;reach*=1-p.success_rate;}return total;}
function totalLatency(portfolio:Provider[]){return portfolio.reduce((s,p)=>s+p.latency_ms,0);}

export function underwrite(s:Scenario):Quote{
  const ranked=[...s.providers].sort((a,b)=>(a.cost_usd/Math.max(a.success_rate,1e-9))-(b.cost_usd/Math.max(b.success_rate,1e-9)));
  const portfolio:Provider[]=[];
  for(const p of ranked){
    if(totalLatency([...portfolio,p])>s.max_total_latency_ms) continue;
    portfolio.push(p);
    if(predictedSuccess(portfolio)>=s.target_success_rate) break;
  }
  const success=predictedSuccess(portfolio),cost=expectedCost(portfolio);
  const quote=cost/(1-TARGET_GROSS_MARGIN);
  if(!portfolio.length) return {decision:"REJECT",portfolio,predicted_success_rate:0,expected_cost_usd:0,quote_price_usd:0,reason:"no_provider_within_latency"};
  if(success<s.target_success_rate) return {decision:"REJECT",portfolio,predicted_success_rate:success,expected_cost_usd:cost,quote_price_usd:quote,reason:"sla_not_insurable"};
  if(quote>s.buyer_max_price_usd) return {decision:"REJECT",portfolio,predicted_success_rate:success,expected_cost_usd:cost,quote_price_usd:quote,reason:"price_not_insurable"};
  return {decision:"ACCEPT",portfolio,predicted_success_rate:success,expected_cost_usd:cost,quote_price_usd:quote,reason:"insured"};
}

function rng(seed:number){let x=seed>>>0;return()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return (x>>>0)/4294967296;};}
function hash(text:string){let h=2166136261>>>0;for(const c of text){h^=c.charCodeAt(0);h=Math.imul(h,16777619)>>>0;}return h;}

function simulatePortfolio(s:Scenario,q:Quote){
  const random=rng((SEED^hash(s.id))>>>0);let successes=0,totalProviderCost=0,totalLatencyMs=0;
  for(let i=0;i<CALLS_PER_SCENARIO;i++){
    let elapsed=0,done=false;
    for(const p of q.portfolio){
      elapsed+=p.latency_ms;totalProviderCost+=p.cost_usd;
      if(random()<p.success_rate){done=true;break;}
    }
    totalLatencyMs+=elapsed;if(done)successes++;
  }
  const revenue=successes*q.quote_price_usd;
  return {calls:CALLS_PER_SCENARIO,successes,completion_rate:successes/CALLS_PER_SCENARIO,total_provider_cost_usd:totalProviderCost,revenue_usd:revenue,gross_contribution_usd:revenue-totalProviderCost,gross_margin:revenue?((revenue-totalProviderCost)/revenue):0,average_latency_ms:totalLatencyMs/CALLS_PER_SCENARIO};
}
function simulateBaseline(s:Scenario){
  const candidates=s.providers.filter(p=>p.latency_ms<=s.max_total_latency_ms).sort((a,b)=>a.cost_usd-b.cost_usd);const p=candidates[0];if(!p)return {provider:null,completion_rate:0};
  const random=rng((SEED^hash(`${s.id}:baseline`))>>>0);let successes=0;for(let i=0;i<CALLS_PER_SCENARIO;i++)if(random()<p.success_rate)successes++;
  return {provider:p.id,completion_rate:successes/CALLS_PER_SCENARIO};
}

export function evaluateScenarios(scenarios:Scenario[]){
  const results=scenarios.map(s=>{const quote=underwrite(s);const baseline=simulateBaseline(s);const simulation=quote.decision==="ACCEPT"?simulatePortfolio(s,quote):null;return {scenario_id:s.id,intent:s.intent,uninsurable:s.uninsurable,buyer_max_price_usd:s.buyer_max_price_usd,target_success_rate:s.target_success_rate,quote:{...quote,portfolio:quote.portfolio.map(p=>p.id)},baseline,simulation};});
  const accepted=results.filter(r=>r.quote.decision==="ACCEPT"&&r.simulation);const rejectedMarked=results.filter(r=>r.uninsurable);
  const acceptedQuotesWithinBudget=accepted.every(r=>r.quote.quote_price_usd<=r.buyer_max_price_usd);
  const slaPassRate=accepted.length?accepted.filter(r=>r.simulation!.completion_rate>=r.target_success_rate).length/accepted.length:0;
  const underwriterSuccesses=accepted.reduce((s,r)=>s+r.simulation!.successes,0),totalCalls=accepted.length*CALLS_PER_SCENARIO;
  const aggregateCompletion=totalCalls?underwriterSuccesses/totalCalls:0;
  const aggregateBaseline=accepted.length?accepted.reduce((s,r)=>s+r.baseline.completion_rate,0)/accepted.length:0;
  const allPositive=accepted.every(r=>r.simulation!.gross_contribution_usd>0);
  const rejectedUninsurable=rejectedMarked.length?rejectedMarked.filter(r=>r.quote.decision==="REJECT").length/rejectedMarked.length:0;
  const revenue=accepted.reduce((s,r)=>s+r.simulation!.revenue_usd,0),providerCost=accepted.reduce((s,r)=>s+r.simulation!.total_provider_cost_usd,0);
  const aggregateMargin=revenue?(revenue-providerCost)/revenue:0;
  const metrics={accepted_scenarios:accepted.length,accepted_quotes_within_budget_rate:accepted.length?accepted.filter(r=>r.quote.quote_price_usd<=r.buyer_max_price_usd).length/accepted.length:0,sla_pass_rate:slaPassRate,aggregate_completion_rate:aggregateCompletion,baseline_completion_rate:aggregateBaseline,completion_improvement_pp:(aggregateCompletion-aggregateBaseline)*100,positive_contribution_rate:accepted.length?accepted.filter(r=>r.simulation!.gross_contribution_usd>0).length/accepted.length:0,uninsurable_rejection_rate:rejectedUninsurable,aggregate_gross_margin:aggregateMargin};
  const criteria={accepted_at_least_5:accepted.length>=5,quotes_within_budget:acceptedQuotesWithinBudget,sla_pass:slaPassRate>=0.95,completion_improvement:metrics.completion_improvement_pp>=5,positive_contribution:allPositive,uninsurable_rejection:rejectedUninsurable===1,gross_margin:aggregateMargin>=0.20};
  return {results,metrics,criteria,decision:Object.values(criteria).every(Boolean)?"GO_CAPABILITY_UNDERWRITER":"REASSESS_CAPABILITY_UNDERWRITER"};
}

if(process.argv[1]?.endsWith("experiment1b.ts")||process.argv[1]?.endsWith("experiment1b.js")){
  const scenarios=JSON.parse(await readFile(resolve("experiments/experiment-1b/scenarios.json"),"utf8")) as Scenario[];
  const evaluated=evaluateScenarios(scenarios);const result={experiment:"MISSING Experiment 1B — Capability Underwriter",created_at:new Date().toISOString(),seed:SEED,calls_per_accepted_scenario:CALLS_PER_SCENARIO,target_gross_margin:TARGET_GROSS_MARGIN,...evaluated};
  await mkdir("results/experiment-1b",{recursive:true});await writeFile("results/experiment-1b/result.json",JSON.stringify(result,null,2)+"\n");console.log(JSON.stringify(result,null,2));
}
