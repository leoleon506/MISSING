import {describe,expect,it} from "vitest";
import {readFileSync} from "node:fs";
import {flattenRegistry,parseContractDocument,rankRegistryRecords,runNegativeControls,validateOpenApiDocument,validateSpecUrlSyntax,casesContainNoMappings} from "../src/experiment3qCore.js";

const readme=readFileSync("experiments/3q/README.md","utf8");
const core=readFileSync("src/experiment3qCore.ts","utf8");
const code=readFileSync("src/experiment3q.ts","utf8");
const casesBlock=core.slice(core.indexOf("export const CASES="),core.indexOf("export type CaseDef="));

describe("Experiment 3Q preregistration and harness",()=>{
  it("keeps frozen cases free of source mappings and known provider/spec identifiers",()=>{
    expect(casesContainNoMappings()).toBe(true);
    for(const forbidden of ["github","dnd5eapi","openfintech","api.github.com","apis.guru","provider_id","api_key","spec_url","operation_path"]){expect(casesBlock.toLowerCase()).not.toContain(forbidden);}
    expect(readme).toContain("No case may contain a provider name");
  });
  it("freezes broad registry caps and formal decision strings",()=>{
    expect(core).toContain('export const REGISTRY_URL="https://api.apis.guru/v2/list.json"');
    expect(core).toContain("export const REGISTRY_TOP_K=60");expect(core).toContain("export const SPEC_FETCH_LIMIT=20");expect(core).toContain("export const PLANNER_CANDIDATE_LIMIT=24");
    expect(readme).toContain("the live registry contains at least 1,000 API entries");expect(code).toContain("GO_REGISTRY_WIDE_OPENAPI_SOURCE_DISCOVERY");expect(code).toContain("REASSESS_REGISTRY_WIDE_OPENAPI_SOURCE_DISCOVERY");
  });
  it("flattens only live registry-provided specification URLs",()=>{
    const raw={"alpha.example":{preferred:"2",versions:{"1":{swaggerUrl:"https://specs.example/a1.json",info:{title:"Alpha v1"}},"2":{swaggerUrl:"https://specs.example/a2.json",info:{title:"Alpha v2","x-apisguru-categories":["tools"]}}}},"beta.example":{versions:{"1":{swaggerUrl:"https://specs.example/b.json",info:{title:"Beta"}}}}};
    const rows=flattenRegistry(raw);expect(rows).toHaveLength(2);expect(rows.find(x=>x.api_key==="alpha.example")?.spec_url).toBe("https://specs.example/a2.json");expect(rows.find(x=>x.api_key==="alpha.example")?.categories).toEqual(["tools"]);
  });
  it("parses a live-style OpenAPI contract and exposes GET response properties",()=>{
    const record={api_key:"synthetic.example",version:"1",spec_url:"https://synthetic.example/openapi.json",title:"Synthetic",description:"",categories:[],registry_score:1,registry_rank:1};
    const spec={openapi:"3.0.3",info:{title:"Synthetic",version:"1"},paths:{"/items/{id}":{get:{parameters:[{name:"id",in:"path",required:true,schema:{type:"string"}}],responses:{"200":{description:"ok",content:{"application/json":{schema:{type:"object",properties:{id:{type:"string"},name:{type:"string"}}}}}}}}}}};
    expect(validateOpenApiDocument(spec)).toBe(true);const contract=parseContractDocument(record,JSON.stringify(spec));expect(contract.spec_fingerprint).toMatch(/^[a-f0-9]{64}$/);expect(contract.operations).toHaveLength(1);expect(contract.operations[0].response_properties).toEqual(expect.arrayContaining(["id","name"]));
  });
  it("executes and rejects all eight frozen controls through active predicates",()=>{
    const controls=runNegativeControls();expect(controls).toHaveLength(8);expect(controls.every(x=>x.executed)).toBe(true);expect(controls.every(x=>x.rejected)).toBe(true);expect(new Set(controls.map(x=>x.control)).size).toBe(8);
    for(const name of ["non_https_spec_url","ip_literal_spec_url","non_openapi_json","unknown_candidate_id","operation_absent_from_contract","metadata_without_live_spec","empty_spec_fingerprint","non_get_operation"]){expect(controls.some(x=>x.control===name&&x.executed&&x.rejected)).toBe(true);}
  });
  it("rejects unsafe specification URL syntax before DNS or fetch",()=>{expect(validateSpecUrlSyntax("http://example.com/openapi.json").ok).toBe(false);expect(validateSpecUrlSyntax("https://127.0.0.1/openapi.json").ok).toBe(false);expect(validateSpecUrlSyntax("https://example.com/openapi.json").ok).toBe(true);});
  it("uses generic deterministic registry ranking without frozen provider bonuses",()=>{
    const c:any={case_id:"x",intent:"currency metadata",input_names:["currency_id"],required_output_leaf_names:["code","name"]};
    const records:any[]=[{api_key:"foo.example",version:"1",spec_url:"https://foo.example/openapi.json",title:"Currency reference",description:"currency code name metadata",categories:[],registry_score:0,registry_rank:0},{api_key:"bar.example",version:"1",spec_url:"https://bar.example/openapi.json",title:"Unrelated images",description:"photo manipulation",categories:[],registry_score:0,registry_rank:0}];
    const ranked=rankRegistryRecords(c,records);expect(ranked[0].api_key).toBe("foo.example");const retrievalBlock=core.slice(core.indexOf("function scoreRegistryRecord"),core.indexOf("function resolveRef"));for(const provider of ["github","dnd","openfintech","nws","usgs"]){expect(retrievalBlock.toLowerCase()).not.toContain(provider);}
  });
});
