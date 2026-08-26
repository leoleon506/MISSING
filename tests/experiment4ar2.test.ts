import {describe,it,expect} from "vitest";
import {canonicalizeBoundary,auditProviderBlindSource,BOUNDARY_SCHEMA} from "../src/experiment4ar2Core.js";

describe("4A-R2 typed IR recovery",()=>{
 it("canonicalizes structured FIELD projection and bindings",()=>{const raw={case_id:"x",provider_candidate_id:"p",decision:"COMPILE",method:"GET",base_url:"https://example.test",path_template:"/{id}",path_bindings:[{name:"id",source:"$input.id"}],query_bindings:[],projection:[{output:"name",op:"FIELD",path:"data.name",name:null,map_path:null,key_op:null,key_name:null,key_value:null,value_path:null,array_path:null,where_path:null,equals_op:null,equals_name:null,equals_value:null}],evidence_ids:["e1"],reason:"ok"};expect(canonicalizeBoundary(raw,["name"])).toMatchObject({decision:"COMPILE",path_bindings:{id:"$input.id"},projection:{name:{op:"FIELD",path:"data.name"}}});});
 it("rejects missing required projection outputs",()=>expect(()=>canonicalizeBoundary({decision:"COMPILE",projection:[],path_bindings:[],query_bindings:[]},["name"])).toThrow(/missing_output/));
 it("provider-blind audit ignores ordinary case_id validation",()=>expect(auditProviderBlindSource([`if(c.case_id!==p.case_id) errors.push("case_id_mismatch")`]).clean).toBe(true));
 it("provider-blind audit detects hard-coded provider assignments",()=>expect(auditProviderBlindSource([`const x={provider_start_url:"https://seed.example"}`]).clean).toBe(false));
 it("uses strict JSON schema",()=>expect(BOUNDARY_SCHEMA.strict).toBe(true));
});
