import {describe,it,expect} from "vitest";
import {readFile} from "node:fs/promises";
import ts from "typescript";
import {prepareRequestGraph4J,rebuildRequestGraph4J} from "../src/experiment4jRequest.js";
import {compileRequestHypothesisP1} from "../src/experiment4ap1Request.js";
import {RecoveryLedger} from "../src/experiment3yrCore.js";
import {deriveExperiment4jSource} from "../src/experiment4jDerivation.js";

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
  ...(expanded?{source_kind:"4f_reference_expansion"}:{}),
} as any);
const metrics=(g:any)=>g.metrics as Record<string,any>;
async function graph(text:string,caseId:string,expanded=false){return prepareRequestGraph4J([ev(text,expanded)],caseId,new RecoveryLedger())}

describe("4J entity-gated documented identifier roles",()=>{
  it("preserves npm package placeholder and substitutes package input",async()=>{
    const g=await graph('<h2>Package metadata API</h2><p>Get a package and return package name and version.</p><code>GET https://api.example.test/{package}</code>',"npm_package_metadata");
    const h=g.hypotheses.find(x=>x.full_path.includes("{package}"));
    expect(h).toBeTruthy();
    const url=compileRequestHypothesisP1(h!,{package_name:"lodash"});
    expect(url).toContain("/lodash");
    expect(url).not.toMatch(/%7Bpackage%7D/i);
    expect(metrics(g).placeholderPreservationFailures).toBe(0);
  });

  it("preserves Met objectID placeholder and substitutes object input",async()=>{
    const g=await graph('<h2>Artwork object metadata</h2><p>Get an artwork object and return objectID and title.</p><code>GET https://api.example.test/objects/{objectID}</code>',"artwork_object_metadata");
    const h=g.hypotheses.find(x=>x.full_path.includes("{objectID}"));
    expect(h).toBeTruthy();
    expect(compileRequestHypothesisP1(h!,{object_id:436121})).toContain("/objects/436121");
  });

  it("accepts NHTSA-style documented VIN placeholder",async()=>{
    const g=await graph('<h2>Vehicle VIN decode</h2><p>Decode a vehicle VIN and return VIN and make.</p><code>GET https://api.example.test/vehicles/DecodeVin/{VIN}?format=json</code>',"vin_vehicle_metadata");
    const h=g.hypotheses.find(x=>/\{VIN\}/i.test(x.full_path));
    expect(h).toBeTruthy();
    expect(compileRequestHypothesisP1(h!,{vin:"1HGCM82633A004352"})).toContain("/DecodeVin/1HGCM82633A004352");
  });

  it("accepts OFF-style generic code placeholder only with product semantics",async()=>{
    const g=await graph('<h2>Product lookup</h2><p>Lookup a food product and return product code and product name.</p><code>GET https://api.example.test/api/v2/product/{code}</code>',"food_barcode_metadata");
    const h=g.hypotheses.find(x=>x.full_path.includes("{code}"));
    expect(h).toBeTruthy();
    expect(h!.input_bindings.barcode).toBeTruthy();
    expect(metrics(g).identifierRoleAcceptedGenericPlaceholder).toBeGreaterThan(0);
    expect(compileRequestHypothesisP1(h!,{barcode:"3017620422003"})).toContain("/product/3017620422003");
  });

  it("rejects generic books id for fictional-character task",async()=>{
    const g=await graph('<h2>Book metadata</h2><p>Get a book and return book id and book name.</p><code>GET https://api.example.test/api/books/{id}</code>',"fictional_character_metadata");
    expect(g.hypotheses).toHaveLength(0);
    expect(metrics(g).identifierRoleRejectedEntityMismatch).toBeGreaterThan(0);
  });

  it("rejects concrete /api/books/1 for fictional-character task",async()=>{
    const g=await graph('<h2>Book metadata</h2><p>Get a book and return book id and name.</p><code>GET https://api.example.test/api/books/1</code>',"fictional_character_metadata");
    expect(g.hypotheses).toHaveLength(0);
    expect(metrics(g).identifierRoleRejectedEntityMismatch).toBeGreaterThan(0);
  });

  it("accepts exact concrete VIN segment only with vehicle/decode support",async()=>{
    const g=await graph('<h2>Vehicle VIN decode</h2><p>Decode a vehicle VIN and return VIN and make.</p><code>GET https://api.example.test/vehicles/DecodeVin/1HGCM82633A004352?format=json</code>',"vin_vehicle_metadata");
    const h=g.hypotheses.find(x=>x.full_path.includes("{vin}"));
    expect(h).toBeTruthy();
    expect(metrics(g).identifierRoleAcceptedUniqueBuildValue).toBeGreaterThan(0);
    expect(compileRequestHypothesisP1(h!,{vin:"1HGCM82633A004352"})).toContain("/DecodeVin/1HGCM82633A004352");
  });

  it("rejects repeated concrete VIN as ambiguous",async()=>{
    const g=await graph('<h2>Vehicle VIN decode</h2><p>Decode a vehicle VIN and return VIN and make.</p><code>GET https://api.example.test/vehicle/1HGCM82633A004352/history/1HGCM82633A004352</code>',"vin_vehicle_metadata");
    expect(metrics(g).identifierRoleRejectedAmbiguousOccurrence).toBeGreaterThan(0);
    expect(g.hypotheses.some(h=>Object.keys(h.input_bindings).includes("vin"))).toBe(false);
  });

  it("rejects a concrete identifier that is only a substring",async()=>{
    const g=await graph('<h2>Vehicle VIN decode</h2><p>Decode a vehicle VIN and return VIN and make.</p><code>GET https://api.example.test/vehicle/VIN-1HGCM82633A004352-detail</code>',"vin_vehicle_metadata");
    expect(metrics(g).identifierRoleRejectedSubstring).toBeGreaterThan(0);
    expect(g.hypotheses.some(h=>Object.keys(h.input_bindings).includes("vin"))).toBe(false);
  });

  it("blocks required authentication before a probe packet",async()=>{
    const g=await graph('<h2>Package metadata</h2><p>API key required for every request.</p><code>GET https://api.example.test/{package}?key=YOUR_KEY</code>',"npm_package_metadata");
    expect(g.probe_packet).toHaveLength(0);
    expect(metrics(g).knownAuthProbeAttempts).toBe(0);
  });

  it("removes optional auth without changing non-auth placeholders",async()=>{
    const g=await graph('<h2>Package metadata</h2><p>Anonymous package lookup. API key only increases rate limits. Return package name and version.</p><code>GET https://api.example.test/{package}?key=optional&format=json</code>',"npm_package_metadata");
    const h=g.hypotheses.find(x=>x.full_path.includes("{package}"));
    expect(h).toBeTruthy();
    expect(h!.full_path).toContain("?format=json");
    expect(h!.full_path).not.toContain("key=");
    expect(metrics(g).placeholderPreservationFailures).toBe(0);
    expect(metrics(g).nonAuthRequestTextMutations).toBe(0);
  });

  it("separates render rejection counters from actual auth-like rendering",async()=>{
    const source=await readFile(new URL("../src/experiment4jRequest.ts",import.meta.url),"utf8");
    expect(source).toContain('kind:"compile_reject"');
    expect(source).toContain('kind:"url_reject"');
    expect(source).toContain('kind:"auth_like"');
    expect(source).toContain("renderCompileRejected++");
    expect(source).toContain("renderUrlParseRejected++");
    expect(source).toContain("authLikeRenderedRequests++");
  });

  it("filters auth-like requests before the safe probe packet",async()=>{
    const g=await graph('<h2>Package metadata</h2><p>Anonymous package endpoint, key optional for higher quota. Return name and version.</p><code>GET https://api.example.test/{package}?api_key={key}</code>',"npm_package_metadata");
    expect(metrics(g).knownAuthProbeAttempts).toBe(0);
    for(const h of g.probe_packet)expect(h.full_path).not.toMatch(/api[_-]?key|token|authorization/i);
  });

  it("retains expanded evidence provenance",async()=>{
    const g=await graph('<h2>Package metadata API</h2><p>Get package and return package name and version.</p><code>GET https://api.example.test/{package}</code>',"npm_package_metadata",true);
    expect(metrics(g).expandedEvidenceHypotheses).toBeGreaterThan(0);
  });

  it("keeps source provider-blind and 4J provenance exclusive",async()=>{
    const requestSource=await readFile(new URL("../src/experiment4jRequest.ts",import.meta.url),"utf8");
    const contractSource=await readFile(new URL("../src/experiment4jContract.ts",import.meta.url),"utf8");
    expect(requestSource).not.toMatch(/openfoodfacts|nhtsa|registry\.npmjs|metmuseum|anapioficeandfire/i);
    expect(contractSource).toContain('prefix="4J_ENTITY_GATED_IDENTIFIER_ROLE:"');
    expect(contractSource).not.toContain('prefix="4I_STRUCTURAL_IDENTIFIER_ROLE:"');
  });

  it("rebuilds a stable same-graph fingerprint",async()=>{
    const evidence=[ev('<h2>Package metadata API</h2><p>Get package and return package name and version.</p><code>GET https://api.example.test/{package}</code>')];
    const a=rebuildRequestGraph4J(evidence,"npm_package_metadata");
    const b=rebuildRequestGraph4J(evidence,"npm_package_metadata");
    expect(a.graph_fingerprint).toBe(b.graph_fingerprint);
    expect(a.hypotheses.map(h=>h.id)).toEqual(b.hypotheses.map(h=>h.id));
  });

  it("derives exact 4J base, formal decisions, and new gates",async()=>{
    const src=await readFile(new URL("../src/experiment4ar.ts",import.meta.url),"utf8");
    const out=deriveExperiment4jSource(src);
    expect(out).toContain("GO_4J_ENTITY_GATED_DOCUMENTED_IDENTIFIER_ROLES");
    expect(out).toContain("REASSESS_4J_ENTITY_GATED_DOCUMENTED_IDENTIFIER_ROLES");
    expect(out).toContain('base_sha:"008af94c9f6fb6e8f63b8c40616ede0bbcbc3988"');
    expect(out).toContain("false_character_books_recipe_absent");
    expect(out).toContain("entity_incompatible_structural_probes_zero");
    expect(out).toContain("placeholder_preservation_failures_zero");
    expect(out).toContain("non_auth_request_text_mutations_zero");
  });

  it("produces syntactically valid generated benchmark TypeScript",async()=>{
    const src=await readFile(new URL("../src/experiment4ar.ts",import.meta.url),"utf8");
    const out=deriveExperiment4jSource(src);
    const result=ts.transpileModule(out,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022},reportDiagnostics:true,fileName:"generated-4j.ts"});
    const syntactic=(result.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error);
    expect(syntactic.map(d=>ts.flattenDiagnosticMessageText(d.messageText,"\n"))).toEqual([]);
  });
});
