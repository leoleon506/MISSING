import {readFile} from "node:fs/promises";
import {describe,it,expect} from "vitest";
import {specSummaryR6R} from "../src/experiment4ar6rEvidence.js";
import {buildProofGraphR7,lexicalTokensR7} from "../src/experiment4ar7Graph.js";
import {materializeSelectionR7} from "../src/experiment4ar7Core.js";
import {deriveExperiment4ar7Source} from "../src/experiment4ar7Derivation.js";

function evidence(text:string,url="https://api.example.test/docs",id="p-e01"):any{
  return {evidence_id:id,provider_candidate_id:"p",requested_url:url,resolved_url:url,verified_at:"2026-01-01T00:00:00Z",status:200,content_type:"text/html",body_fingerprint:"x",text,state:"ok"};
}

function specEvidence(spec:any,caseId:string,url="https://api.example.test/openapi.json"){
  return evidence(specSummaryR6R(spec,caseId,url),url);
}

describe("4A-R7 proof graph feasibility solver",()=>{
  it("normalizes representation-only camel/snake naming without provider synonyms",()=>{
    expect(lexicalTokensR7("objectID")).toEqual(["object","id"]);
    expect(lexicalTokensR7("object_id")).toEqual(["object","id"]);
    expect(lexicalTokensR7("country-codes")).toEqual(["country","code"]);
  });

  it("marks a value-dependent task infeasible when the operation consumes no task input",()=>{
    const html=`<pre>GET /lookup</pre><pre>{"postal_code":"90210","country_name":"United States"}</pre>`;
    const graph=buildProofGraphR7([evidence(html)],"postal_code_location");
    expect(graph.operations.length).toBeGreaterThan(0);
    expect(graph.feasible_operations).toHaveLength(0);
    expect(graph.infeasibility_reason_counts.no_input_influence_path).toBeGreaterThan(0);
  });

  it("blocks operations that require an authentication-like parameter",()=>{
    const spec={openapi:"3.0.0",servers:[{url:"https://api.example.test/v1"}],paths:{"/timezone":{get:{parameters:[{name:"key",in:"query",required:true},{name:"lat",in:"query",required:true},{name:"lng",in:"query",required:true}],responses:{"200":{content:{"application/json":{schema:{type:"object",properties:{timezone:{type:"string"}}}}}}}}}}};
    const graph=buildProofGraphR7([specEvidence(spec,"coordinate_timezone")],"coordinate_timezone");
    expect(graph.feasible_operations).toHaveLength(0);
    expect(graph.infeasibility_reason_counts.required_auth_parameter).toBeGreaterThan(0);
  });

  it("uses stable parameter IDs so latitude cannot accidentally bind to key/format by position",()=>{
    const spec={openapi:"3.0.0",servers:[{url:"https://api.example.test/v1"}],paths:{"/timezone":{get:{parameters:[{name:"key",in:"query",required:false},{name:"format",in:"query",required:false,schema:{type:"string",enum:["json"]}},{name:"lat",in:"query",required:true},{name:"lng",in:"query",required:true}],responses:{"200":{content:{"application/json":{schema:{type:"object",properties:{timezone:{type:"string"}}}}}}}}}}};
    const graph=buildProofGraphR7([specEvidence(spec,"coordinate_timezone")],"coordinate_timezone");
    expect(graph.feasible_operations.length).toBe(1);
    const row=graph.feasible_operations[0],op=row.operation;
    const lat=op.parameter_slots.find(x=>x.name==="lat")!,lng=op.parameter_slots.find(x=>x.name==="lng")!,timezone=op.response_slots.find(x=>x.path==="timezone")!;
    const result=materializeSelectionR7("coordinate_timezone","p",graph,{decision:"SELECT",operation_id:op.id,input_bindings:[{task_input:"latitude",parameter_id:lat.id},{task_input:"longitude",parameter_id:lng.id}],literal_bindings:[],output_bindings:[{task_output:"timezone",source_id:timezone.id}],reason:"stable ids"});
    expect(result.raw.query_bindings).toEqual({lat:"$input.latitude",lng:"$input.longitude"});
    expect(result.raw.query_bindings.key).toBeUndefined();
    expect(result.raw.query_bindings.format).toBeUndefined();
    expect(result.proof.no_numeric_indices).toBe(true);
  });

  it("pairs a documented request with a structured response block and exposes exact response paths",()=>{
    const html=`<h2>Search endpoint</h2><pre>GET /api/search?s={name}</pre><h3>Response</h3><pre>{"drinks":[{"strDrink":"Margarita","strCategory":"Ordinary Drink"}]}</pre>`;
    const graph=buildProofGraphR7([evidence(html)],"cocktail_name_metadata");
    const row=graph.feasible_operations.find(x=>x.operation.full_path==="/api/search");
    expect(row).toBeTruthy();
    expect(row!.operation.response_slots.map(x=>x.path)).toEqual(expect.arrayContaining(["drinks.0.strDrink","drinks.0.strCategory"]));
    expect(row!.operation.response_join).not.toBe("none");
  });

  it("forbids reusing one response field for two required outputs",()=>{
    const spec={openapi:"3.0.0",servers:[{url:"https://api.example.test"}],paths:{"/item/{objectID}":{get:{parameters:[{name:"objectID",in:"path",required:true}],responses:{"200":{content:{"application/json":{schema:{type:"object",properties:{id:{type:"integer"},title:{type:"string"}}}}}}}}}}};
    const graph=buildProofGraphR7([specEvidence(spec,"artwork_object_metadata")],"artwork_object_metadata"),row=graph.feasible_operations[0],op=row.operation;
    const param=op.parameter_slots.find(x=>x.name==="objectID")!,field=op.response_slots.find(x=>x.path==="title")!;
    expect(()=>materializeSelectionR7("artwork_object_metadata","p",graph,{decision:"SELECT",operation_id:op.id,input_bindings:[{task_input:"object_id",parameter_id:param.id}],literal_bindings:[],output_bindings:[{task_output:"id",source_id:field.id},{task_output:"title",source_id:field.id}],reason:"invalid reuse"})).toThrow(/response_field_reused|output_source_not_candidate/);
  });

  it("rejects a parameter ID belonging to another operation",()=>{
    const spec={openapi:"3.0.0",servers:[{url:"https://api.example.test"}],paths:{"/a/{name}":{get:{parameters:[{name:"name",in:"path",required:true}],responses:{"200":{content:{"application/json":{schema:{type:"object",properties:{name:{type:"string"},age:{type:"integer"}}}}}}}}},"/b/{other}":{get:{parameters:[{name:"other",in:"path",required:true}],responses:{"200":{content:{"application/json":{schema:{type:"object",properties:{name:{type:"string"},age:{type:"integer"}}}}}}}}}}};
    const graph=buildProofGraphR7([specEvidence(spec,"age_estimate_by_name")],"age_estimate_by_name");
    expect(graph.feasible_operations.length).toBeGreaterThanOrEqual(2);
    const first=graph.feasible_operations[0],second=graph.feasible_operations[1],foreign=second.operation.parameter_slots[0];
    const age=first.operation.response_slots.find(x=>x.path==="age")!;
    expect(()=>materializeSelectionR7("age_estimate_by_name","p",graph,{decision:"SELECT",operation_id:first.operation.id,input_bindings:[{task_input:"name",parameter_id:foreign.id}],literal_bindings:[],output_bindings:[{task_output:"name",source_id:"TASK_INPUT:name"},{task_output:"age",source_id:age.id}],reason:"foreign id"})).toThrow(/parameter_not_candidate/);
  });

  it("derives the R7 runner with frozen parent SHA and formal decision",async()=>{
    const base=await readFile(new URL("../src/experiment4ar.ts",import.meta.url),"utf8");
    const generated=deriveExperiment4ar7Source(base);
    expect(generated).toContain('const OUT="results/experiment-4ar7"');
    expect(generated).toContain("synthesize4ar7 as synthesize4ar");
    expect(generated).toContain("validate4ar7 as validate4ar");
    expect(generated).toContain("GO_4A_R7_PROOF_GRAPH_FEASIBILITY_SOLVER");
    expect(generated).toContain('base_sha:"aa661eb494a2d1bf4c50ee2987da518d8713ed09"');
    expect(generated).toContain("experiment4ar7Graph.ts");
    expect(generated).toContain("experiment4ar6rEvidence.ts");
  });

  it("contains no LLM numeric-index protocol in the R7 planner",async()=>{
    const planner=await readFile(new URL("../src/experiment4ar7Planner.ts",import.meta.url),"utf8");
    expect(planner).not.toMatch(/operation_index|parameter_index|response_path_index|literal_index/);
    expect(planner).toContain("operation_id");
    expect(planner).toContain("parameter_id");
    expect(planner).toContain("source_id");
  });
});
