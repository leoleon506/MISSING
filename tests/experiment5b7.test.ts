import {describe,expect,it} from "vitest";
import {readFile} from "node:fs/promises";
import type {DocEvidence} from "../src/experiment3wCore.js";
import type {Provider4A} from "../src/experiment4aContract.js";
import {buildGatedQueryHypotheses5B7,querySemanticGateDeterminism5B7} from "../src/experiment5b7Gate.js";

const provider:Provider4A={case_id:"npm_package_metadata",candidate_id:"synthetic_provider",name:"Synthetic API",start_url:"https://docs.example.test/api"};
function ev(text:string):DocEvidence{return {evidence_id:"e1",provider_candidate_id:provider.candidate_id,requested_url:"https://docs.example.test/api",resolved_url:"https://docs.example.test/api",verified_at:"now",status:200,content_type:"text/html",body_fingerprint:"fp",text,state:"ok"}}

describe("Experiment 5B7 entity-coupled query operation gate",()=>{
 it("accepts an entity-coupled package metadata query",()=>{const text=`<h2>Package metadata</h2><p>GET https://api.example.test/package?package_name=example</p><p>package_name: npm package name whose package metadata should be returned</p><pre>{"name":"example","version":"1.0.0"}</pre>`,r=buildGatedQueryHypotheses5B7([ev(text)],provider);expect(r.hypotheses.length).toBeGreaterThan(0);expect(r.metrics.querySemanticGateAccepted5b7).toBeGreaterThan(0);const a=r.audits.find(x=>x.decision==="ACCEPT");expect(a?.entity_mode).not.toBe("none");expect(a?.specialized_action_conflicts).toEqual([])});
 it("rejects a preview operation even when generic outputs look useful",()=>{const text=`<h2>Package URL preview</h2><p>GET https://api.example.test/preview?q=example</p><p>q: npm package URL used to preview a package page</p><pre>{"title":"Package page","description":"Preview text","version":"1"}</pre>`,r=buildGatedQueryHypotheses5B7([ev(text)],provider);expect(r.metrics.querySemanticGateRejected5b7).toBeGreaterThan(0);expect(r.hypotheses).toHaveLength(0);expect(r.audits.some(x=>x.reason==="specialized_action_conflict")).toBe(true)});
 it("rejects a validation/check operation for a metadata task",()=>{const text=`<h2>Package health check</h2><p>GET https://api.example.test/check?package_name=example</p><p>package_name: package name to validate and check health status</p><pre>{"name":"example","status":"ok","version":"1"}</pre>`,r=buildGatedQueryHypotheses5B7([ev(text)],provider);expect(r.hypotheses).toHaveLength(0);expect(r.metrics.queryActionConflictRejects5b7).toBeGreaterThan(0)});
 it("does not allow identity-role compatibility alone without entity or distinctive-output evidence",()=>{const text=`<h2>Generic identifier lookup</h2><p>GET https://api.example.test/lookup?id=example</p><p>id: identifier value</p><pre>{"name":"x","status":"ok"}</pre>`,r=buildGatedQueryHypotheses5B7([ev(text)],provider);expect(r.hypotheses).toHaveLength(0);expect(r.metrics.queryEntityCouplingRejects5b7).toBeGreaterThan(0)});
 it("is deterministic for identical frozen evidence",()=>{const text=`<h2>Package metadata</h2><p>GET https://api.example.test/package?package_name=example</p><p>package_name: npm package name and package metadata</p><pre>{"name":"example","version":"1"}</pre>`;expect(querySemanticGateDeterminism5B7([ev(text)],provider).ok).toBe(true)});
});

describe("Experiment 5B7 runtime neutrality",()=>{
 it("contains no development provider/case/endpoint hardcodes",async()=>{const files=["experiment5b7Gate.ts","experiment5b7PlannerDerivation.ts","experiment5b7Derivation.ts"],text=(await Promise.all(files.map(f=>readFile(new URL(`../src/${f}`,import.meta.url),"utf8")))).join("\n");expect(text).not.toMatch(/arxiv\.org|nvd\.nist|tvmaze|openlibrary|chess\.com|warnely|ipwhois|linkpreview|magnuscarlsen|cve_vulnerability_metadata|arxiv_preprint_metadata|dns_a_record_metadata|public_domain_book_metadata|gene_identifier_metadata/i)});
 it("does not inspect build or replay values",async()=>{const text=await readFile(new URL("../src/experiment5b7Gate.ts",import.meta.url),"utf8");expect(text).not.toContain("c.build");expect(text).not.toContain("replay");expect(text).not.toContain("expected")});
});
