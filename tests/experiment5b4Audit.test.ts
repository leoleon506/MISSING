import {describe,expect,it} from "vitest";
import {readFile} from "node:fs/promises";
import type {DocEvidence} from "../src/experiment3wCore.js";
import type {Provider4A} from "../src/experiment4aContract.js";
import {buildStructuredCollectionHypotheses5B4} from "../src/experiment5b4Collection.js";

const caseId="npm_package_metadata";
const provider:Provider4A={case_id:caseId,candidate_id:"synthetic_provider",name:"Synthetic API",start_url:"https://www.example.test/docs"};
function evidence(items:any[]):DocEvidence{return {evidence_id:"ev",provider_candidate_id:provider.candidate_id,requested_url:"https://www.example.test/collection.json",resolved_url:"https://www.example.test/collection.json",verified_at:"now",status:200,content_type:"application/json",body_fingerprint:"body",text:JSON.stringify({info:{name:"Synthetic",schema:"https://schema.getpostman.com/json/collection/v2.1.0/collection.json"},item:[{name:"Package",item:items}]}),state:"ok"}}
const op=(name:string,url:string,response:any[]=[])=>({name,request:{method:"GET",header:[],body:{},url},response});

describe("Experiment 5B4 operation-local output audit",()=>{
  it("does not infer required-output coverage from operation name or request path",()=>{
    const r=buildStructuredCollectionHypotheses5B4([evidence([op("Package Version Metadata","https://api.example.test/package/alice"),op("Package Stats","https://api.example.test/package/alice/stats")])],provider);
    const profile=r.proofs.find(p=>p.operation_name==="Package Version Metadata");
    expect(profile).toBeTruthy();
    expect(profile!.output_coverage_5b.score).toBe(0);
    expect(profile!.output_coverage_5b.supported_roles).toEqual([]);
  });
  it("uses only local example-response fields for collection output coverage",()=>{
    const response=[{name:"OK",code:200,status:"OK",header:[{key:"Content-Type",value:"application/json"}],body:JSON.stringify({name:"demo",version:"1.2.3"})}];
    const r=buildStructuredCollectionHypotheses5B4([evidence([op("Package Metadata","https://api.example.test/package/alice",response),op("Package Stats","https://api.example.test/package/alice/stats")])],provider);
    const profile=r.proofs.find(p=>p.operation_name==="Package Metadata");
    expect(profile).toBeTruthy();
    expect(profile!.output_coverage_5b.score).toBeGreaterThan(0);
    expect(profile!.output_coverage_5b.supported_roles).toContain("version");
  });
  it("records and rejects a capsule that explicitly contains a sibling operation name",()=>{
    const items=[{name:"Package Metadata",description:"See Package Stats",request:{method:"GET",header:[],body:{},url:"https://api.example.test/package/alice"},response:[]},op("Package Stats","https://api.example.test/package/alice/stats")];
    const r=buildStructuredCollectionHypotheses5B4([evidence(items)],provider);
    expect(r.metrics.operationLocalSiblingLeakRejects5b4).toBeGreaterThan(0);
    expect(r.proofs.some(p=>p.operation_name==="Package Metadata")).toBe(false);
  });
});

describe("Experiment 5B4 runtime neutrality",()=>{
  it("contains no development provider, case, endpoint, or exemplar hardcodes",async()=>{
    const files=["experiment5b4Collection.ts","experiment5b4Planner.ts","experiment5b4Contract.ts","experiment5b4Derivation.ts"],text=(await Promise.all(files.map(f=>readFile(new URL(`../src/${f}`,import.meta.url),"utf8")))).join("\n");
    expect(text).not.toMatch(/chess\.com|collection-dev|magnuscarlsen|\berik\b|warnely|ipwhois|pokeapi|dictionaryapi|orbitalwiki|chess_player_metadata|country_alpha_metadata|english_word_definition_metadata|dns_a_record_metadata|ip_geolocation_metadata/i);
  });
});
