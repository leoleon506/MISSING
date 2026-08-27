import {readFile} from "node:fs/promises";
import {describe,it,expect} from "vitest";
import {RecoveryLedger} from "../src/experiment3yrCore.js";
import {specSummaryR6R} from "../src/experiment4ar6rEvidence.js";
import {buildRequestHypothesesP1,compileRequestHypothesisP1} from "../src/experiment4ap1Request.js";
import {materializeSelectionP1} from "../src/experiment4ap1Core.js";
import {validate4ap1} from "../src/experiment4ap1Contract.js";
import {deriveExperiment4ap1Source} from "../src/experiment4ap1Derivation.js";
import type {P1ProbeProof} from "../src/experiment4ap1Model.js";

function evidence(text:string,url="https://api.example.test/docs",id="p-e01"):any{return {evidence_id:id,provider_candidate_id:"p",requested_url:url,resolved_url:url,verified_at:"2026-01-01T00:00:00Z",status:200,content_type:"text/html",body_fingerprint:"x",text,state:"ok"};}
function specEvidence(spec:any,caseId:string,url="https://api.example.test/openapi.json"){return evidence(specSummaryR6R(spec,caseId,url),url);}

function proofFor(hypothesis:any,fields:{id:string;path:string;leaf:string}[]):P1ProbeProof{return {hypothesis,record:{hypothesis_id:hypothesis.id,disposition:"success",requested_url:"https://api.example.test/x",requested_at:"2026-01-01T00:00:00Z",final_url:"https://api.example.test/x",content_type:"application/json",response_body_fingerprint:"bodyfp",schema_fingerprint:"schemafp",observed_fields:fields.map(row=>({...row,tokens:[row.leaf],sample_type:"string",sample_value:"sample",build_value_relations:[]})),observed_path_count:fields.length,bytes:100,error:null}};}

describe("4A-P1 active schema induction",()=>{
  it("builds a documented request hypothesis even when documentation contains no response schema",()=>{
    const docs=[evidence('<pre>GET https://api.example.test/estimate?name={name}</pre>')];
    const result=buildRequestHypothesesP1(docs,"age_estimate_by_name");
    expect(result.hypotheses.length).toBeGreaterThan(0);
    expect(result.hypotheses[0].evidence_ids).toContain("p-e01");
    expect(result.hypotheses[0].slots.some(slot=>slot.name==="name")).toBe(true);
    expect(compileRequestHypothesisP1(result.hypotheses[0],{name:"michael"})).toContain("name=michael");
  });

  it("accepts a one-slot documented query abbreviation without inventing a response",()=>{
    const docs=[evidence('<pre>GET https://api.example.test/search?s={drink_name}</pre>')];
    const result=buildRequestHypothesesP1(docs,"cocktail_name_metadata");
    expect(result.hypotheses.length).toBeGreaterThan(0);
    const url=compileRequestHypothesisP1(result.hypotheses[0],{drink_name:"Margarita"});
    expect(url).toContain("s=Margarita");
  });

  it("rejects a request operation with a required authentication-like parameter before probing",()=>{
    const spec={openapi:"3.0.0",servers:[{url:"https://api.example.test"}],paths:{"/estimate":{get:{parameters:[{name:"key",in:"query",required:true},{name:"name",in:"query",required:true}],responses:{"200":{description:"ok"}}}}}};
    const result=buildRequestHypothesesP1([specEvidence(spec,"age_estimate_by_name")],"age_estimate_by_name");
    expect(result.hypotheses).toHaveLength(0);
  });

  it("does not map two task inputs to unrelated request slots when there is zero correspondence",()=>{
    const spec={openapi:"3.0.0",servers:[{url:"https://api.example.test"}],paths:{"/lookup":{get:{parameters:[{name:"foo",in:"query",required:true},{name:"bar",in:"query",required:true}],responses:{"200":{description:"ok"}}}}}};
    const result=buildRequestHypothesesP1([specEvidence(spec,"coordinate_timezone")],"coordinate_timezone");
    expect(result.hypotheses).toHaveLength(0);
  });

  it("materializes projection only from stable fields observed in the selected probe",()=>{
    const docs=[evidence('<pre>GET https://api.example.test/estimate?name={name}</pre>')],request=buildRequestHypothesesP1(docs,"age_estimate_by_name"),hypothesis=request.hypotheses[0];
    const proof=proofFor(hypothesis,[{id:"fld_name",path:"name",leaf:"name"},{id:"fld_age",path:"age",leaf:"age"}]);
    const result=materializeSelectionP1("age_estimate_by_name","p",proof,{decision:"SELECT",hypothesis_id:hypothesis.id,output_bindings:[{task_output:"name",source_id:"fld_name"},{task_output:"age",source_id:"fld_age"}],reason:"observed"});
    expect(result.raw.query_bindings).toEqual({name:"$input.name"});
    expect(result.raw.projection).toEqual({name:{op:"FIELD",path:"name"},age:{op:"FIELD",path:"age"}});
    expect(result.proof.no_numeric_indices).toBe(true);
  });

  it("cannot select a response path that was not observed by the probe",()=>{
    const docs=[evidence('<pre>GET https://api.example.test/estimate?name={name}</pre>')],hypothesis=buildRequestHypothesesP1(docs,"age_estimate_by_name").hypotheses[0],proof=proofFor(hypothesis,[{id:"fld_age",path:"age",leaf:"age"}]);
    expect(()=>materializeSelectionP1("age_estimate_by_name","p",proof,{decision:"SELECT",hypothesis_id:hypothesis.id,output_bindings:[{task_output:"name",source_id:"TASK_INPUT:name"},{task_output:"age",source_id:"fld_fake"}],reason:"bad"})).toThrow(/field_not_observed/);
  });

  it("forbids reusing one observed field for two distinct outputs",()=>{
    const docs=[evidence('<pre>GET https://api.example.test/product?barcode={barcode}</pre>')],hypothesis=buildRequestHypothesesP1(docs,"food_barcode_metadata").hypotheses[0],proof=proofFor(hypothesis,[{id:"fld_one",path:"product.value",leaf:"value"}]);
    expect(()=>materializeSelectionP1("food_barcode_metadata","p",proof,{decision:"SELECT",hypothesis_id:hypothesis.id,output_bindings:[{task_output:"code",source_id:"fld_one"},{task_output:"name",source_id:"fld_one"}],reason:"reuse"})).toThrow(/field_reused/);
  });

  it("contract validation detects any request mutation after the probe",()=>{
    const docs=[evidence('<pre>GET https://api.example.test/estimate?name={name}</pre>')],hypothesis=buildRequestHypothesesP1(docs,"age_estimate_by_name").hypotheses[0],proof=proofFor(hypothesis,[{id:"fld_name",path:"name",leaf:"name"},{id:"fld_age",path:"age",leaf:"age"}]);
    const made=materializeSelectionP1("age_estimate_by_name","p",proof,{decision:"SELECT",hypothesis_id:hypothesis.id,output_bindings:[{task_output:"name",source_id:"fld_name"},{task_output:"age",source_id:"fld_age"}],reason:"ok"});
    made.raw.query_bindings={other:"$input.name"};
    const result=validate4ap1(made.raw,{case_id:"age_estimate_by_name",candidate_id:"p",name:"P",start_url:"https://api.example.test/docs"},docs,new RecoveryLedger(),proof);
    expect(result.errors).toContain("p1_query_bindings_mutated");
  });

  it("derives P1 runner with probe metrics, no repair synthesis, frozen parent SHA and formal decision",async()=>{
    const base=await readFile(new URL("../src/experiment4ar.ts",import.meta.url),"utf8"),generated=deriveExperiment4ap1Source(base);
    expect(generated).toContain('const OUT="results/experiment-4ap1"');
    expect(generated).toContain("synthesize4ap1 as synthesize4ar");
    expect(generated).toContain("validate4ap1 as validate4ar");
    expect(generated).toContain("schemaProbeCalls");
    expect(generated).toContain("schema_probe_calls");
    expect(generated).toContain("probeDerivedContracts");
    expect(generated).toContain("GO_4A_P1_ACTIVE_SCHEMA_INDUCTION");
    expect(generated).toContain('base_sha:"c152a2370ec3640f85e54f435980208f934baef8"');
    expect(generated).not.toContain("synthesis_repair\",p.case_id");
  });
});
