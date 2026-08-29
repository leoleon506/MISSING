import {describe,expect,it} from "vitest";
import {readFile} from "node:fs/promises";
import type {DocEvidence} from "../src/experiment3wCore.js";
import type {Provider4A} from "../src/experiment4aContract.js";
import {compileRequestHypothesisP1} from "../src/experiment4ap1Request.js";
import {buildQueryHypotheses5B6,queryCompilerDeterminism5B6} from "../src/experiment5b6Query.js";

const provider:Provider4A={case_id:"npm_package_metadata",candidate_id:"synthetic_provider",name:"Synthetic API",start_url:"https://docs.example.test/api"};
function ev(text:string):DocEvidence{return {evidence_id:"e1",provider_candidate_id:provider.candidate_id,requested_url:"https://docs.example.test/api",resolved_url:"https://docs.example.test/api",verified_at:"now",status:200,content_type:"text/html",body_fingerprint:"fp",text,state:"ok"}}

describe("Experiment 5B6 query-oriented parameter-local compiler",()=>{
 it("compiles a documented query key by lexical role without matching the example value",()=>{const text=`<h2>Package lookup</h2><p>GET https://api.example.test/query?package_name=example</p><p>package_name: npm package name to look up</p><pre>{"name":"example","version":"1.0.0"}</pre>`,r=buildQueryHypotheses5B6([ev(text)],provider);expect(r.hypotheses.length).toBeGreaterThan(0);const h=r.hypotheses.find(x=>Object.keys(x.input_bindings).includes("package_name"))!;expect(h).toBeTruthy();expect(compileRequestHypothesisP1(h,{package_name:"different-package"})).toContain("package_name=different-package");expect(r.metrics.queryExampleValueMatchUses5b6).toBe(0);expect(r.proofs.find(p=>p.hypothesis_id===h.id)?.assignment_evidence_classes).toContain("lexical")});
 it("can bind one generic q parameter only with distinctive local task context",()=>{const text=`<h2>Package search</h2><p>GET https://api.example.test/search?q=example</p><p>q: search by npm package name and return package metadata</p><pre>{"name":"example","version":"1.0.0"}</pre>`,r=buildQueryHypotheses5B6([ev(text)],provider);expect(r.hypotheses.length).toBeGreaterThan(0);expect(r.metrics.queryParameterGenericContextBindings5b6).toBeGreaterThan(0)});
 it("does not bind an auth-like query parameter as the task input",()=>{const text=`<h2>Package lookup</h2><p>GET https://api.example.test/query?api_key=demo</p><p>api_key: credential used to authenticate</p>`,r=buildQueryHypotheses5B6([ev(text)],provider);expect(r.hypotheses).toHaveLength(0)});
 it("is deterministic for identical acquired evidence",()=>{const text=`<p>GET https://api.example.test/query?package_name=example</p><p>package_name: package identifier</p><pre>{"name":"example","version":"1"}</pre>`;expect(queryCompilerDeterminism5B6([ev(text)],provider).ok).toBe(true)});
});

describe("Experiment 5B6 runtime neutrality",()=>{
 it("contains no development provider, case, endpoint, or exemplar hardcodes",async()=>{const files=["experiment5b6Query.ts","experiment5b6Planner.ts","experiment5b6Contract.ts","experiment5b6Derivation.ts"],text=(await Promise.all(files.map(f=>readFile(new URL(`../src/${f}`,import.meta.url),"utf8")))).join("\n");expect(text).not.toMatch(/arxiv\.org|nvd\.nist|tvmaze|openlibrary|chess\.com|warnely|ipwhois|magnuscarlsen|cve_vulnerability_metadata|arxiv_preprint_metadata|public_domain_book_metadata|gene_identifier_metadata/i)});
});
