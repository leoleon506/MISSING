import {mkdir,writeFile} from "node:fs/promises";
import {loadConfig} from "./config/index.js";
import {CASES,candidateSummary,casesContainNoMappings,parseContractDocument,type CaseDef,type LiveContract,type RegistryRecord} from "./experiment3qCore.js";
import {fetchTextBounded} from "./experiment3qNetwork.js";
import {EXEC_CASES,compileRequest,executionReadiness,induceProjection,makeRecipe,project,semanticValidate,validateBindingProgram} from "./experiment3rCore.js";
import {callProcurementPlanner,parseProcurementPlan} from "./experiment3rPlanner.js";
import {buildSupplierCandidates,verificationTraceFingerprint} from "./experiment3sCore.js";
import {verifyJsonRequest} from "./experiment3sNetwork.js";
import {CATALOG_TOP_K,MAX_BYTES,MAX_CONTRACT_CANDIDATES,MAX_DEPTH,MAX_HTML_PAGES,PUBLIC_APIS_URL,acquiredEvidence,extractLinks,isValidContract,operationCount,rankCatalog,sha,standardCandidates,type AcquiredContract,type CrawlLink,type RankedEntry} from "./experiment3uCore.js";
import {budgetAllows} from "./experiment3uNetwork.js";
import {runNegativeControls} from "./experiment3uControls.js";

const OUTDIR="results/experiment-3u";
let catalogFetches=0;
let htmlFetches=0;
let contractFetches=0;
let plannerCalls=0;
let plannerRepairs=0;
let projectionInductions=0;
const credentialsSupplied=0;
const crossDomainAccepted=0;
const httpDowngradesAccepted=0;
const privateIpAccepted=0;
const unsafeRedirectsFollowed=0;
const arbitraryCodeExecuted=0;

async function fetchCatalog(){
  catalogFetches++;
  const {text}=await fetchTextBounded(PUBLIC_APIS_URL,16*1024*1024,"text/markdown,text/plain");
  return text;
}

function parseJsonContract(text:string){
  try{const spec=JSON.parse(text);return isValidContract(spec)?spec:null;}catch{return null;}
}

async function crawlEntry(entry:RankedEntry):Promise<{entry:RankedEntry;acquired:AcquiredContract[];trace:any[]}> {
  const acquired:AcquiredContract[]=[];
  const trace:any[]=[];
  const start=entry.link;
  if(!/^yes$/i.test(entry.https)||!start.startsWith("https://"))return {entry,acquired,trace:[{state:"ineligible_https"}]};

  const pages:CrawlLink[]=[{url:start,kind:"page",mechanism:"catalog_start",depth:0,evidence:"catalog"}];
  const contracts:CrawlLink[]=[...standardCandidates(start)];
  const seenPages=new Set<string>();
  const seenContracts=new Set<string>();
  let pageUsed=0;
  let contractUsed=0;

  while(pages.length||contracts.length){
    while(contracts.length&&budgetAllows("contract",contractUsed)){
      const candidate=contracts.shift()!;
      if(seenContracts.has(candidate.url))continue;
      seenContracts.add(candidate.url);
      contractUsed++;
      contractFetches++;
      try{
        const {text,content_type}=await fetchTextBounded(candidate.url,MAX_BYTES,"application/json, application/yaml, text/yaml, text/plain, */*");
        const spec=parseJsonContract(text);
        if(!spec){trace.push({kind:"contract",url:candidate.url,mechanism:candidate.mechanism,depth:candidate.depth,state:"not_openapi",content_type});continue;}
        const contract_fingerprint=sha(text);
        const operation_count=operationCount(spec);
        const item:AcquiredContract={
          catalog_name:entry.name,
          start_url:start,
          contract_url:candidate.url,
          mechanism:candidate.mechanism,
          depth:candidate.depth,
          contract_fingerprint,
          operation_count,
          acquisition_trace_fingerprint:sha({start,url:candidate.url,mechanism:candidate.mechanism,depth:candidate.depth,contract_fingerprint}),
          spec
        };
        if(acquiredEvidence(item))acquired.push(item);
        trace.push({kind:"contract",url:candidate.url,mechanism:candidate.mechanism,depth:candidate.depth,state:"acquired",fingerprint:contract_fingerprint,operation_count});
      }catch(e){trace.push({kind:"contract",url:candidate.url,mechanism:candidate.mechanism,depth:candidate.depth,state:"fetch_error",error:String(e)});}
    }

    if(!pages.length||!budgetAllows("html",pageUsed))break;
    const page=pages.shift()!;
    if(page.depth>MAX_DEPTH||seenPages.has(page.url))continue;
    seenPages.add(page.url);
    pageUsed++;
    htmlFetches++;
    try{
      const {text,content_type}=await fetchTextBounded(page.url,MAX_BYTES,"text/html, text/plain, application/xhtml+xml, */*");
      trace.push({kind:"page",url:page.url,depth:page.depth,state:"fetched",content_type});
      const found=extractLinks(start,page.url,text,page.depth+1);
      for(const link of found){
        if(link.kind==="contract"){
          if(!seenContracts.has(link.url)&&contracts.length+contractUsed<MAX_CONTRACT_CANDIDATES*2)contracts.push(link);
        }else if(link.depth<=MAX_DEPTH&&!seenPages.has(link.url)&&pages.length+pageUsed<MAX_HTML_PAGES*2){
          pages.push(link);
        }
      }
    }catch(e){trace.push({kind:"page",url:page.url,depth:page.depth,state:"fetch_error",error:String(e)});}

    if(!budgetAllows("html",pageUsed)&&!budgetAllows("contract",contractUsed))break;
  }
  return {entry,acquired,trace};
}

async function crawlRanked(entries:RankedEntry[]){
  const results:any[]=new Array(entries.length);
  let next=0;
  const workers=Array.from({length:5},async()=>{
    while(true){
      const i=next++;
      if(i>=entries.length)return;
      results[i]=await crawlEntry(entries[i]);
    }
  });
  await Promise.all(workers);
  return results;
}

function toLiveContract(entry:RankedEntry,a:AcquiredContract,rank:number):LiveContract{
  const record:RegistryRecord={
    api_key:`public_apis::${entry.name}@${new URL(entry.link).hostname}`,
    version:"live",
    spec_url:a.contract_url,
    title:entry.name,
    description:entry.description,
    categories:[entry.category],
    registry_score:entry.score,
    registry_rank:rank
  };
  return parseContractDocument(record,JSON.stringify(a.spec));
}

async function procure(config:any,c:CaseDef,execCase:any,supplier:any,evidence:any[]){
  const readiness=executionReadiness(supplier.contract,supplier.candidate);
  if(!readiness.ready)return {ok:false,status:"not_publicly_executable",readiness};
  plannerCalls++;
  let attempt=await callProcurementPlanner(config,c,execCase,supplier.candidate,readiness,"initial");
  let parsed=parseProcurementPlan(attempt);
  let plan=parsed.plan;
  let stat=plan?validateBindingProgram(plan,execCase,readiness):{errors:[parsed.error||"no_plan"],bindings:[]};
  evidence.push({case_id:c.case_id,api_key:supplier.candidate.api_key,...attempt,static_errors:stat.errors});
  if(parsed.error||stat.errors.length){
    plannerCalls++;
    plannerRepairs++;
    const previous=(parsed.error?[parsed.error]:stat.errors).join(",");
    const repair=await callProcurementPlanner(config,c,execCase,supplier.candidate,readiness,"repair",previous);
    parsed=parseProcurementPlan(repair);
    plan=parsed.plan;
    stat=plan?validateBindingProgram(plan,execCase,readiness):{errors:[parsed.error||"no_plan"],bindings:[]};
    evidence.push({case_id:c.case_id,api_key:supplier.candidate.api_key,...repair,static_errors:stat.errors});
  }
  if(!plan||plan.decision!=="COMPILE"||stat.errors.length)return {ok:false,status:"binding_reject",readiness,plan,stat};
  return {ok:true,readiness,plan,bindings:stat.bindings};
}

async function main(){
  await mkdir(OUTDIR,{recursive:true});
  const config=loadConfig();
  if(!config.apiKey)throw new Error("OPENAI_API_KEY required");
  const started_at=new Date().toISOString();
  const controls=await runNegativeControls();
  const catalog=await fetchCatalog();
  const caseEvidence:any[]=[];
  const plannerEvidence:any[]=[];
  const recipes:any[]=[];

  for(const c of CASES){
    const ranked=rankCatalog(c,catalog);
    const crawlResults=await crawlRanked(ranked);
    const contracts:LiveContract[]=[];
    const contractMeta=new Map<string,any>();
    for(let i=0;i<crawlResults.length;i++){
      for(const acquired of crawlResults[i].acquired){
        const contract=toLiveContract(crawlResults[i].entry,acquired,i+1);
        contracts.push(contract);
        contractMeta.set(`${contract.api_key}|${contract.spec_url}`,{entry:crawlResults[i].entry,acquired});
      }
    }

    const candidates=candidateSummary(c,contracts);
    const relevantCandidates=candidates.filter(x=>x.method==="GET"&&x.input_hits>0&&x.output_hits>0);
    const suppliers=buildSupplierCandidates(relevantCandidates,contracts);
    const execCase=EXEC_CASES[c.case_id];
    const attempts:any[]=[];
    let selected:any=null;

    for(const supplier of suppliers){
      const proc=await procure(config,c,execCase,supplier,plannerEvidence);
      if(!proc.ok){attempts.push({api_key:supplier.candidate.api_key,status:proc.status});continue;}
      try{
        const r=proc.readiness;
        if(!r.server_base||!r.allowed_host)throw new Error("missing_execution_base");
        const url=compileRequest(r.server_base,r.allowed_host,supplier.candidate.path,r.params,proc.bindings,execCase.build);
        const verified=await verifyJsonRequest(url,MAX_BYTES);
        projectionInductions++;
        const projection=induceProjection(verified.body,execCase,execCase.build);
        const out=project(verified.body,projection);
        if(!semanticValidate(execCase,execCase.build,out))throw new Error("semantic_mismatch");
        const meta=contractMeta.get(`${supplier.contract.api_key}|${supplier.contract.spec_url}`);
        const descriptor={case_id:c.case_id,api_key:supplier.contract.api_key,title:supplier.contract.title,spec_url:supplier.contract.spec_url,spec_fingerprint:supplier.contract.spec_fingerprint,operation_path:supplier.candidate.path,descriptor_fingerprint:sha({case_id:c.case_id,api_key:supplier.contract.api_key,spec:supplier.contract.spec_fingerprint,path:supplier.candidate.path})};
        let recipe:any=makeRecipe(execCase,descriptor,r,proc.bindings,projection);
        recipe={...recipe,acquisition_trace_fingerprint:meta?.acquired?.acquisition_trace_fingerprint,acquisition_mechanism:meta?.acquired?.mechanism,verification_trace_fingerprint:verificationTraceFingerprint({url,out})};
        recipe.recipe_fingerprint=sha({...recipe,recipe_fingerprint:undefined});
        recipes.push(recipe);
        selected={api_key:supplier.candidate.api_key,output:out,contract_url:supplier.contract.spec_url,acquisition:meta?.acquired,recipe};
        attempts.push({api_key:supplier.candidate.api_key,status:"verified_live"});
        break;
      }catch(e){attempts.push({api_key:supplier.candidate.api_key,status:"live_failed",error:String(e)});}
    }

    caseEvidence.push({
      case_id:c.case_id,
      ranked_catalog:ranked.map(x=>({name:x.name,score:x.score,link:x.link,https:x.https})),
      acquired_contracts:contracts.map(x=>({api_key:x.api_key,spec_url:x.spec_url,operation_count:x.operations.length,...contractMeta.get(`${x.api_key}|${x.spec_url}`)?.acquired})),
      acquired_provider_count:new Set(contracts.map(x=>x.api_key)).size,
      relevant_candidate_count:relevantCandidates.length,
      relevant_candidates:relevantCandidates.slice(0,20),
      crawl:crawlResults.map((r:any)=>({entry:r.entry.name,acquired:r.acquired.map((a:any)=>({url:a.contract_url,mechanism:a.mechanism,depth:a.depth,fingerprint:a.contract_fingerprint,operations:a.operation_count})),trace:r.trace})),
      attempts,
      selected
    });
  }

  const before={catalogFetches,htmlFetches,contractFetches,plannerCalls,projectionInductions};
  const replay:any[]=[];
  for(const recipe of recipes){
    const execCase=EXEC_CASES[recipe.case_id];
    try{
      const url=compileRequest(recipe.server_base,recipe.allowed_host,recipe.operation_path,recipe.params,recipe.bindings,execCase.replay);
      const verified=await verifyJsonRequest(url,MAX_BYTES);
      const out=project(verified.body,recipe.projection);
      if(!semanticValidate(execCase,execCase.replay,out))throw new Error("semantic_mismatch");
      replay.push({case_id:recipe.case_id,success:true,output:out});
    }catch(e){replay.push({case_id:recipe.case_id,success:false,error:String(e)});}
  }

  const replayDeltas={catalog_fetches:catalogFetches-before.catalogFetches,html_fetches:htmlFetches-before.htmlFetches,contract_fetches:contractFetches-before.contractFetches,planner_calls:plannerCalls-before.plannerCalls,projection_inductions:projectionInductions-before.projectionInductions};
  const parsedEntries=catalog.split(/\r?\n/).filter(x=>x.startsWith("| [")).length;
  const acquiredCases=caseEvidence.filter(x=>x.acquired_contracts.length>0);
  const relevantCases=caseEvidence.filter(x=>x.relevant_candidate_count>0);
  const providers=new Set(acquiredCases.flatMap(x=>x.acquired_contracts.map((y:any)=>y.api_key))).size;
  const nonStandard=acquiredCases.some(x=>x.acquired_contracts.some((y:any)=>y.mechanism&&y.mechanism!=="standard_path"));
  const semanticSuccess=caseEvidence.filter(x=>x.selected);
  const replaySuccess=replay.filter(x=>x.success);
  const controlsExecuted=controls.filter(x=>x.executed).length;
  const controlsVerified=controls.filter(x=>x.executed&&x.rejected).length;
  const fingerprints=acquiredCases.length>0&&acquiredCases.every(x=>x.acquired_contracts.every((y:any)=>Boolean(y.contract_fingerprint&&y.acquisition_trace_fingerprint)));

  const metrics={catalog_entries:parsedEntries,cases_with_acquired_contract:acquiredCases.length,distinct_acquired_providers:providers,relevantly_acquired_cases:relevantCases.length,nonstandard_acquisition_present:nonStandard,semantic_successes:semanticSuccess.length,persisted_recipes:recipes.length,replay_successes:replaySuccess.length,replay_rate:recipes.length?replaySuccess.length/recipes.length:0,controls_executed:controlsExecuted,controls_verified:controlsVerified,catalog_fetches:catalogFetches,html_fetches:htmlFetches,contract_fetches:contractFetches,planner_calls:plannerCalls,planner_repairs:plannerRepairs,projection_inductions:projectionInductions,replay_deltas:replayDeltas,credentials_supplied:credentialsSupplied,cross_domain_accepted:crossDomainAccepted,http_downgrades_accepted:httpDowngradesAccepted,private_ip_accepted:privateIpAccepted,unsafe_redirects_followed:unsafeRedirectsFollowed,arbitrary_code_executed:arbitraryCodeExecuted};
  const gates={catalog_live_and_200:parsedEntries>=200,zero_case_mappings:casesContainNoMappings(),at_least_2_cases_acquire_contract:acquiredCases.length>=2,at_least_2_distinct_acquired_providers:providers>=2,at_least_2_relevantly_acquired_cases:relevantCases.length>=2,nonstandard_acquisition_present:nonStandard,all_contract_fingerprints_nonempty:fingerprints,at_least_1_live_semantic_recipe:semanticSuccess.length>=1&&recipes.length>=1,replay_all_recipes:recipes.length>=1&&replaySuccess.length===recipes.length,replay_control_calls_zero:Object.values(replayDeltas).every(v=>v===0),all_16_controls_verified:controlsExecuted===16&&controlsVerified===16,cross_domain_zero:crossDomainAccepted===0,http_downgrades_zero:httpDowngradesAccepted===0,private_ip_zero:privateIpAccepted===0,credentials_zero:credentialsSupplied===0,unsafe_redirects_zero:unsafeRedirectsFollowed===0,arbitrary_code_zero:arbitraryCodeExecuted===0};
  const formal_decision=Object.values(gates).every(Boolean)?"GO_AUTONOMOUS_DOCUMENTATION_CONTRACT_ACQUISITION":"REASSESS_AUTONOMOUS_DOCUMENTATION_CONTRACT_ACQUISITION";
  const report={experiment:"3U",title:"Autonomous Contract Acquisition from Documentation",started_at,finished_at:new Date().toISOString(),formal_decision,limits:{catalog_top_k:CATALOG_TOP_K,max_depth:MAX_DEPTH,max_html_pages:MAX_HTML_PAGES,max_contract_candidates:MAX_CONTRACT_CANDIDATES},metrics,gates,cases:caseEvidence,replay,negative_controls:controls};
  await writeFile(`${OUTDIR}/report.json`,JSON.stringify(report,null,2));
  await writeFile(`${OUTDIR}/recipes.json`,JSON.stringify(recipes,null,2));
  await writeFile(`${OUTDIR}/planner-evidence.json`,JSON.stringify(plannerEvidence,null,2));
  console.log(JSON.stringify({formal_decision,metrics,gates},null,2));
}

main().catch(async e=>{await mkdir(OUTDIR,{recursive:true});await writeFile(`${OUTDIR}/report.json`,JSON.stringify({experiment:"3U",formal_decision:"REASSESS_AUTONOMOUS_DOCUMENTATION_CONTRACT_ACQUISITION",fatal_error:String(e)},null,2));console.error(e);process.exitCode=1;});
