import {describe,expect,it} from "vitest";
import {compileEvidenceNativeSemantics4G} from "../src/experiment4gSemantics.js";
import {prepareRequestGraph4G} from "../src/experiment4gRequest.js";
import {RecoveryLedger} from "../src/experiment3yrCore.js";
import {deriveExperiment4gSource} from "../src/experiment4gDerivation.js";
import {readFile} from "node:fs/promises";
const ev=(text:string,extra:any={})=>({evidence_id:extra.evidence_id||"ev1",provider_candidate_id:"synthetic",requested_url:"https://docs.example.test/reference",resolved_url:"https://docs.example.test/reference",verified_at:new Date().toISOString(),status:200,content_type:"text/html",body_fingerprint:"fp",text,state:"ok",...extra} as any);

describe("4G evidence-native operation normalization",()=>{
  it("normalizes endpoint-labelled table/link URL",()=>{const s=compileEvidenceNativeSemantics4G([ev('<h2>API Endpoint</h2><table><tr><td>Endpoint</td><td><a href="https://api.example.test/v1/items?name=alpha">Request</a></td></tr></table>')]);expect(s.operations.some(o=>o.path.includes('/v1/items'))).toBe(true);expect(s.metrics.operationFormsTableOrLink+s.metrics.operationFormsEndpointLabel).toBeGreaterThan(0)});
  it("does not promote navigation links",()=>{const s=compileEvidenceNativeSemantics4G([ev('<h2>Documentation</h2><a href="https://example.test/privacy">Privacy</a><a href="https://example.test/about">About</a>')]);expect(s.operations).toHaveLength(0);expect(s.metrics.operationsRejectedAsNavigation).toBeGreaterThanOrEqual(0)});
  it("retains ancestor-base relative operation behavior",()=>{const s=compileEvidenceNativeSemantics4G([ev('<h2>API Reference</h2>Base URL: https://api.example.test<h3>Object lookup endpoint</h3><code>GET /v1/objects/[object_id]</code>')]);const op=s.operations.find(o=>o.path.includes('/v1/objects/'));expect(op?.api_base_id).toBeTruthy()});
  it("preserves expanded-evidence operation provenance",()=>{const s=compileEvidenceNativeSemantics4G([ev('<h2>API endpoint</h2><code>GET https://api.example.test/v1/items?name=alpha</code>',{source_kind:"4e_reference_expansion"})]);expect(s.metrics.operationsFromExpandedEvidence).toBeGreaterThan(0);expect(s.operations.some(o=>o.source.expanded)).toBe(true)});
});

describe("4G auth and parameter semantics",()=>{
  it("allows anonymous child operation when ancestor describes key only for higher rate limits",async()=>{const evidence=[ev('<h2>API</h2>Anonymous requests are supported. API keys provide higher rate limits.<h3>Age estimate endpoint</h3><code>GET https://api.example.test/age?name=michael</code>')];const g=await prepareRequestGraph4G(evidence,"age_estimate_by_name",new RecoveryLedger());expect(g.metrics.authLikeRenderedRequests).toBe(0);expect(g.probe_packet.length).toBeGreaterThan(0)});
  it("blocks operation-local required API key",async()=>{const evidence=[ev('<h2>Age estimate endpoint</h2>API key required. <code>GET https://api.example.test/age?name=michael&key=123</code>')];const g=await prepareRequestGraph4G(evidence,"age_estimate_by_name",new RecoveryLedger());expect(g.probe_packet).toHaveLength(0);expect(g.metrics.knownAuthProbeAttempts).toBe(0)});
  it("accepts package_name to package morphology with operation context",async()=>{const evidence=[ev('<h2>Package metadata API endpoint</h2><code>GET https://api.example.test/package/{package}</code>')];const g=await prepareRequestGraph4G(evidence,"npm_package_metadata",new RecoveryLedger());expect(g.metrics.parameterMorphologyAccepted).toBeGreaterThan(0);expect(g.probe_packet.length).toBeGreaterThan(0)});
  it("still rejects unrelated generic id",async()=>{const evidence=[ev('<h2>Webhook API endpoint</h2><code>GET https://api.example.test/webhooks/{id}</code>')];const g=await prepareRequestGraph4G(evidence,"chemical_element_metadata",new RecoveryLedger());expect(g.probe_packet).toHaveLength(0);expect(g.metrics.wrongTaskProbeAttempts).toBe(0)});
});

describe("4G benchmark derivation",()=>{it("uses frozen 4G base and formal decision",async()=>{const src=await readFile(new URL("../src/experiment4ar.ts",import.meta.url),"utf8"),out=deriveExperiment4gSource(src);expect(out).toContain('GO_4G_EVIDENCE_NATIVE_OPERATION_SEMANTICS');expect(out).toContain('base_sha:"550a77a08e1cc48fa79ec9487df9ca4a7ba60798"');expect(out).toContain('parameterMorphologyAccepted');expect(out).toContain('authClassRateLimitUpgrade')})});
