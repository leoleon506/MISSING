import {describe,expect,it} from "vitest";
import {readFile} from "node:fs/promises";
import type {ProviderCandidate} from "../src/experiment3vCore.js";
import type {P1RequestHypothesis} from "../src/experiment4ap1Model.js";
import type {DocEvidence} from "../src/experiment3wCore.js";
import {PROVIDER_WEIGHTS_5B3,deterministicProviderSelection5B3,providerOrderingDeterminism5B3} from "../src/experiment5b3Provider.js";
import {rankRequestBeam5B3,requestOrderingDeterminism5B3} from "../src/experiment5b3RequestUtility.js";
import {deriveExperiment5b3Source} from "../src/experiment5b3Derivation.js";

const p=(id:string,name:string,description:string,link:string):ProviderCandidate=>({candidate_id:id,lexical_rank:1,name,description,category:"Development",auth:"No",https:"true",link,score:1});
const c={case_id:"synthetic",intent:"Given a chess username return the canonical username and chess title from a public player profile operation.",input_names:["username"],required_output_leaf_names:["username","title"],required:["username","title"]};
const h=(id:string,path:string,score:number,evidence_id:string):P1RequestHypothesis=>({id,source_operation_id:id,origin:"https://example.invalid",full_path:path,proof_type:"synthetic",evidence_ids:[evidence_id],source_urls:["https://example.invalid/docs"],slots:[{id:"username",name:"username",in:"path",required:true,auth_like:false,literals:[]}],input_bindings:{username:"username"},literal_bindings:{},score,concrete_relation:true});
const e=(id:string,text:string):DocEvidence=>({evidence_id:id,provider_candidate_id:"p",requested_url:"https://example.invalid/docs",resolved_url:"https://example.invalid/docs",verified_at:"now",status:200,content_type:"text/plain",body_fingerprint:id,text,state:"ok"});

describe("Experiment 5B3 deterministic provider selection",()=>{
 it("freezes explicit provider scoring weights",()=>{expect(PROVIDER_WEIGHTS_5B3).toEqual({task_overlap:140,output_support:180,input_support:90,api_evidence:30,public_noauth:20,noise_penalty:60})});
 it("orders identical broad inputs identically with a stable fingerprint",()=>{const broad=[p("generic","Generic Data","Public API providing id name data","https://example.invalid/generic"),p("profile","Player Profile","REST JSON player profile documentation with username and title","https://example.invalid/player")],a=deterministicProviderSelection5B3(c,broad),b=deterministicProviderSelection5B3(c,broad);expect(a.fingerprint).toBe(b.fingerprint);expect(a.ordering).toEqual(b.ordering);expect(providerOrderingDeterminism5B3(c,broad).ok).toBe(true);expect(a.selection.selected[0].candidate_id).toBe("profile")});
 it("required-output support can change ordering when generic task evidence is comparable",()=>{const broad=[p("weak","Chess Player Service","REST JSON chess player service","https://example.invalid/a"),p("strong","Chess Player Service","REST JSON chess player service returns username and title","https://example.invalid/b")],r=deterministicProviderSelection5B3(c,broad);expect(r.selection.selected[0].candidate_id).toBe("strong");expect(r.ordering[0].output_support).toBeGreaterThan(r.ordering[1].output_support)});
});

describe("Experiment 5B3 output-aware request beam",()=>{
 it("displaces a higher-base-score request when another request has stronger output coverage",()=>{const primary=h("stats","/player/{username}/stats",1000,"stats_doc"),profile=h("profile","/player/{username}",500,"profile_doc"),ev=[e("stats_doc","JSON chess statistics ratings wins losses"),e("profile_doc","JSON player profile response fields username and title")],native=new Map<string,any>(),r=rankRequestBeam5B3(c,[primary,profile],ev,native,primary);expect(r.hypotheses[0].id).toBe("profile");expect(r.primary_displaced).toBe(true);expect(r.ordering[0].output_coverage).toBeGreaterThan(r.ordering[1].output_coverage);expect(requestOrderingDeterminism5B3(c,[primary,profile],ev,native,primary).ok).toBe(true)});
 it("uses documented native output coverage as the dominant native signal",()=>{const stats=h("stats","/stats",1000,"d1"),profile=h("profile","/profile",100,"d2"),ev=[e("d1","JSON response"),e("d2","JSON response")],native=new Map<string,any>([["stats",{output_coverage_5b:{supported_roles:[],score:0}}],["profile",{output_coverage_5b:{supported_roles:["username","title"],score:600}}]]),r=rankRequestBeam5B3(c,[stats,profile],ev,native,stats);expect(r.hypotheses[0].id).toBe("profile");expect(r.primary_displaced).toBe(true)});
});

describe("Experiment 5B3 generated integration",()=>{
 it("removes the stochastic provider reranker from generated execution",async()=>{const src=await readFile(new URL("../src/experiment4ar.ts",import.meta.url),"utf8"),out=deriveExperiment5b3Source(src);expect(out).toContain('from "./experiment5b3Provider.js"');expect(out).toContain('from "./experiment5b3Planner.js"');expect(out).not.toContain("callProviderReranker(");expect(out).not.toContain("parseRerankAttempt(");expect(out).toContain('results/experiment-5b3-engine')});
 it("keeps 5B3 runtime free of development provider and case hardcodes",async()=>{const files=["experiment5b3Provider.ts","experiment5b3RequestUtility.ts","experiment5b3Planner.ts","experiment5b3Contract.ts"],text=(await Promise.all(files.map(f=>readFile(new URL(`../src/${f}`,import.meta.url),"utf8")))).join("\n");expect(text).not.toMatch(/pokeapi|dictionaryapi|orbitalwiki|crossref|hackmyip|warnely|ipwhois|pokemon_name_metadata|english_word_definition_metadata|dns_a_record_metadata|country_alpha_metadata/i)});
});
