import {describe,it,expect} from "vitest";
import {readFile} from "node:fs/promises";
import {prepareRequestGraph4I} from "../src/experiment4iRequest.js";
import {compileRequestHypothesisP1} from "../src/experiment4ap1Request.js";
import {RecoveryLedger} from "../src/experiment3yrCore.js";
import {deriveExperiment4iSource} from "../src/experiment4iDerivation.js";

const ev=(text:string,expanded=false)=>({
  evidence_id:"ev1",
  provider_candidate_id:"synthetic",
  requested_url:"https://docs.example.test/reference",
  resolved_url:"https://docs.example.test/reference",
  verified_at:new Date().toISOString(),
  status:200,
  content_type:"text/html",
  body_fingerprint:"fp",
  text,
  state:"ok",
  ...(expanded?{source_kind:"4g_reference_expansion"}:{}),
} as any);
const metrics=(g:any)=>g.metrics as Record<string,any>;

async function graph(text:string,caseId:string,expanded=false){
  return prepareRequestGraph4I([ev(text,expanded)],caseId,new RecoveryLedger());
}

describe("4I structural identifier role",()=>{
  it("preserves npm package placeholder and compiles the build value",async()=>{
    const g=await graph('<h2>Package metadata API</h2><p>Returns package name and version.</p><code>GET https://api.example.test/{package}</code>',"npm_package_metadata");
    const h=g.hypotheses.find(x=>x.full_path.includes("{package}"));
    expect(h).toBeTruthy();
    const url=compileRequestHypothesisP1(h!,{package_name:"lodash"});
    expect(url).toContain("/lodash");
    expect(url).not.toMatch(/%7Bpackage%7D/i);
    expect(metrics(g).placeholderPreservationFailures).toBe(0);
  });

  it("preserves Met-style objectID placeholder and compiles the object id",async()=>{
    const g=await graph('<h2>Artwork object metadata</h2><p>Returns objectID and title.</p><code>GET https://api.example.test/objects/{objectID}</code>',"artwork_object_metadata");
    const h=g.hypotheses.find(x=>x.full_path.includes("{objectID}"));
    expect(h).toBeTruthy();
    const url=compileRequestHypothesisP1(h!,{object_id:436121});
    expect(url).toContain("/objects/436121");
    expect(url).not.toMatch(/%7BobjectID%7D/i);
  });

  it("prunes optional auth without serializing or encoding the non-auth request",async()=>{
    const g=await graph('<h2>Package metadata</h2><p>Anonymous access supported. An API key only increases rate limits. Returns package name and version.</p><code>GET https://api.example.test/{package}?key=optional&format=json</code>',"npm_package_metadata");
    const h=g.hypotheses.find(x=>x.full_path.includes("{package}"));
    expect(h).toBeTruthy();
    expect(h!.full_path).not.toContain("key=");
    expect(h!.full_path).toContain("format=json");
    expect(compileRequestHypothesisP1(h!,{package_name:"lodash"})).toContain("/lodash?format=json");
    expect(metrics(g).authLikeRenderedRequests).toBe(0);
    expect(metrics(g).placeholderPreservationFailures).toBe(0);
    expect(metrics(g).nonAuthRequestTextMutations).toBe(0);
  });

  it("blocks locally required authentication before render",async()=>{
    const g=await graph('<h2>Package metadata</h2><p>API key required for every request.</p><code>GET https://api.example.test/{package}?key=YOUR_KEY</code>',"npm_package_metadata");
    expect(g.probe_packet).toHaveLength(0);
    expect(metrics(g).authLikeRenderedRequests).toBe(0);
    expect(metrics(g).requiredAuthSlotsBlocked).toBeGreaterThan(0);
  });

  it("derives a VIN path role from one exact documented build-value segment",async()=>{
    const g=await graph('<h2>Vehicle VIN decode</h2><p>Decode a vehicle VIN and return VIN and make.</p><code>GET https://api.example.test/vehicles/DecodeVin/1HGCM82633A004352?format=json</code>',"vin_vehicle_metadata");
    const h=g.hypotheses.find(x=>x.full_path.includes("{vin}"));
    expect(h).toBeTruthy();
    expect(metrics(g).identifierRoleAcceptedUniqueBuildValue).toBeGreaterThan(0);
    expect(metrics(g).identifierRoleAcceptedPathSegment).toBeGreaterThan(0);
    const url=compileRequestHypothesisP1(h!,{vin:"1HGCM82633A004352"});
    expect(url).toContain("/DecodeVin/1HGCM82633A004352");
  });

  it("accepts an OFF-style generic code placeholder only with product/output support",async()=>{
    const g=await graph('<h2>Product lookup</h2><p>Lookup a food product and return product code and name.</p><code>GET https://api.example.test/api/v2/product/{code}</code>',"food_barcode_metadata");
    const h=g.hypotheses.find(x=>x.full_path.includes("{code}"));
    expect(h).toBeTruthy();
    expect(h!.input_bindings.barcode).toBeTruthy();
    expect(metrics(g).identifierRoleAcceptedPlaceholder).toBeGreaterThan(0);
    expect(compileRequestHypothesisP1(h!,{barcode:"3017620422003"})).toContain("/product/3017620422003");
  });

  it("rejects an ambiguous concrete identifier occurring twice",async()=>{
    const g=await graph('<h2>Vehicle VIN decode</h2><p>Decode a vehicle VIN and return VIN and make.</p><code>GET https://api.example.test/vehicle/1HGCM82633A004352/history/1HGCM82633A004352</code>',"vin_vehicle_metadata");
    expect(metrics(g).identifierRoleRejectedAmbiguousOccurrence).toBeGreaterThan(0);
    expect(g.hypotheses.some(h=>Object.keys(h.input_bindings).includes("vin"))).toBe(false);
  });

  it("rejects generic books id for a fictional-character task",async()=>{
    const g=await graph('<h2>Book metadata</h2><p>Return book id and name.</p><code>GET https://api.example.test/api/books/{id}</code>',"fictional_character_metadata");
    expect(g.hypotheses).toHaveLength(0);
    expect(metrics(g).identifierRoleRejectedGeneric).toBeGreaterThan(0);
  });

  it("retains expanded-evidence provenance in candidate hypotheses",async()=>{
    const g=await graph('<h2>Package metadata API</h2><p>Returns package name and version.</p><code>GET https://api.example.test/{package}</code>',"npm_package_metadata",true);
    expect(metrics(g).expandedEvidenceHypotheses).toBeGreaterThan(0);
  });

  it("keeps 4I provider-blind and uses only the new provenance prefix",async()=>{
    const requestSource=await readFile(new URL("../src/experiment4iRequest.ts",import.meta.url),"utf8");
    const contractSource=await readFile(new URL("../src/experiment4iContract.ts",import.meta.url),"utf8");
    expect(requestSource).not.toMatch(/openfoodfacts|nhtsa|registry\.npmjs|metmuseum/i);
    expect(contractSource).toContain('prefix="4I_STRUCTURAL_IDENTIFIER_ROLE:"');
    expect(contractSource).not.toContain('prefix="4H_TASK_OPERATION_ALIGNMENT:"');
  });

  it("derives the preregistered 4I decision, safety gates, and exact base",async()=>{
    const src=await readFile(new URL("../src/experiment4ar.ts",import.meta.url),"utf8");
    const out=deriveExperiment4iSource(src);
    expect(out).toContain("GO_4I_STRUCTURAL_IDENTIFIER_ROLE_INFERENCE");
    expect(out).toContain("REASSESS_4I_STRUCTURAL_IDENTIFIER_ROLE_INFERENCE");
    expect(out).toContain('base_sha:"28c83671b4aa38bd87bf6ddefd540e1b5d6035c1"');
    expect(out).toContain("placeholder_preservation_failures_zero");
    expect(out).toContain("non_auth_request_text_mutations_zero");
  });
});
