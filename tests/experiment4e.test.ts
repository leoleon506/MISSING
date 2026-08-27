import {describe,expect,it} from "vitest";
import {buildRequestGraph4E,discoverReferenceLinks4E,extractOperations4E} from "../src/experiment4eRequest.js";
import {deriveExperiment4eSource} from "../src/experiment4eDerivation.js";
import {readFile} from "node:fs/promises";
const ev=(text:string,url="https://docs.example.com/reference")=>({evidence_id:"ev1",requested_url:url,resolved_url:url,state:"ok",status_code:200,text,bytes:text.length} as any);

describe("4E DOM-native request evidence",()=>{
  it("extracts inline HTML code request examples",()=>{const r=extractOperations4E([ev('<div><code>curl https://api.example.com/v1/items?name=alpha</code></div>')]);expect(r.operations.length).toBeGreaterThan(0);expect(r.operations[0].api_base).toBe("https://api.example.com")});
  it("separates multiple requests in one pre block into two canonical operations",()=>{const r=extractOperations4E([ev('<pre>GET https://api.example.com/v1/a/{name}\nGET https://api.example.com/v1/b/{name}</pre>')]);const canonical=new Set(r.operations.map(x=>`${x.api_base}${x.operation_path}`));expect([...canonical].sort()).toEqual(["https://api.example.com/v1/a/{name}","https://api.example.com/v1/b/{name}"])});
  it("rejects documented auth before a request hypothesis",()=>{const r=buildRequestGraph4E([ev('<pre>Authorization: Bearer TOKEN\nGET https://api.example.com/v1/a/{name}</pre>')],"identity_age");expect(r.metrics.authRequiredOperationsRejected).toBeGreaterThan(0);expect(r.probe_packet).toHaveLength(0);expect(r.metrics.knownAuthProbeAttempts).toBe(0)});
  it("does not bind one arbitrary input to one generic slot",()=>{const r=buildRequestGraph4E([ev('<pre>GET https://api.example.com/v1/webhooks/{id}</pre>')],"science_element");expect(r.probe_packet).toHaveLength(0);expect(r.metrics.wrongTaskProbeAttempts).toBe(0)});
  it("discovers only attributable API reference links",()=>{const r=discoverReferenceLinks4E([ev('<a href="https://docs.example.com/api">API Reference</a><a href="https://evil.test/api">Swagger</a>')]);expect(r.map(x=>x.target)).toEqual(["https://docs.example.com/api"])});
  it("supports a relative GET only with same-scope API base",()=>{const r=extractOperations4E([ev('<pre>Base URL: https://api.example.com\nGET /v1/items/{name}</pre>')]);expect(r.operations.some(x=>x.proof_kind==="base_relative_operation")).toBe(true)});
});

describe("4E benchmark derivation",()=>{
  it("derives the 4E runner from the frozen parent",async()=>{const src=await readFile(new URL("../src/experiment4ar.ts",import.meta.url),"utf8"),out=deriveExperiment4eSource(src);expect(out).toContain('experiment:"4E"');expect(out).toContain('GO_4E_DOM_NATIVE_OPERATION_CORRESPONDENCE');expect(out).toContain('base_sha:"34bf4ee7fbb2c922f625dae2e367175288b8b774"');expect(out).toContain('knownAuthProbeAttempts');expect(out).toContain('wrongTaskProbeAttempts')});
});
