import {describe,expect,it} from "vitest";
import {readFileSync} from "node:fs";
import {FROZEN_PROVIDERS,compileMicroRequest,docScopeAllowed,projectMicro,validateMicroContract,type DocEvidence} from "../src/experiment3wCore.js";
import {EXEC_CASES} from "../src/experiment3rCore.js";
import {run3wControls} from "../src/experiment3wControls.js";

const prereg=readFileSync("experiments/3w/README.md","utf8");
describe("Experiment 3W",()=>{
 it("freezes the exact 3V provider population",()=>{expect(FROZEN_PROVIDERS).toHaveLength(10);expect(FROZEN_PROVIDERS.filter(x=>x.case_id==="currency_metadata")).toHaveLength(8);expect(FROZEN_PROVIDERS.some(x=>x.name==="Code.gov")).toBe(true);expect(FROZEN_PROVIDERS.some(x=>x.name.includes("Dungeons and Dragons"))).toBe(true);});
 it("keeps preregistered GO immutable in documentation",()=>{expect(prereg).toContain("GO_DOCUMENTATION_TO_EXECUTABLE_CONTRACT_SYNTHESIS");expect(prereg).toContain("22/22");expect(prereg).toContain("12 seconds");});
 it("rejects undocumented host path and output",()=>{const p=FROZEN_PROVIDERS.find(x=>x.case_id==="currency_metadata")!;const e:DocEvidence[]=[{evidence_id:"e1",provider_candidate_id:p.candidate_id,requested_url:p.start_url,resolved_url:p.start_url,verified_at:new Date().toISOString(),status:200,content_type:"text/html",body_fingerprint:"x",state:"ok",text:"GET https://api.example.com/currency/{code} code name response"}];const c:any={case_id:p.case_id,provider_candidate_id:p.candidate_id,decision:"COMPILE",method:"GET",base_url:"https://evil.test",path_template:"/wrong/{code}",path_bindings:{code:"$input.currency_id"},query_bindings:{},output_paths:{code:"code",name:"invented"},evidence_ids:["e1"]};const v=validateMicroContract(c,p,e);expect(v.errors.some(x=>x.includes("undocumented_base_url"))).toBe(true);expect(v.errors.some(x=>x.includes("undocumented_path"))).toBe(true);expect(v.errors.some(x=>x.includes("invented_output_field"))).toBe(true);});
 it("compiles only declared input bindings",()=>{const c:any={case_id:"currency_metadata",provider_candidate_id:"x",decision:"COMPILE",base_url:"https://api.example.com",path_template:"/currency/{code}",path_bindings:{code:"$input.currency_id"},query_bindings:{format:"json"},output_paths:{code:"code",name:"name"}};expect(compileMicroRequest(c,{currency_id:"USD"})).toBe("https://api.example.com/currency/USD?format=json");});
 it("projects deterministic dotted JSON paths",()=>{const ec=EXEC_CASES.currency_metadata;const c:any={output_paths:{code:"data.code",name:"data.name"}};expect(projectMicro({data:{code:"USD",name:"US Dollar"}},c,ec)).toEqual({code:"USD",name:"US Dollar"});});
 it("enforces documentation scope",()=>{expect(docScopeAllowed("https://docs.example.com","https://api.example.com/docs")).toBe(true);expect(docScopeAllowed("https://docs.example.com","https://evil.test/docs")).toBe(false);});
 it("executes all twenty-two active controls",async()=>{const c=await run3wControls();expect(c).toHaveLength(22);expect(c.every(x=>x.executed&&x.rejected)).toBe(true);});
});
