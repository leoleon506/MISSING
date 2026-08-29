import {describe,expect,it} from "vitest";
import {readFile} from "node:fs/promises";
import {FOUR_A_CASES as DEVELOPMENT_CASES} from "../src/experiment4aCore.js";
import {FIVE_A_CASES,semanticValidate4a,fiveAWorkloadFingerprint} from "../src/experiment5aCore.js";
import {buildFiveAReport,fiveAPathAllowed,type FiveAIntegrity} from "../src/experiment5aHarness.js";

const validBuildOutputs:Record<string,Record<string,any>>={
 country_alpha_metadata:{country_code:"CR",country_name:"Costa Rica",region:"Americas"},
 city_country_geocode_metadata:{city_name:"Ottawa",country_code:"CA",latitude:45.42,longitude:-75.69},
 pokemon_name_metadata:{name:"pikachu",id:25,height:4},
 english_word_definition_metadata:{word:"hello",definition:"A greeting used when meeting someone."},
 source_repository_metadata:{full_name:"torvalds/linux",default_branch:"master"},
 rust_crate_metadata:{name:"serde",version:"1.0.0"},
 ruby_gem_metadata:{name:"rails",version:"8.0.0"},
 chess_player_metadata:{username:"magnuscarlsen",title:"GM"},
 protein_structure_metadata:{structure_id:"1CRN",title:"Crambin"},
 public_domain_book_metadata:{id:1342,title:"Pride and Prejudice"},
 cve_vulnerability_metadata:{cve_id:"CVE-2021-44228",description:"A sufficiently long human-readable vulnerability description."},
 television_show_metadata:{name:"Breaking Bad",id:169,premiered:"2008-01-20"},
 satellite_catalog_metadata:{norad_catalog_id:25544,name:"ISS (ZARYA)"},
 spdx_license_metadata:{license_id:"MIT",name:"MIT License",osi_approved:true},
 arxiv_preprint_metadata:{arxiv_id:"https://arxiv.org/abs/1706.03762v7",title:"Attention Is All You Need"},
 gene_identifier_metadata:{gene_id:"ENSG00000157764",display_name:"BRAF",species:"homo_sapiens"},
 dns_a_record_metadata:{answer_name:"example.com.",address:"93.184.216.34"},
 ip_geolocation_metadata:{ip_address:"8.8.8.8",country_code:"US",country_name:"United States"}
};
function integrity():FiveAIntegrity{return {ok:true,base_sha:"a0ae7506df5c9be386e8be6a72fce8526aca1e11",prereg_commit:"32cef9733580c3163d0952f483c027281bc5457e",head_sha:"head",base_is_ancestor:true,changed_files:[],unexpected_files:[],first_5a_commit:"32cef9733580c3163d0952f483c027281bc5457e",prereg_unchanged:true,case_count:18,family_count:11,unique_case_ids:true,development_case_overlap:[],all_build_replay_changed:true,workload_fingerprint:fiveAWorkloadFingerprint(),runtime_provider_url_literals:0,errors:[]}}
function rawWithSuccessCount(count:number){const chosen:any[]=[];const used=new Set<string>();for(const c of FIVE_A_CASES){if(chosen.length>=count)break;if(used.has(c.family))continue;used.add(c.family);chosen.push(c)}for(const c of FIVE_A_CASES){if(chosen.length>=count)break;if(!chosen.includes(c))chosen.push(c)}const success=new Set(chosen.map(c=>c.case_id));const caseEvidence=FIVE_A_CASES.map(c=>({case_id:c.case_id,family:c.family,broad_count:20,attempts:[{status:"contract_reject"}],success:success.has(c.case_id)?{candidate_id:`p_${c.case_id}`,output:validBuildOutputs[c.case_id]}:null,elapsed_ms:success.has(c.case_id)?1000:2000}));const recipes=chosen.map((c,i)=>({case_id:c.case_id,provider_candidate_id:`p${i}`,provider_start_url:`https://provider${i}.example/docs`,active_schema_proof:{request_proof_type:"inherited"}})),replay=chosen.map(c=>({case_id:c.case_id,success:true})),rerankEvidence=FIVE_A_CASES.map(c=>({case_id:c.case_id,phase:"initial",http_ok:true}));return {decision:"REASSESS_4W_FEASIBILITY_CONSTRAINED_BINDING_DISTINCTIVE_SEMANTIC_GATE",fingerprint:"engine",caseEvidence,recipes,replay,rerankEvidence,llmUsage:chosen.map(c=>({case_id:c.case_id,cost_usd:.01})),metrics:{replay_deltas:{catalog_fetches:0,reranker_calls:0,documentation_fetches:0,synthesis_calls:0,schema_probe_calls:0},schemaRoleResolverReplayLlmCalls4w:0,validatorGraphMismatchRejects:0,authLikeRenderedRequests:0,knownAuthProbeAttempts:0,wrongTaskProbeAttempts:0,entityIncompatibleStructuralProbeAttempts:0,executedTraceOriginDriftRejects:0,executedTraceRequestMutationRejects:0,nonAuthRequestTextMutations:0,operationExternalRefFetches4u:0,duplicateProbeNetworkFetches:0,duplicateAcquisitionNetworkFetches:0,duplicateSpecProbeNetworkFetches:0,frozenRequestProofMutationRejects4u:0,schemaRoleResolverWitnessMutationRejects4w:0}}}

describe("Experiment 5A preregistered holdout",()=>{
 it("contains exactly 18 novel cases across 11 derived families",()=>{expect(FIVE_A_CASES).toHaveLength(18);expect(new Set(FIVE_A_CASES.map(c=>c.family)).size).toBe(11);expect(new Set(FIVE_A_CASES.map(c=>c.case_id)).size).toBe(18);const dev=new Set(DEVELOPMENT_CASES.map(c=>c.case_id));expect(FIVE_A_CASES.filter(c=>dev.has(c.case_id))).toEqual([])});
 it("changes every replay input",()=>{for(const c of FIVE_A_CASES)expect(c.replay).not.toEqual(c.build)});
 it("accepts every preregistered positive validator control",()=>{for(const c of FIVE_A_CASES)expect(semanticValidate4a(c.case_id,c.build,validBuildOutputs[c.case_id]),c.case_id).toBe(true)});
 it("rejects empty fabricated outputs for every case",()=>{for(const c of FIVE_A_CASES)expect(semanticValidate4a(c.case_id,c.build,{}),c.case_id).toBe(false)});
 it("has a stable non-empty workload fingerprint",()=>{expect(fiveAWorkloadFingerprint()).toMatch(/^[a-f0-9]{64}$/)});
});

describe("Experiment 5A frozen-engine boundary",()=>{
 it("allows only additive 5A paths",()=>{expect(fiveAPathAllowed("experiments/5a/README.md")).toBe(true);expect(fiveAPathAllowed("experiments/5a/ERRATA.md")).toBe(true);expect(fiveAPathAllowed("experiments/5a/HOTFIX-001.md")).toBe(true);expect(fiveAPathAllowed("src/experiment5a.ts")).toBe(true);expect(fiveAPathAllowed("tests/experiment5a.test.ts")).toBe(true);expect(fiveAPathAllowed(".github/workflows/run-experiment-5a.yml")).toBe(true);expect(fiveAPathAllowed("src/experiment4wPlanner.ts")).toBe(false);expect(fiveAPathAllowed("package.json")).toBe(false)});
 it("contains no literal provider URL seed in 5A runtime TypeScript",async()=>{const files=["experiment5aCore.ts","experiment5aHarness.ts","experiment5a.ts"],text=(await Promise.all(files.map(f=>readFile(new URL(`../src/${f}`,import.meta.url),"utf8")))).join("\n");expect(text).not.toMatch(/https?:\/\/[A-Za-z0-9]/)});
 it("waits for the frozen 4W child process instead of racing an in-process import",async()=>{const text=await readFile(new URL("../src/experiment5a.ts",import.meta.url),"utf8");expect(text).toContain("execFileSync(process.execPath");expect(text).toContain('"src/experiment4w.ts"');expect(text).not.toContain('await import("./experiment4w.js")')});
});

describe("Experiment 5A decision logic",()=>{
 it("GO requires six successful cases from six families/providers with safe replay",()=>{const report=buildFiveAReport(rawWithSuccessCount(6),integrity());expect(report.decision).toBe("GO_5A_BLIND_GENERALIZATION_HOLDOUT");expect(report.metrics.successful_manufactures).toBe(6);expect(report.metrics.families_with_success).toBe(6);expect(report.metrics.replay_rate).toBe(1);expect(Object.values(report.gates).every(Boolean)).toBe(true)});
 it("does not lower the frozen six-of-eighteen threshold",()=>{const report=buildFiveAReport(rawWithSuccessCount(5),integrity());expect(report.decision).toBe("REASSESS_5A_BLIND_GENERALIZATION_HOLDOUT");expect(report.gates.at_least_6_manufactures).toBe(false)});
 it("invalidates rather than reassesses when engine integrity fails",()=>{const bad={...integrity(),ok:false,errors:["unexpected_changed_files:src/experiment4wPlanner.ts"]};const report=buildFiveAReport(rawWithSuccessCount(6),bad);expect(report.decision).toBe("INVALID_5A_ENGINE_INTEGRITY")});
});
