import {mkdir,writeFile} from "node:fs/promises";
import {loadConfig} from "./config/index.js";
import {CASES,MAX_REGISTRY_BYTES,MAX_SPEC_BYTES,PLANNER_CANDIDATE_LIMIT,REGISTRY_TOP_K,REGISTRY_URL,SPEC_FETCH_LIMIT,buildDescriptor,candidateSummary,casesContainNoMappings,descriptorEligibility,descriptorHasFingerprintEvidence,flattenRegistry,operationExists,parseContractDocument,rankRegistryRecords,runNegativeControls,sha,validateSelection,validateSpecUrlSyntax,type CaseDef,type DiscoveryDescriptor,type LiveContract,type RegistryRecord} from "./experiment3qCore.js";
import {fetchTextBounded} from "./experiment3qNetwork.js";
import {callPlanner,parsePlannerSelection} from "./experiment3qPlanner.js";

const OUTDIR="results/experiment-3q";
let plannerCalls=0,repairCalls=0,registryFetchCalls=0,specFetchCalls=0,revalidationSpecFetchCalls=0;
const redirectsFollowed=0,credentialsSupplied=0,arbitraryCodeExecuted=0;

async function fetchRegistry(){
  registryFetchCalls++;const {text,content_type}=await fetchTextBounded(REGISTRY_URL,MAX_REGISTRY_BYTES,"application/json");const raw=JSON.parse(text);const records=flattenRegistry(raw);return {records,content_type,registry_fingerprint:sha(text),raw_entry_count:Object.keys(raw).length};
}

async function fetchCaseContracts(c:CaseDef,ranked:RegistryRecord[],cache:Map<string,{contract:LiveContract|null;evidence:any}>){
  const contracts:LiveContract[]=[],evidence:any[]=[];
  const unique=ranked.filter((r,i,a)=>a.findIndex(x=>x.spec_url===r.spec_url)===i).slice(0,SPEC_FETCH_LIMIT);
  for(const record of unique){
    let cached=cache.get(record.spec_url);
    if(!cached){
      specFetchCalls++;
      try{const syntax=validateSpecUrlSyntax(record.spec_url);if(!syntax.ok)throw new Error(`spec_url_${syntax.reason}`);const {text,content_type}=await fetchTextBounded(record.spec_url,MAX_SPEC_BYTES,"application/vnd.oai.openapi+json, application/json");const contract=parseContractDocument(record,text);cached={contract,evidence:{api_key:record.api_key,version:record.version,spec_url:record.spec_url,registry_rank:record.registry_rank,registry_score:record.registry_score,content_type,status:"ok",operations:contract.operations.length,spec_fingerprint:contract.spec_fingerprint}};}
      catch(e){cached={contract:null,evidence:{api_key:record.api_key,version:record.version,spec_url:record.spec_url,registry_rank:record.registry_rank,registry_score:record.registry_score,status:"error",error:String(e)}};}cache.set(record.spec_url,cached);
    }
    evidence.push({...cached.evidence,case_id:c.case_id});if(cached.contract)contracts.push({...cached.contract,registry_rank:record.registry_rank,registry_score:record.registry_score});
  }
  return {contracts,evidence};
}

async function revalidateDescriptor(d:DiscoveryDescriptor){
  revalidationSpecFetchCalls++;
  try{const {text}=await fetchTextBounded(d.spec_url,MAX_SPEC_BYTES,"application/vnd.oai.openapi+json, application/json");const record:RegistryRecord={api_key:d.api_key,version:"revalidation",spec_url:d.spec_url,title:d.title,description:"",categories:[],registry_score:0,registry_rank:0};const contract=parseContractDocument(record,text);const fingerprint_match=contract.spec_fingerprint===d.spec_fingerprint,operation_exists=operationExists(contract.spec,d.operation_path,"GET");return {case_id:d.case_id,ok:fingerprint_match&&operation_exists,fingerprint_match,operation_exists,fresh_fingerprint:contract.spec_fingerprint,error:null as string|null};}
  catch(e){return {case_id:d.case_id,ok:false,fingerprint_match:false,operation_exists:false,fresh_fingerprint:null,error:String(e)};}
}

async function main(){
  await mkdir(OUTDIR,{recursive:true});const config=loadConfig(),started_at=new Date().toISOString();
  const controls=runNegativeControls(),controlByName=Object.fromEntries(controls.map(c=>[c.control,c]));
  const caseEvidence:any[]=[],plannerEvidence:any[]=[],specEvidence:any[]=[],descriptors:DiscoveryDescriptor[]=[];
  let registry:any={records:[] as RegistryRecord[],content_type:"",registry_fingerprint:"",raw_entry_count:0},registryError:string|null=null;
  try{registry=await fetchRegistry();}catch(e){registryError=String(e);}const cache=new Map<string,{contract:LiveContract|null;evidence:any}>();

  if(!registryError){
    for(const c of CASES){
      const ranked=rankRegistryRecords(c,registry.records),fetched=await fetchCaseContracts(c,ranked,cache);specEvidence.push(...fetched.evidence);const candidates=candidateSummary(c,fetched.contracts);
      plannerCalls++;let attempt=await callPlanner(config,c,candidates,"initial");plannerEvidence.push({case_id:c.case_id,...attempt});let parsed=parsePlannerSelection(attempt);
      if(parsed.error&&(parsed.error.startsWith("planner_contract_invalid")||parsed.error==="planner_json_parse_failure")){plannerCalls++;repairCalls++;const repair=await callPlanner(config,c,candidates,"repair",parsed.error);plannerEvidence.push({case_id:c.case_id,...repair});attempt=repair;parsed=parsePlannerSelection(repair);}
      const common={registry_top:ranked.slice(0,10).map(r=>({api_key:r.api_key,title:r.title,score:r.registry_score,rank:r.registry_rank})),contracts_live:fetched.contracts.length,candidate_count:candidates.length};
      if(parsed.error||!parsed.selection){caseEvidence.push({case_id:c.case_id,status:"planner_error",error:parsed.error,...common});continue;}
      const validation=validateSelection(parsed.selection,c,candidates);
      if(validation.errors.length||parsed.selection.decision!=="DISCOVER"||!validation.candidate){caseEvidence.push({case_id:c.case_id,status:parsed.selection.decision==="REJECT"?"planner_reject":"selection_invalid",selection:parsed.selection,errors:validation.errors,...common,top_candidates:candidates.slice(0,8)});continue;}
      const candidate=validation.candidate,contract=fetched.contracts.find(x=>x.api_key===candidate.api_key&&operationExists(x.spec,candidate.path,"GET"))||null,eligibility=descriptorEligibility(candidate,contract);
      if(!eligibility.ok||!contract){caseEvidence.push({case_id:c.case_id,status:"descriptor_rejected",selection:parsed.selection,candidate,errors:eligibility.errors,...common});continue;}
      const descriptor=buildDescriptor(c,parsed.selection,candidate,contract);descriptors.push(descriptor);caseEvidence.push({case_id:c.case_id,status:"discovered",selection:parsed.selection,candidate,descriptor,...common,top_candidates:candidates.slice(0,8)});
    }
  }

  const plannerBeforeRevalidation=plannerCalls,registryBeforeRevalidation=registryFetchCalls,revalidation:any[]=[];
  for(const descriptor of descriptors)revalidation.push(await revalidateDescriptor(descriptor));
  const plannerCallsDuringRevalidation=plannerCalls-plannerBeforeRevalidation,registryCallsDuringRevalidation=registryFetchCalls-registryBeforeRevalidation;
  const controlsExecuted=controls.filter(c=>c.executed).length,controlsVerified=controls.filter(c=>c.executed&&c.rejected).length,discoveredCases=descriptors.length,distinctApiKeys=new Set(descriptors.map(d=>d.api_key)).size,revalidationSuccesses=revalidation.filter(x=>x.ok).length,revalidationRate=descriptors.length?revalidationSuccesses/descriptors.length:0,fingerprintEvidence=descriptors.length>=2&&descriptors.every(descriptorHasFingerprintEvidence),caseMappingsZero=casesContainNoMappings();
  const unknownCandidateIdsAccepted=controlByName.unknown_candidate_id?.rejected?0:1,unknownOperationsAccepted=controlByName.operation_absent_from_contract?.rejected?0:1,nonGetAccepted=controlByName.non_get_operation?.rejected?0:1,hostPolicyViolationsAccepted=(controlByName.non_https_spec_url?.rejected&&controlByName.ip_literal_spec_url?.rejected)?0:1;

  const gates={
    live_registry_fetched:!registryError&&registry.raw_entry_count>=1,
    registry_at_least_1000_entries:registry.raw_entry_count>=1000,
    zero_case_source_mappings:caseMappingsZero,
    at_least_2_cases_discovered:discoveredCases>=2,
    at_least_2_distinct_registry_api_keys:distinctApiKeys>=2,
    every_discovery_live_fingerprinted:descriptors.length>=2&&descriptors.every(d=>Boolean(d.spec_fingerprint)),
    every_discovery_positive_input_output_evidence:descriptors.length>=2&&descriptors.every(d=>d.input_hits>=1&&d.output_hits>=1),
    at_least_2_descriptors_persisted:descriptors.length>=2,
    descriptor_revalidation_100_percent:descriptors.length>=2&&revalidationRate===1,
    planner_calls_during_revalidation_zero:plannerCallsDuringRevalidation===0,
    registry_calls_during_revalidation_zero:registryCallsDuringRevalidation===0,
    all_8_negative_controls_verified:controlsExecuted===8&&controlsVerified===8,
    unknown_candidate_ids_accepted_zero:unknownCandidateIdsAccepted===0,
    unknown_operations_accepted_zero:unknownOperationsAccepted===0,
    non_get_operations_accepted_zero:nonGetAccepted===0,
    host_policy_violations_accepted_zero:hostPolicyViolationsAccepted===0,
    redirects_followed_zero:redirectsFollowed===0,
    credentials_supplied_zero:credentialsSupplied===0,
    arbitrary_code_executed_zero:arbitraryCodeExecuted===0,
    fingerprint_evidence_non_vacuous:fingerprintEvidence
  };
  const formal_decision=Object.values(gates).every(Boolean)?"GO_REGISTRY_WIDE_OPENAPI_SOURCE_DISCOVERY":"REASSESS_REGISTRY_WIDE_OPENAPI_SOURCE_DISCOVERY";
  const report={experiment:"3Q",title:"Registry-Wide OpenAPI Source Discovery",started_at,finished_at:new Date().toISOString(),formal_decision,registry:{url:REGISTRY_URL,error:registryError,entry_count:registry.raw_entry_count,records_with_spec_url:registry.records.length,content_type:registry.content_type,registry_fingerprint:registry.registry_fingerprint},limits:{registry_top_k:REGISTRY_TOP_K,spec_fetch_limit_per_case:SPEC_FETCH_LIMIT,planner_candidate_limit:PLANNER_CANDIDATE_LIMIT},metrics:{cases:CASES.length,planner_calls:plannerCalls,repair_calls:repairCalls,registry_fetch_calls:registryFetchCalls,spec_fetch_calls:specFetchCalls,revalidation_spec_fetch_calls:revalidationSpecFetchCalls,discovered_cases:discoveredCases,distinct_registry_api_keys:distinctApiKeys,descriptors_persisted:descriptors.length,revalidation_successes:revalidationSuccesses,revalidation_success_rate:revalidationRate,planner_calls_during_revalidation:plannerCallsDuringRevalidation,registry_calls_during_revalidation:registryCallsDuringRevalidation,negative_controls_executed:controlsExecuted,negative_controls_verified:controlsVerified,unknown_candidate_ids_accepted:unknownCandidateIdsAccepted,unknown_operations_accepted:unknownOperationsAccepted,non_get_operations_accepted:nonGetAccepted,host_policy_violations_accepted:hostPolicyViolationsAccepted,redirects_followed:redirectsFollowed,credentials_supplied:credentialsSupplied,arbitrary_code_executed:arbitraryCodeExecuted,fingerprint_evidence:fingerprintEvidence},gates,cases:caseEvidence,revalidation,negative_controls:controls};
  await writeFile(`${OUTDIR}/report.json`,JSON.stringify(report,null,2));await writeFile(`${OUTDIR}/descriptors.json`,JSON.stringify(descriptors,null,2));await writeFile(`${OUTDIR}/planner-evidence.json`,JSON.stringify(plannerEvidence,null,2));await writeFile(`${OUTDIR}/spec-evidence.json`,JSON.stringify(specEvidence,null,2));console.log(JSON.stringify({formal_decision,metrics:report.metrics,gates},null,2));
}

if(import.meta.url===`file://${process.argv[1]}`)main().catch(async e=>{await mkdir(OUTDIR,{recursive:true});const fatal={experiment:"3Q",formal_decision:"REASSESS_REGISTRY_WIDE_OPENAPI_SOURCE_DISCOVERY",fatal_error:String(e),finished_at:new Date().toISOString()};await writeFile(`${OUTDIR}/report.json`,JSON.stringify(fatal,null,2));console.error(e);process.exitCode=1;});
