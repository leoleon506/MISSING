import {describe,expect,it} from "vitest";
import {readFileSync} from "node:fs";
import {CASES,type Candidate,type LiveContract} from "../src/experiment3qCore.js";
import {EXEC_CASES,compileRequest,deriveExecutionBase,executionReadiness,hasRecipeFingerprintEvidence,induceProjection,runNegativeControls,semanticValidate,validateBindingProgram,type ProcurementPlan,type Recipe} from "../src/experiment3rCore.js";

const readme=readFileSync("experiments/3r/README.md","utf8");
const runner=readFileSync("src/experiment3r.ts","utf8");
const discoveryCore=readFileSync("src/experiment3qCore.ts","utf8");

describe("Experiment 3R preregistration and execution core",()=>{
  it("reuses the exact 3Q discovery constants and functions rather than introducing provider mappings",()=>{
    expect(runner).toContain("REGISTRY_TOP_K");expect(runner).toContain("SPEC_FETCH_LIMIT");expect(runner).toContain("PLANNER_CANDIDATE_LIMIT");expect(runner).toContain("rankRegistryRecords");expect(runner).toContain("candidateSummary");expect(runner).toContain("callDiscoveryPlanner");
    expect(discoveryCore).toContain("export const REGISTRY_TOP_K=60");expect(discoveryCore).toContain("export const SPEC_FETCH_LIMIT=20");expect(discoveryCore).toContain("export const PLANNER_CANDIDATE_LIMIT=24");
    expect(readme).toContain("same three capability cases from 3Q");expect(CASES.map(x=>x.case_id)).toEqual(Object.keys(EXEC_CASES));
    for(const forbidden of ["dnd5eapi.co","openfintech.io","api.github.com","/api/ability-scores","/currencies","/repos/{owner}/{repo}"]){expect(runner.toLowerCase()).not.toContain(forbidden.toLowerCase());}
  });

  it("derives HTTPS execution bases generically from OpenAPI and Swagger contracts",()=>{
    expect(deriveExecutionBase({openapi:"3.0.3",servers:[{url:"https://api.example.test/v2"}]},"https://registry.test/spec.json")).toBe("https://api.example.test/v2");
    expect(deriveExecutionBase({swagger:"2.0",schemes:["https"],host:"api.example.test",basePath:"/v1/"},"https://registry.test/spec.json")).toBe("https://api.example.test/v1");
    expect(deriveExecutionBase({swagger:"2.0",schemes:["http"],host:"api.example.test"},"https://registry.test/spec.json")).toBeNull();
  });

  it("rejects auth-required discovered operations before execution",()=>{
    const spec:any={openapi:"3.0.3",servers:[{url:"https://api.example.test"}],security:[{apiKey:[]}],paths:{"/items/{id}":{get:{parameters:[{name:"id",in:"path",required:true,schema:{type:"string"}}],responses:{"200":{description:"ok"}}}}}};
    const contract:LiveContract={api_key:"example.test",version:"1",spec_url:"https://registry.test/spec.json",title:"Example",spec,spec_fingerprint:"abc",operations:[{path:"/items/{id}",method:"GET",operation_id:"",summary:"",description:"",params:[],response_properties:[]}],registry_rank:1,registry_score:1};
    const candidate:Candidate={candidate_id:"c",api_key:"example.test",title:"Example",path:"/items/{id}",method:"GET",operation_id:"",summary:"",description:"",params:[],response_properties:[],score:1,input_hits:1,output_hits:1,registry_rank:1};
    const readiness=executionReadiness(contract,candidate);expect(readiness.ready).toBe(false);expect(readiness.errors).toContain("auth_required");
  });

  it("compiles direct typed bindings and rejects undeclared or missing inputs",()=>{
    const readiness:any={ready:true,errors:[],server_base:"https://api.example.test",allowed_host:"api.example.test",operation_raw:{},params:[{name:"index",in:"path",required:true,description:"",schema:{type:"string"}}]};const execCase=EXEC_CASES.fantasy_role_playing_ability_score_metadata;
    const good:ProcurementPlan={case_id:execCase.case_id,decision:"COMPILE",candidate_id:"c",reason:"",bindings:[{name:"index",kind:"DIRECT",source:"$input.ability_index",delimiter:"",index:-1,literal:""},...Array.from({length:5},()=>({name:"",kind:"UNUSED" as const,source:"",delimiter:"",index:-1,literal:""}))]};
    const validated=validateBindingProgram(good,execCase,readiness);expect(validated.errors).toEqual([]);expect(compileRequest(readiness.server_base,readiness.allowed_host,"/ability/{index}",readiness.params,validated.bindings,execCase.build)).toBe("https://api.example.test/ability/cha");
    const bad={...good,bindings:[{name:"missing",kind:"DIRECT" as const,source:"$input.ability_index",delimiter:"",index:-1,literal:""},...good.bindings.slice(1)]};expect(validateBindingProgram(bad,execCase,readiness).errors.some(x=>x.startsWith("undeclared_parameter:"))).toBe(true);
  });

  it("induces a semantic projection during build and validates identity",()=>{
    const execCase=EXEC_CASES.currency_metadata,body={data:[{attributes:{code:"USD",name:"US Dollar"}},{attributes:{code:"EUR",name:"Euro"}}]};const projection=induceProjection(body,execCase,execCase.build);expect(projection.code).toBe("data.0.attributes.code");expect(projection.name).toBe("data.0.attributes.name");expect(semanticValidate(execCase,execCase.build,{code:"USD",name:"US Dollar"})).toBe(true);expect(semanticValidate(execCase,execCase.build,{code:"EUR",name:"Euro"})).toBe(false);
  });

  it("executes and rejects all eleven frozen negative controls through active predicates",()=>{
    const controls=runNegativeControls();expect(controls).toHaveLength(11);expect(controls.every(c=>c.executed)).toBe(true);expect(controls.every(c=>c.rejected)).toBe(true);expect(new Set(controls.map(c=>c.control)).size).toBe(11);
    for(const name of ["non_https_execution_base","ip_literal_execution_host","auth_required_operation","operation_absent_from_contract","undeclared_bound_parameter","missing_required_parameter","direct_missing_input","split_out_of_range","unsupported_transform","semantic_identity_mismatch","empty_recipe_fingerprint_evidence"]){expect(controls.some(c=>c.control===name&&c.executed&&c.rejected)).toBe(true);}
  });

  it("requires non-vacuous persisted recipe fingerprint evidence",()=>{
    const base:Recipe={case_id:"a",api_key:"p1",title:"P1",spec_url:"https://registry.test/a",spec_fingerprint:"spec-a",discovery_descriptor_fingerprint:"desc-a",server_base:"https://a.test",allowed_host:"a.test",operation_path:"/x",method:"GET",bindings:[],params:[],projection:{},recipe_fingerprint:"recipe-a"};const second={...base,case_id:"b",api_key:"p2",spec_fingerprint:"spec-b",discovery_descriptor_fingerprint:"desc-b",recipe_fingerprint:"recipe-b"};expect(hasRecipeFingerprintEvidence([base,second])).toBe(true);expect(hasRecipeFingerprintEvidence([base])).toBe(false);expect(hasRecipeFingerprintEvidence([{...base,spec_fingerprint:""},second])).toBe(false);
  });

  it("freezes the end-to-end replay gates",()=>{
    expect(readme).toContain("at least 2 distinct providers execute live JSON successfully");expect(readme).toContain("100% of persisted recipes replay successfully");expect(readme).toContain("registry discovery calls during replay = 0");expect(readme).toContain("specification fetch calls during replay = 0");expect(readme).toContain("procurement planner calls during replay = 0");expect(readme).toContain("output projection induction calls during replay = 0");expect(readme).toContain("GO_AUTONOMOUS_DISCOVERY_TO_EXECUTION");expect(readme).toContain("REASSESS_AUTONOMOUS_DISCOVERY_TO_EXECUTION");
  });
});
