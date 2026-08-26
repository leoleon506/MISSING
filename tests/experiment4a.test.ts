import {describe,it,expect} from "vitest";
import {FOUR_A_BUDGET,FOUR_A_CASES,FOUR_A_MODEL,percentile,usageCost} from "../src/experiment4aCore.js";
import {RecoveryLedger} from "../src/experiment3yrCore.js";
import {validate4aContract} from "../src/experiment4aContract.js";

describe("experiment 4A",()=>{
 it("freezes exactly 24 cases across 8 families",()=>{expect(FOUR_A_CASES).toHaveLength(24);expect(new Set(FOUR_A_CASES.map(x=>x.family)).size).toBe(8);expect(FOUR_A_MODEL).toBe("gpt-4.1-mini-2025-04-14");expect(FOUR_A_BUDGET.min_successes).toBe(12);});
 it("prices API-reported token usage from frozen rates",()=>{const x=usageCost({prompt_tokens:1_000_000,completion_tokens:1_000_000,prompt_tokens_details:{cached_tokens:200_000}});expect(x.cost_usd).toBeCloseTo(1.94,8);});
 it("computes deterministic nearest-rank percentiles",()=>{expect(percentile([10,20,30,40],.5)).toBe(20);expect(percentile([10,20,30,40],.9)).toBe(40);});
 it("allows provider placeholder names to differ from canonical inputs",()=>{const p={case_id:"pypi_package_metadata",candidate_id:"opaque",name:"provider",start_url:"https://example.org"};const docs:any[]=[{evidence_id:"e1",provider_candidate_id:"opaque",state:"ok",text:"Base https://example.org GET /pkg/{project}. Response JSON field name and version.",requested_url:"",resolved_url:"",verified_at:"",status:200,content_type:"text/plain",body_fingerprint:"x"}];const c:any={case_id:p.case_id,provider_candidate_id:p.candidate_id,decision:"COMPILE",method:"GET",base_url:"https://example.org",path_template:"/pkg/{project}",path_bindings:{project:"$input.package_name"},query_bindings:{},output_paths:{name:"name",version:"version"},evidence_ids:["e1"],reason:"grounded"};expect(validate4aContract(c,p,docs,new RecoveryLedger()).errors).toEqual([]);});
});
