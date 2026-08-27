import {readFile} from "node:fs/promises";
import {describe,it,expect} from "vitest";
import {canonicalizeEndpointTemplateR6R,normalizeOpenApiServersR6R,specSummaryR6R,extractOperationInventoryR6R,materializeR6R} from "../src/experiment4ar6rCore.js";
import {deriveExperiment4ar6rSource} from "../src/experiment4ar6rDerivation.js";

function evidence(text:string,url="https://docs.example.test/reference"):any{return {evidence_id:"p-e01",provider_candidate_id:"p",requested_url:url,resolved_url:url,verified_at:"2026-01-01T00:00:00Z",status:200,content_type:"text/html",body_fingerprint:"x",text,state:"ok"};}

describe("4A-R6R deterministic operation compiler",()=>{
  it("canonicalizes all documented placeholder syntaxes without renaming",()=>{
    expect(canonicalizeEndpointTemplateR6R("/objects/[objectID]")).toBe("/objects/{objectID}");
    expect(canonicalizeEndpointTemplateR6R("/objects/<objectID>")).toBe("/objects/{objectID}");
    expect(canonicalizeEndpointTemplateR6R("/objects/:objectID")).toBe("/objects/{objectID}");
    expect(canonicalizeEndpointTemplateR6R("/objects/%7BobjectID%7D")).toBe("/objects/{objectID}");
  });

  it("normalizes host/path OpenAPI servers without duplicating the hostname",()=>{
    const servers=normalizeOpenApiServersR6R({servers:[{url:"api.example.test/api/v1"}]},"https://api.example.test/api/v1/openapi.json");
    expect(servers).toEqual([{origin:"https://api.example.test",base_path:"/api/v1"}]);
  });

  it("anchors relative OpenAPI servers to the exact spec origin",()=>{
    const servers=normalizeOpenApiServersR6R({servers:[{url:"/api/v2"}]},"https://spec.example.test/openapi.json");
    expect(servers).toEqual([{origin:"https://spec.example.test",base_path:"/api/v2"}]);
  });

  it("compiles relative documented endpoints and pairs nearby JSON response paths",()=>{
    const html=`<h2>API Reference</h2><pre>GET /v1/items/[id]?format=json</pre><pre>{"id":123,"title":"Example","meta":{"kind":"x"}}</pre>`;
    const inv=extractOperationInventoryR6R([evidence(html,"https://api.example.test/docs")],"artwork_object_metadata");
    const op=inv.inventory.find(x=>x.full_path==="/v1/items/{id}");
    expect(op).toBeTruthy();
    expect(op!.origin).toBe("https://api.example.test");
    expect(op!.path_parameters.map(x=>x.name)).toEqual(["id"]);
    expect(op!.query_parameters.map(x=>x.name)).toContain("format");
    expect(op!.response_paths).toEqual(expect.arrayContaining(["id","title","meta.kind"]));
  });

  it("anchors a relative endpoint to a nearby cited API origin instead of the docs origin",()=>{
    const html=`<pre>GET https://api.example.test/v1/ping?format=json</pre><p>Resource endpoint:</p><pre>GET /v1/items/{id}</pre><pre>{"id":123,"title":"Example"}</pre>`;
    const inv=extractOperationInventoryR6R([evidence(html,"https://docs.example.test/reference")],"artwork_object_metadata");
    const op=inv.inventory.find(x=>x.full_path==="/v1/items/{id}");
    expect(op).toBeTruthy();
    expect(op!.origin).toBe("https://api.example.test");
  });

  it("uses camel-case token equivalence for deterministic operation ranking",()=>{
    const html=`<pre>GET /v1/a/{slug}</pre><pre>{"id":1,"title":"A"}</pre><pre>GET /v1/b/{objectID}</pre><pre>{"id":2,"title":"B"}</pre>`;
    const inv=extractOperationInventoryR6R([evidence(html,"https://api.example.test/docs")],"artwork_object_metadata");
    const objectOp=inv.inventory.findIndex(x=>x.path_parameters.some(p=>p.name==="objectID"));
    const slugOp=inv.inventory.findIndex(x=>x.path_parameters.some(p=>p.name==="slug"));
    expect(objectOp).toBeGreaterThanOrEqual(0);
    expect(slugOp).toBeGreaterThanOrEqual(0);
    expect(objectOp).toBeLessThan(slugOp);
  });

  it("filters static assets and cross-site navigation before the operation packet",()=>{
    const html=`<code>https://api.example.test/v1/items/{id}</code><script src="https://api.example.test/assets/app.js"></script><a href="https://unrelated.example.org/account">account</a><pre>{"id":1,"title":"x"}</pre>`;
    const inv=extractOperationInventoryR6R([evidence(html,"https://api.example.test/docs")],"artwork_object_metadata");
    expect(inv.inventory.some(x=>x.full_path.includes("app.js"))).toBe(false);
    expect(inv.inventory.some(x=>x.origin.includes("unrelated.example.org"))).toBe(false);
    expect(inv.rejects.some(x=>x.reason==="static_asset")).toBe(true);
    expect(inv.rejects.some(x=>x.reason==="cross_site"||x.reason==="navigation_path")).toBe(true);
  });

  it("strips HTML residue from absolute endpoint examples",()=>{
    const html=`<pre>https://api.example.test/v1/items/123</pre><pre>{"id":123,"title":"x"}</pre>`;
    const inv=extractOperationInventoryR6R([evidence(html,"https://api.example.test/docs")],"artwork_object_metadata");
    expect(inv.inventory.some(x=>x.operation_path.includes("</pre>"))).toBe(false);
    expect(inv.inventory.some(x=>x.full_path==="/v1/items/123")).toBe(true);
  });

  it("reconciles an explicit template with its concrete example without inventing a template",()=>{
    const html=`<h3>Endpoint</h3><code>GET /v1/items/{id}</code><p>Example</p><code>https://api.example.test/v1/items/123</code><pre>{"id":123,"title":"Concrete"}</pre>`;
    const inv=extractOperationInventoryR6R([evidence(html,"https://api.example.test/docs")],"artwork_object_metadata");
    const template=inv.inventory.find(x=>x.full_path==="/v1/items/{id}");
    expect(template).toBeTruthy();
    expect(template!.response_paths).toEqual(expect.arrayContaining(["id","title"]));
    expect(template!.proof_type).toBe("endpoint_json_example");
    const onlyConcrete=extractOperationInventoryR6R([evidence(`<code>https://api.example.test/v1/items/123</code>`,"https://api.example.test/docs")],"artwork_object_metadata");
    expect(onlyConcrete.inventory.some(x=>x.path_parameters.length>0)).toBe(false);
  });

  it("preserves OpenAPI schema response paths and canonical base path",()=>{
    const spec={openapi:"3.0.0",servers:[{url:"api.example.test/api/v1"}],paths:{"/items/{id}":{get:{parameters:[{name:"id",in:"path",required:true}],responses:{"200":{content:{"application/json":{schema:{type:"object",properties:{id:{type:"integer"},title:{type:"string"}}}}}}}}}}};
    const ev=evidence(specSummaryR6R(spec,"artwork_object_metadata","https://api.example.test/openapi.json"),"https://api.example.test/openapi.json");
    const inv=extractOperationInventoryR6R([ev],"artwork_object_metadata"),op=inv.inventory[0];
    expect(op.origin).toBe("https://api.example.test");
    expect(op.full_path).toBe("/api/v1/items/{id}");
    expect(op.response_paths).toEqual(expect.arrayContaining(["id","title"]));
    expect(op.proof_type).toBe("openapi");
  });

  it("materializes mappings only against the selected operation",()=>{
    const html=`<code>GET /v1/items/{id}</code><pre>{"id":123,"title":"x"}</pre>`;
    const inv=extractOperationInventoryR6R([evidence(html,"https://api.example.test/docs")],"artwork_object_metadata"),op=inv.packet.find(x=>x.full_path==="/v1/items/{id}")!;
    const result=materializeR6R("artwork_object_metadata","p",op,{path_bindings:[{parameter_index:0,input_name:"object_id"}],query_bindings:[],output_mappings:[{output_name:"id",source_kind:"INPUT",response_path_index:null,input_name:"object_id"},{output_name:"title",source_kind:"FIELD",response_path_index:op.response_paths.indexOf("title"),input_name:null}],reason:"fit"});
    expect(result.raw.path_template).toBe("/v1/items/{id}");
    expect(result.raw.path_bindings).toEqual({id:"$input.object_id"});
    expect(()=>materializeR6R("artwork_object_metadata","p",op,{path_bindings:[{parameter_index:9,input_name:"object_id"}],query_bindings:[],output_mappings:[{output_name:"id",source_kind:"INPUT",response_path_index:null,input_name:"object_id"},{output_name:"title",source_kind:"FIELD",response_path_index:op.response_paths.indexOf("title"),input_name:null}],reason:"bad"})).toThrow(/path_parameter_index_invalid/);
  });

  it("derives the full R6R runner and preserves frozen boundaries",async()=>{
    const base=await readFile(new URL("../src/experiment4ar.ts",import.meta.url),"utf8"),generated=deriveExperiment4ar6rSource(base);
    expect(generated).toContain('const OUT="results/experiment-4ar6r"');
    expect(generated).toContain("synthesize4ar6r as synthesize4ar");
    expect(generated).toContain("validate4ar6r as validate4ar");
    expect(generated).toContain("GO_4A_R6R_DETERMINISTIC_OPERATION_COMPILER_RECOVERY");
    expect(generated).toContain('base_sha:"f5c34c8598698ad9ee9e2cff856a298b7dd00690"');
    expect(generated).toContain("r6r_calls");
  });

  it("compiler and planner contain no known provider or workload path seeds",async()=>{
    const core=await readFile(new URL("../src/experiment4ar6rCore.ts",import.meta.url),"utf8"),planner=await readFile(new URL("../src/experiment4ar6rPlanner.ts",import.meta.url),"utf8"),derivation=await readFile(new URL("../src/experiment4ar6rDerivation.ts",import.meta.url),"utf8");
    for(const source of [core,planner,derivation])expect(source).not.toMatch(/thecocktaildb|openfoodfacts|genderize|agify|metmuseum|artic\.edu|nhtsa|registry\.npmjs|ziptastic|themealdb/i);
    expect(core).not.toMatch(/artworks\?|vehicles\?|meals\?|drinks\?|packages\?|products\?/i);
  });
});
